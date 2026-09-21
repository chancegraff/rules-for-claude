#!/usr/bin/env python3
"""extract_source.py — the missing front half of the rebrand pipeline.

WHY THIS EXISTS
---------------
The from-scratch path is complete:

    content -> block dict -> antibland.rank_templates() -> plan.json
    -> preflight_lint -> template_deck.duplicate() -> filled slide

The REBRAND path (user hands us an existing deck to put on the 2026 template)
had no front half at all. With nothing that reads a source .pptx into a `block`,
the only available move was to flatten the deck to a text file and rebuild from
the summary — which throws away every structural signal
`antibland.content_profile()` actually reads (card count, has-chart, has-image,
block keys) and leaves only word count. Three of four matching signals gone, so
template selection collapses to "how many words" and spacing errors follow from
picking a slide whose capacity never matched the source's real shape.

This script closes that gap. It reads a source deck and emits blocks in the
EXACT schema `content_profile()` / `rank_templates()` already consume, so the
existing, tested scoring machinery works on rebrands unchanged.

BLOCK SCHEMA (the contract with antibland.py — do not drift from this)
----------------------------------------------------------------------
    title_slide / section_breaker : bool   structural punctuation
    statement / quote             : str    hero moment / testimonial
    chart                         : dict   -> dataviz families
    milestones                    : list   -> timeline family
    headers + rows                : list   -> comparison_table family
    cards                         : list[dict]  each {title, body} or
                                   {number, caption} -> card_grid vs stat_trio
    columns                       : list   -> content_columns family
    bullets                       : list   -> extended_bullets / title_prose
    prose                         : str    -> title_prose

USAGE
-----
    python extract_source.py source.pptx                      # blocks -> stdout summary
    python extract_source.py source.pptx --out blocks.json     # full JSON
    python extract_source.py source.pptx --rank                # + ranked canonical candidates
    python extract_source.py source.pptx --images-dir src_img  # extract embedded media
    python extract_source.py source.pptx --slide 4             # one slide, verbose

This script NEVER writes to the source deck and never builds anything. It only
reads. Selection stays advisory: it proposes ranked canonical candidates for a
human to approve before any fill happens.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict

from pptx import Presentation
from pptx.util import Emu

try:
    from pptx.enum.shapes import MSO_SHAPE_TYPE
except ImportError:  # pragma: no cover
    MSO_SHAPE_TYPE = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

EMU_PER_IN = 914400.0

# A "number-ish" token: $1.2M, 47%, 3.4x, 12,000, 2×
# Note the [KMB] suffix branch: "18K" and "2.4M" are the most common way a deck
# writes a big number, and without it a 3-stat slide was counted as 2 stats.
_NUMISH = re.compile(
    r"(\$\s?\d|\d+\s?%|\b\d[\d,\.]*\s?[KMB]\b|\b\d[\d,\.]{1,}\b|\bx\d|\d+×|\d+\s?x\b)")
# A stat that leads with its number, e.g. "47% lift" / "$1.2M saved"
_LEADING_NUM = re.compile(r"^\s*[\$€£]?\s?[\d,\.]+\s*[%×xKMB]?\b")
_QUOTE_CHARS = ('"', '"', '"', "«", "»", "“", "”")

# Geometry tolerances for grouping repeated shapes (in inches).
TOL_SIZE = 0.35     # widths/heights within this are "the same size"
TOL_ALIGN = 0.30    # tops/lefts within this are "aligned"


# --------------------------------------------------------------------------- #
# shape reading
# --------------------------------------------------------------------------- #
def _in(v):
    return round((v or 0) / EMU_PER_IN, 3)


def _shape_text(shp) -> str:
    if not getattr(shp, "has_text_frame", False):
        return ""
    return "\n".join(p.text for p in shp.text_frame.paragraphs).strip()


def _paragraphs(shp):
    if not getattr(shp, "has_text_frame", False):
        return []
    return [p.text.strip() for p in shp.text_frame.paragraphs if p.text.strip()]


def _max_font_pt(shp, slide=None):
    """Best-effort font size in points.

    Explicit run size wins; then paragraph size; then the layout placeholder's
    size; then an estimate from the shape's own height (a 1.2in-tall box holding
    one line is a big title, whatever the XML omits). Returns None if the shape
    has no text at all.
    """
    if not getattr(shp, "has_text_frame", False):
        return None
    sizes = []
    for para in shp.text_frame.paragraphs:
        if para.font.size is not None:
            sizes.append(para.font.size.pt)
        for run in para.runs:
            if run.font.size is not None:
                sizes.append(run.font.size.pt)
    if sizes:
        return max(sizes)

    # inherit from the layout placeholder of the same idx
    try:
        if shp.is_placeholder and slide is not None:
            idx = shp.placeholder_format.idx
            for lph in slide.slide_layout.placeholders:
                if lph.placeholder_format.idx == idx:
                    for para in lph.text_frame.paragraphs:
                        if para.font.size is not None:
                            return para.font.size.pt
                        for run in para.runs:
                            if run.font.size is not None:
                                return run.font.size.pt
    except (AttributeError, KeyError, ValueError):
        pass

    # estimate: line height ~= height / line count, points ~= inches * 72 * 0.6
    text = _shape_text(shp)
    if not text:
        return None
    lines = max(len(_paragraphs(shp)), 1)
    est = (_in(shp.height) / lines) * 72 * 0.6
    return round(min(max(est, 8.0), 90.0), 1)


def _kind(shp):
    """Coarse shape kind: text | picture | chart | table | group | deco."""
    if getattr(shp, "has_chart", False):
        return "chart"
    if getattr(shp, "has_table", False):
        return "table"
    if MSO_SHAPE_TYPE is not None:
        if shp.shape_type == MSO_SHAPE_TYPE.PICTURE:
            return "picture"
        if shp.shape_type == MSO_SHAPE_TYPE.GROUP:
            return "group"
        if shp.shape_type == MSO_SHAPE_TYPE.PLACEHOLDER:
            try:
                if shp.placeholder_format.type is not None and _shape_text(shp) == "":
                    # empty picture placeholder reads as an image slot
                    if "PICTURE" in str(shp.placeholder_format.type):
                        return "picture"
            except (AttributeError, ValueError):
                pass
    if getattr(shp, "has_text_frame", False) and _shape_text(shp):
        return "text"
    return "deco"


def _flatten(shapes, slide, depth=0):
    """Walk shapes, descending into groups so cards inside a group are seen."""
    out = []
    for shp in shapes:
        kind = _kind(shp)
        if kind == "group" and depth < 3:
            out.extend(_flatten(shp.shapes, slide, depth + 1))
            continue
        rec = {
            "name": shp.name,
            "kind": kind,
            "x": _in(shp.left),
            "y": _in(shp.top),
            "w": _in(shp.width),
            "h": _in(shp.height),
            "text": _shape_text(shp),
            "paras": _paragraphs(shp),
            "font_pt": _max_font_pt(shp, slide),
            "_shape": shp,
        }
        rec["words"] = len(rec["text"].split())
        out.append(rec)
    return out


# --------------------------------------------------------------------------- #
# repeated-group detection  (the signal the text dump destroys)
# --------------------------------------------------------------------------- #
def _same_width(a, b):
    return abs(a["w"] - b["w"]) <= TOL_SIZE


def detect_groups(text_shapes):
    """Find sets of >=2 repeated text shapes = cards / columns.

    Grouping is by WIDTH, not width+height. Real card grids are masonry: the
    columns share a width (the grid gutter defines it) while heights vary with
    the copy. Requiring matching heights split genuine 4-card slides into
    nothing, which is how a card grid ended up classified as `bullets` and
    matched to a prose template. A shared width plus either row-alignment,
    column-alignment, or >=3 members is the reliable signature.
    """
    groups = []
    used = set()
    pool = sorted(text_shapes, key=lambda s: (s["y"], s["x"]))

    for i, seed in enumerate(pool):
        if i in used or seed["words"] == 0:
            continue
        same_w = [(j, o) for j, o in enumerate(pool)
                  if j not in used and o["words"] > 0 and _same_width(seed, o)]
        if len(same_w) < 2:
            continue
        row = [(j, o) for j, o in same_w if abs(o["y"] - seed["y"]) <= TOL_ALIGN]
        col = [(j, o) for j, o in same_w if abs(o["x"] - seed["x"]) <= TOL_ALIGN]
        # masonry: shared width across >=3 shapes is a grid even when neither
        # tops nor lefts line up
        best, axis = max(
            [(row, "row"), (col, "stack"), (same_w, "grid")],
            key=lambda t: len(t[0]),
        )
        if axis == "grid" and len(same_w) < 3:
            continue
        if len(best) < 2:
            continue
        best = sorted(best, key=lambda t: (t[1]["y"], t[1]["x"]) if axis == "stack"
                      else (t[1]["x"], t[1]["y"]))
        for j, _ in best:
            used.add(j)
        groups.append({"axis": axis, "n": len(best),
                       "members": [m for _, m in best]})
    groups.sort(key=lambda g: -g["n"])
    return groups


def detect_stats(text_shapes):
    """Find a big-number display: >=2 large, short, numeric text shapes.

    This runs BEFORE generic grouping because a stat display's *captions* are
    also a repeated group, and whichever set grouping happened to grab first
    decided the family. Captions carry no numbers, so a 4-stat slide scored as
    a plain card grid and lost its stat_trio / KPI homes. Anchoring on the
    numbers themselves and pulling in the nearest caption fixes that.
    """
    nums = [s for s in text_shapes
            if s["words"] <= 5
            and (s["font_pt"] or 0) >= 16
            and _NUMISH.search(s["text"])]
    if len(nums) < 2:
        return None
    nums.sort(key=lambda s: (round(s["y"], 1), s["x"]))
    used = {s["name"] for s in nums}
    cards = []
    for s in nums:
        card = {"number": s["text"].replace("\n", " ").strip()}
        # nearest small-type short shape within ~0.8in = its caption
        best, bestd = None, 9e9
        for c in text_shapes:
            if c["name"] in used or c["words"] > 12:
                continue
            if (c["font_pt"] or 99) >= (s["font_pt"] or 0):
                continue
            d = abs(c["y"] - s["y"]) + abs(c["x"] - s["x"])
            if d < bestd and d <= 1.6:
                best, bestd = c, d
        if best is not None:
            card["caption"] = best["text"].replace("\n", " ").strip()
            used.add(best["name"])
        cards.append(card)
    return {"cards": cards, "shapes": used, "n": len(nums)}


_DATE_LEAD = re.compile(
    r"^\s*(?:"
    r"Q[1-4]\b|H[12]\b|"
    r"(?:19|20)\d{2}\b|"
    r"(?:Step|Phase|Stage|Week|Month|Day|Sprint)\s*\d|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|"
    r"\d{1,2}\s*[-/]\s*\d{1,2}"
    r")", re.I)


def detect_milestones(groups):
    """A row of >=3 shapes each LEADING with a date/quarter/step = timeline.

    Without this, a roadmap read as generic bullets and matched to a prose
    template instead of the timeline family (159-164).
    """
    for g in groups:
        if g["n"] < 3:
            continue
        leads = [m for m in g["members"] if _DATE_LEAD.match(m["text"])]
        if len(leads) >= max(3, int(0.6 * g["n"])):
            return {
                "milestones": [
                    {"when": (m["paras"][0] if m["paras"] else m["text"]),
                     "what": " ".join(m["paras"][1:]) if len(m["paras"]) > 1 else ""}
                    for m in g["members"]
                ],
                "shapes": {m["name"] for m in g["members"]},
            }
    return None


_AGENDA_ITEM = re.compile(r"^\s*(?:Section\s*)?(?:0?\d{1,2}|[IVX]{1,4})[\.\)\:]?\s*$|"
                          r"^\s*Section\s*0?\d", re.I)


def detect_agenda(text_shapes, slide_index):
    """Numbered short items ('Section 01', '01', '1.') = agenda, not bullets.

    The agenda family (24-28) had no detector, so contents slides matched prose
    templates whose capacity is wrong for a numbered list.
    """
    if slide_index > 6:
        return None
    marks = [s for s in text_shapes if _AGENDA_ITEM.match(s["text"].strip())]
    if len(marks) >= 3:
        return {"n": len(marks), "shapes": {s["name"] for s in marks}}
    # a single box whose paragraphs are all numbered
    for s in text_shapes:
        if len(s["paras"]) >= 3:
            numbered = [p for p in s["paras"]
                        if re.match(r"^\s*(?:0?\d{1,2}[\.\)]|Section\s*0?\d)", p, re.I)]
            if len(numbered) >= 3:
                return {"n": len(numbered), "shapes": {s["name"]}}

    # UNNUMBERED agenda — the common real case. An early slide whose only text
    # box holds 3-8 short, unpunctuated, largish lines ("The problem / Where we
    # left off / Progress & demo / Next steps") is a contents slide, but carries
    # no numeral for a marker regex to catch. Without this it read as `prose`
    # and matched a prose template whose capacity is wrong for a list.
    bodies = [s for s in text_shapes if len(s["paras"]) >= 3]
    if len(bodies) == 1 and len(text_shapes) <= 2:
        s = bodies[0]
        paras = s["paras"]
        short = [p for p in paras if len(p.split()) <= 6]
        unpunctuated = [p for p in paras if not p.rstrip().endswith((".", "!", "?"))]
        if (3 <= len(paras) <= 8
                and len(short) == len(paras)
                and len(unpunctuated) == len(paras)
                and (s["font_pt"] or 0) >= 16):
            return {"n": len(paras), "shapes": {s["name"]}, "unnumbered": True}
    return None


def _pair_group_members(group, all_text):
    """Turn a detected group into card dicts.

    A card is very often TWO shapes — a heading box with the body box tucked
    directly beneath it. Counting each shape as its own card turned a 4-card
    slide into 7 cards, and card count is exactly what decides whether the copy
    fits the chosen template. So stack shapes that sit in the same column with a
    small vertical gap into one {title, body} card before anything else.
    """
    members = sorted(group["members"], key=lambda m: (round(m["x"], 1), m["y"]))
    units = []
    i = 0
    while i < len(members):
        m = members[i]
        nxt = members[i + 1] if i + 1 < len(members) else None
        pairable = (
            nxt is not None
            and abs(nxt["x"] - m["x"]) <= TOL_ALIGN
            and 0 <= (nxt["y"] - (m["y"] + m["h"])) <= 0.45
            and m["words"] <= 10                      # the shorter one is the heading
            and (m["font_pt"] or 0) >= (nxt["font_pt"] or 0)
        )
        if pairable:
            units.append((m, nxt))
            i += 2
        else:
            units.append((m, None))
            i += 1

    cards = []
    for head, body in units:
        paras = head["paras"]
        text = head["text"]
        is_stat = bool(_LEADING_NUM.match(text)) or (
            head["words"] <= 6 and len(_NUMISH.findall(text)) >= 1
        )
        if is_stat:
            card = {"number": paras[0] if paras else text}
            cap = " ".join(paras[1:]) if len(paras) > 1 else (body["text"] if body else "")
            if cap:
                card["caption"] = cap
            cards.append(card)
        elif body is not None:
            cards.append({"title": text, "body": body["text"]})
        elif len(paras) >= 2:
            cards.append({"title": paras[0], "body": " ".join(paras[1:])})
        else:
            cards.append({"title": text} if head["words"] <= 8 else {"body": text})
    return cards


# --------------------------------------------------------------------------- #
# role classification -> block
# --------------------------------------------------------------------------- #
def classify(shapes, slide_index, slide_h_in=7.5, slide_count=None):
    """Assign roles to shapes and build an antibland-compatible block."""
    text_shapes = [s for s in shapes if s["kind"] == "text" and s["words"] > 0]
    pictures = [s for s in shapes if s["kind"] == "picture"]
    charts = [s for s in shapes if s["kind"] == "chart"]
    tables = [s for s in shapes if s["kind"] == "table"]

    roles = {}
    block = {}
    notes = []

    # ---- reserve stat shapes BEFORE picking a title ----------------------
    # A big number is set large on purpose: "150K+" at 24pt outranks a real
    # 22.5pt slide title on font size alone. Letting title selection run first
    # therefore ate two of the three stats, dropped the survivor below the
    # 2-shape threshold, and the slide lost its stat_trio / KPI home. Reserve
    # the numbers first so neither pass can steal from the other.
    stats_hit = detect_stats(text_shapes)
    reserved = set(stats_hit["shapes"]) if stats_hit else set()

    # ---- title / subtitle: biggest type, upper two-thirds ----------------
    # A shape holding >=3 paragraphs is a body box no matter how large its type
    # (an agenda list set at 25pt is not a title).
    ranked = sorted(
        [s for s in text_shapes
         if s["font_pt"] and s["name"] not in reserved and len(s["paras"]) < 3],
        key=lambda s: (-(s["font_pt"] or 0), s["y"]),
    )
    title = None
    subtitle = None
    if ranked:
        title = ranked[0]
        roles[title["name"]] = "title"
        # A subtitle sits with the title and is unique. A shape that shares its
        # width with two or more siblings belongs to a repeated group, not to
        # the header — claiming one as the subtitle silently deleted a card or a
        # timeline step (a 4-step roadmap arrived as 3).
        width_counts = defaultdict(int)
        for s in text_shapes:
            width_counts[round(s["w"], 1)] += 1
        for cand in ranked[1:]:
            in_group = width_counts[round(cand["w"], 1)] >= 3
            if (cand["words"] <= 30
                    and abs(cand["y"] - title["y"]) < 1.5
                    and not in_group):
                subtitle = cand
                roles[cand["name"]] = "subtitle"
                break

    body_pool = [s for s in text_shapes if s["name"] not in roles]

    # ---- hard structural signals first ----------------------------------
    if tables:
        tbl = tables[0]["_shape"].table
        rows = [[c.text.strip() for c in r.cells] for r in tbl.rows]
        if rows:
            block["headers"] = rows[0]
            block["rows"] = rows[1:]
        roles[tables[0]["name"]] = "table"
        notes.append("native table -> comparison_table family")

    if charts:
        ch = charts[0]["_shape"].chart
        try:
            ctype = str(ch.chart_type).split(".")[-1].split(" ")[0]
        except (AttributeError, ValueError):
            ctype = "UNKNOWN"
        series = []
        try:
            for s in ch.plots[0].series:
                series.append({"name": s.name, "values": list(s.values)})
            cats = [str(c) for c in ch.plots[0].categories]
        except (IndexError, AttributeError, ValueError):
            cats = []
        block["chart"] = {"type": ctype, "categories": cats, "series": series}
        roles[charts[0]["name"]] = "chart"
        notes.append(f"native chart ({ctype}) -> dataviz family")

    # ---- big-number display (before generic grouping — see detect_stats) --
    groups = detect_groups(body_pool)
    if not block:
        milestones_hit = detect_milestones(groups)
        agenda_hit = detect_agenda(text_shapes, slide_index)

        if milestones_hit:
            block["milestones"] = milestones_hit["milestones"]
            for nm in milestones_hit["shapes"]:
                roles[nm] = "milestone"
            notes.append(f"{len(block['milestones'])} date/step-led shapes -> timeline family")
        elif stats_hit:
            block["cards"] = stats_hit["cards"]
            for nm in stats_hit["shapes"]:
                roles[nm] = "stat"
            notes.append(f"{stats_hit['n']} large numeric shapes -> stat_trio/KPI family")
        elif agenda_hit:
            block["agenda"] = True
            block["bullets"] = [s["text"] for s in body_pool if s["words"] <= 20][:12]
            for nm in agenda_hit["shapes"]:
                roles[nm] = "agenda_item"
            notes.append(f"{agenda_hit['n']} numbered items -> agenda family")
        if block:
            body_pool = [s for s in body_pool if s["name"] not in roles]

    # ---- repeated groups (cards / columns) ------------------------------
    strong = [g for g in groups
              if g["n"] >= 2 and all(m["name"] not in roles for m in g["members"])]
    if strong and not block:
        g = strong[0]
        cards = _pair_group_members(g, text_shapes)
        for m in g["members"]:
            roles[m["name"]] = f"group_{g['n']}x_{g['axis']}"
        avg_words = sum(m["words"] for m in g["members"]) / max(g["n"], 1)
        # Report the CARD count, not the shape count — cards are the slots the
        # copy has to fit into, so that is the number a reviewer needs to see.
        if any("number" in c for c in cards):
            block["cards"] = cards
            notes.append(f"{len(cards)} stat cards (from {g['n']} shapes) "
                         f"-> stat_trio family")
        elif avg_words > 45:
            block["columns"] = [m["text"] for m in g["members"]]
            notes.append(f"{len(block['columns'])} prose columns -> content_columns family")
        else:
            block["cards"] = cards
            notes.append(f"{len(cards)} cards (from {g['n']} shapes) -> card_grid family")
        body_pool = [s for s in body_pool if s["name"] not in roles]

    # ---- statement / quote ----------------------------------------------
    total_words = sum(s["words"] for s in text_shapes)
    if not block and title:
        big = (title["font_pt"] or 0) >= 34
        is_quote = any(t in title["text"] for t in _QUOTE_CHARS)
        if is_quote or (subtitle and any(t in subtitle["text"] for t in _QUOTE_CHARS)):
            block["quote"] = title["text"]
            notes.append("quote marks -> testimonial family")
        elif big and total_words <= 25 and not pictures:
            if slide_index == 1:
                block["title_slide"] = True
            else:
                block["statement"] = title["text"]
                notes.append(f"{total_words} words at {title['font_pt']}pt -> statement family")

    # ---- bullets / prose fallback ---------------------------------------
    if not block or (set(block) <= {"title_slide"}):
        leftovers = body_pool or [s for s in text_shapes if roles.get(s["name"]) == "subtitle"]
        bullets = []
        prose = []
        for s in leftovers:
            if len(s["paras"]) >= 2:
                bullets.extend(s["paras"])
                roles[s["name"]] = "bullets"
            elif s["words"] > 12:
                prose.append(s["text"])
                roles[s["name"]] = "prose"
        if bullets:
            block["bullets"] = bullets
            notes.append(f"{len(bullets)} paragraphs in one box -> bullets")
        if prose and not bullets:
            block["prose"] = " ".join(prose)
            notes.append("single-paragraph body -> prose")

    # ---- structural punctuation -----------------------------------------
    is_last = slide_count is not None and slide_index == slide_count
    closing_words = {"thank you", "thanks", "questions", "q&a", "the end", "fin"}
    # Require actual closing language. "last slide with few words" alone was
    # too loose — it labelled a content slide `closing` whenever a deck ended
    # early, and an empty last slide has nothing to place anyway.
    all_text_lower = " ".join(s["text"] for s in text_shapes).lower()
    looks_closing = (
        is_last and total_words <= 12
        and any(w in all_text_lower for w in closing_words)
    )

    if not block:
        if slide_index == 1:
            block["title_slide"] = True
        elif looks_closing:
            block["closing"] = True
            notes.append("last slide, closing language -> end family")
        elif total_words <= 8 and title:
            block["section_breaker"] = True
            notes.append(f"{total_words} words, no body -> section_breaker")
        elif title:
            block["prose"] = title["text"]

    if slide_index == 1 and "title_slide" not in block and total_words <= 40:
        block.pop("statement", None)
        block["title_slide"] = True
    if looks_closing and "closing" not in block:
        block = {k: v for k, v in block.items() if k in ("title", "subtitle")}
        block["closing"] = True
        notes.append("last slide, closing language -> end family")

    # ---- carry the words through so density scores correctly ------------
    if title and "title" not in block:
        block["title"] = title["text"]
    if subtitle:
        block["subtitle"] = subtitle["text"]

    for p in pictures:
        roles.setdefault(p["name"], "picture")

    return block, roles, notes, {
        "text_shapes": len(text_shapes),
        "pictures": len(pictures),
        "charts": len(charts),
        "tables": len(tables),
        "groups": [{"axis": g["axis"], "n": g["n"]} for g in groups if g["n"] >= 2],
        "total_words": total_words,
        "max_font_pt": (ranked[0]["font_pt"] if ranked else None),
    }


# --------------------------------------------------------------------------- #
# asset extraction
# --------------------------------------------------------------------------- #
def extract_assets(shapes, slide_index, images_dir):
    assets = []
    if not images_dir:
        return assets
    os.makedirs(images_dir, exist_ok=True)
    for n, shp in enumerate([s for s in shapes if s["kind"] == "picture"]):
        try:
            img = shp["_shape"].image
        except (AttributeError, ValueError):
            continue
        ext = img.ext or "png"
        path = os.path.join(images_dir, f"s{slide_index}_{n}.{ext}")
        with open(path, "wb") as fh:
            fh.write(img.blob)
        w, h = shp["w"], shp["h"]
        assets.append({
            "path": path,
            "shape": shp["name"],
            "placed_w_in": w,
            "placed_h_in": h,
            "aspect": round(w / h, 3) if h else None,
            "px": list(img.size),
        })
    return assets


# --------------------------------------------------------------------------- #
# main extraction
# --------------------------------------------------------------------------- #
def extract(path, images_dir=None, rank=False, only=None):
    prs = Presentation(path)
    slide_h = _in(prs.slide_height)
    ranker = None
    if rank:
        import antibland
        ranker = antibland

    out = {
        "source": os.path.basename(path),
        "slide_count": len(prs.slides),
        "slide_size_in": [_in(prs.slide_width), slide_h],
        "slides": [],
    }

    for idx, slide in enumerate(prs.slides, start=1):
        if only and idx != only:
            continue
        shapes = _flatten(slide.shapes, slide)
        block, roles, notes, stats = classify(shapes, idx, slide_h,
                                              slide_count=len(prs.slides))
        assets = extract_assets(shapes, idx, images_dir)

        rec = {
            "index": idx,
            "block": block,
            "block_keys": sorted(k for k in block
                                 if k not in ("title", "subtitle")),
            "structure": stats,
            "roles": roles,
            "why": notes,
            "assets": assets,
            "shapes": [{k: v for k, v in s.items() if k != "_shape"}
                       for s in shapes],
        }

        if ranker:
            prof, ranked = ranker.rank_templates(block)
            rec["profile"] = prof
            rec["candidates"] = ranked[:8]
            sug = ranker.suggest(block)
            if sug.get("bland_flag"):
                rec["bland_flag"] = sug["bland_flag"]

        out["slides"].append(rec)

    return out


def print_summary(data, verbose=False):
    print(f"\n{data['source']} — {data['slide_count']} slides "
          f"({data['slide_size_in'][0]}x{data['slide_size_in'][1]} in)\n")
    hdr = f"{'#':>3}  {'block keys':<30} {'shapes':<7} {'grp':<6} {'words':>5}"
    if data["slides"] and "candidates" in data["slides"][0]:
        hdr += "  top canonical candidates"
    print(hdr)
    print("-" * len(hdr))
    for s in data["slides"]:
        st = s["structure"]
        grp = ",".join(f"{g['n']}{g['axis'][0]}" for g in st["groups"]) or "-"
        shp = f"{st['text_shapes']}t"
        if st["pictures"]:
            shp += f"/{st['pictures']}i"
        if st["charts"]:
            shp += f"/{st['charts']}c"
        if st["tables"]:
            shp += f"/{st['tables']}T"
        line = (f"{s['index']:>3}  {','.join(s['block_keys'])[:29]:<30} "
                f"{shp:<7} {grp:<6} {st['total_words']:>5}")
        if "candidates" in s:
            cands = " ".join(str(c["slide"]) for c in s["candidates"][:5])
            line += f"  {cands}"
        print(line)
        if verbose:
            for w in s["why"]:
                print(f"        · {w}")
            for a in s["assets"]:
                print(f"        img {a['path']} aspect {a['aspect']}")
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("--out", help="write full JSON here")
    ap.add_argument("--images-dir", help="extract embedded pictures to this dir")
    ap.add_argument("--rank", action="store_true",
                    help="add ranked canonical candidates via antibland")
    ap.add_argument("--slide", type=int, help="only this slide (1-based)")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()

    data = extract(args.source, images_dir=args.images_dir,
                   rank=args.rank, only=args.slide)
    print_summary(data, verbose=args.verbose or bool(args.slide))
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(data, fh, indent=1)
        print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
