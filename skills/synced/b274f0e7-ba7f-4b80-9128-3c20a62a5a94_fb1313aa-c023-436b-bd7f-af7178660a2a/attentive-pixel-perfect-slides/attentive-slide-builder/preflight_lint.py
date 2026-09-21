#!/usr/bin/env python3
"""preflight_lint.py — the fit GATE you run before build_from_plan.py.

The builder only checks that your placeholder keys match; it does NOT check
whether your copy fits. This script closes that gap. For every slide in a
plan.json it:

  1. Opens the exact canonical slide the step will DUPLICATE.
  2. Locates the real shape each text key lands in and MEASURES its box
     (width, height, font size/weight) straight from the canonical slide's XML
     — the same geometry the duplicate will inherit.
  3. Runs the formatting fit engine (attentive-slide-formatting/fit_text.py) on
     your *replacement* copy and reports one of: fits / compress / split.
  4. Flags every text key that won't match a shape (a wrong template pick or a
     typo) and every image shape name that isn't on the slide.

It changes nothing. It only reports. Overflow shows up here, before you render,
instead of as mysterious "spacing" problems after.

Usage
-----
    python preflight_lint.py plan.json            # human report
    python preflight_lint.py plan.json --strict   # exit 1 if any error/overflow
    python preflight_lint.py plan.json --json      # machine-readable report

Reading the verdict
-------------------
  OK        copy fits the measured box.
  COMPRESS  over by <= 25% — tighten the wording, stay on this template.
  SPLIT     over by  > 25% — too big for this template; pick a denser canonical
            slide or split the content across duplicated slides.
  NO-MATCH  the key isn't on this canonical slide — re-run
            `build_from_plan.py --inspect <N>` and copy the exact placeholder
            string, or you've picked the wrong template.

Caps come from the measured box (font size + width + height, calibrated so the
deck's own multi-line boxes — e.g. slide 131's 4-line, ~110-char header —
measure as designed). A shape that holds a bulleted LIST is measured as one
box; per-bullet limits (75-85 chars on the workhorse) are noted, not enforced,
because a plan expresses each bullet as its own key.

Content headers are special-cased: a short top-left title/subtitle box (the kind
the builder auto-widens onto ONE line) is measured as a one-line field at the
widest it could grow — using the SAME helper the builder uses
(fit_titles.is_content_header / available_width) — so a header too long to ever
be one line is flagged (COMPRESS/SPLIT); the fix is to shorten the copy. Big
display titles, eyebrows, stat numbers, agenda lists, and the intentionally
multi-line workhorse header (slide 131) are excluded and fall back to the box
measurement above.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.util import Emu

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
# fit_text lives in the sibling formatting skill.
_FIT_DIR = HERE.parent / "attentive-slide-formatting" / "scripts"
sys.path.insert(0, str(_FIT_DIR))
import fit_text  # noqa: E402
from template_deck import TemplateDeck  # noqa: E402 (only for template resolution)
import antibland  # noqa: E402  (anti-bland decisioning layer — the vividness gate)
import fit_titles  # noqa: E402  (shared geometry helper — one-line content headers)

DEFAULT_TEMPLATE = "Template—2026 NEW Attentive Company Deck Template.pptx"


# --------------------------------------------------------------------------- #
# template families (for the variety / monotony check)
# --------------------------------------------------------------------------- #
# Coarse family ranges for the variety/monotony grouping — a LOOK grouping, not a
# slide→category map (labels like `split_stat` / `content_card` / `fallback` are
# visual buckets chosen so look-alikes collapse together). The authoritative
# per-slide category lives in slide_scores.json; antibland.FAMILY_CANDIDATES keeps
# a separate curated candidate map for selection. The three are different
# projections of the deck, not duplicates — when the deck changes, reconcile each
# against slide_scores.json.
_FAMILY_RANGES = [
    (13, 19, "title"), (24, 28, "agenda"), (30, 47, "breaker"),
    (49, 58, "testimonial"), (60, 62, "statement"), (63, 68, "prose"),
    (69, 72, "columns"), (73, 77, "content_card"), (78, 80, "split_stat"),
    (81, 84, "card_grid"), (85, 89, "caption_grid"), (91, 116, "dataviz"),
    (118, 120, "case_study"), (122, 124, "demo"), (126, 129, "end"),
    (131, 164, "fallback"),
]
# families that are SUPPOSED to repeat (structure, not body) — excluded from
# the monotony check so covers, dividers and closers don't trip it.
_STRUCTURAL = {"title", "agenda", "end"}


def family_of(n):
    for lo, hi, fam in _FAMILY_RANGES:
        if lo <= n <= hi:
            return fam
    return "other"


# Visual "look" buckets — families that read as the SAME kind of slide are
# collapsed into one bucket so alternating near-identical siblings can't dodge
# the monotony cap. The classic trap is the title+paragraph "workhorse": prose
# (63-68) and content_card (73-77) look identical to an audience, so a deck that
# leans on 73/75/68 reads as one slide repeated even though the family taxonomy
# calls them different. Any family not listed keeps its own name as its look.
# Structural looks (cover/divider/closer) are the intended repeats and are
# excluded from the monotony check below.
_LOOK_BUCKET = {
    "prose": "text_block",          # title + paragraph
    "content_card": "text_block",   # title + paragraph + card  (same read)
}

# Per-slide look overrides for the broad `dataviz` range (91-116) and the
# stat_trio (80). Data-viz is NOT one look: a KPI card, a table, a bar chart, a
# trend line and a pie read as completely different slides, so they get distinct
# looks and a genuinely chart-diverse deck is NOT penalised. The one merge we DO
# want is the "big number" KPI/stat layouts (stat_trio 80, KPI summary 92, KPI
# row 104-107) — so three interchangeable number slides can't masquerade as
# variety. Unlisted data-viz slides fall back to a generic `dataviz` look.
_SLIDE_LOOK = {
    80: "big_number", 92: "big_number",
    104: "big_number", 105: "big_number", 106: "big_number", 107: "big_number",
    91: "timeline",
    93: "bar", 94: "bar", 95: "bar", 110: "bar",
    96: "table", 97: "table",
    98: "trend", 109: "trend", 112: "trend",
    99: "pie",
    101: "stacked", 111: "stacked",
    103: "matrix",
    108: "quote_data",
}


def look_of(n):
    """The visual look bucket for a canonical slide number (collapses look-alike
    families so the variety check counts appearances, not range labels)."""
    if n in _SLIDE_LOOK:
        return _SLIDE_LOOK[n]
    return _LOOK_BUCKET.get(family_of(n), family_of(n))


def variety_report(plan_slides) -> dict:
    """Flag a monotonous first pass. Hardened to close the loopholes that used to
    let a bland deck pass clean:

      1. The per-look cap is TIGHTER and measured on CONTENT slides, not the whole
         deck (dividers/cover/closer no longer inflate the budget).
      2. Look-alike families are COLLAPSED into one look bucket (prose +
         content_card = one title+paragraph look), so alternating 73/75/68 can't
         hide five paragraph slides behind "distinct families".
      3. A minimum-distinct-looks backstop requires real breadth of layout.

    The result feeds report['ok_to_build'], so any warning here BLOCKS the build
    like an overflow does (override with --force). Structural repeats
    (cover/divider/closer) are never counted."""
    from collections import Counter
    nums = [s.get("template_slide") for s in plan_slides
            if isinstance(s.get("template_slide"), int)]
    fams = [family_of(n) for n in nums]
    looks = [look_of(n) for n in nums]
    warnings = []

    content_idx = [i for i, f in enumerate(fams) if f not in _STRUCTURAL]
    n_content = len(content_idx)
    n_total = len(nums)
    # how often one LOOK may appear — based on the CONTENT slide count, tighter
    # than before: ceil(content/5), min 2. (12 content → 3; 20 content → 4.)
    cap = max(2, -(-n_content // 5))
    # The title+paragraph workhorse (text_block) gets a STRICTER cap on larger
    # decks: on a deck of >=15 total slides it may appear at most twice, so a big
    # deck can never lean on prose. Smaller decks keep the general cap (already 2
    # at that size), so this only actually bites on ~18-20+ slide decks where the
    # general cap would otherwise rise to 3-4.
    LARGE_DECK = 15

    def cap_for(look):
        if look == "text_block" and n_total >= LARGE_DECK:
            return min(cap, 2)
        return cap

    look_counts = Counter(looks[i] for i in content_idx)
    for look, c in sorted(look_counts.items(), key=lambda kv: -kv[1]):
        look_cap = cap_for(look)
        if c > look_cap:
            warnings.append(
                f"look '{look}' used {c}× (cap {look_cap} for {n_content} content "
                f"slides) — swap some onto a different template family"
            )
    # the SAME exact canonical slide should appear at most twice in a deck
    for num, c in Counter(nums[i] for i in content_idx).items():
        if c > 2:
            warnings.append(
                f"canonical slide #{num} reused {c}× — pick a different template"
            )
    # no more than 2 content slides of the same LOOK back to back
    run_look, run_len, run_start = None, 0, 0
    seq = [(i, looks[i]) for i in content_idx] + [(None, None)]
    for i, lk in seq:
        if lk == run_look:
            run_len += 1
        else:
            if run_look is not None and run_len > 2:
                warnings.append(
                    f"{run_len} '{run_look}' slides in a row (slides "
                    f"{run_start + 1}-{run_start + run_len}) — break them up"
                )
            run_look, run_len, run_start = lk, 1, (i if i is not None else 0)
    # a deck of any real size should show breadth of layout
    distinct_looks = len(set(looks[i] for i in content_idx))
    if n_content >= 6:
        min_looks = max(3, -(-n_content // 4))   # ceil(content/4), min 3
        if distinct_looks < min_looks:
            warnings.append(
                f"only {distinct_looks} distinct looks across {n_content} content "
                f"slides (aim for ≥{min_looks}) — reach for richer families "
                f"(stats, cards, comparison, timeline, case study, quote)"
            )
    return {"ok": not warnings, "warnings": warnings,
            "distinct_families": len(set(fams[i] for i in content_idx)),
            "distinct_looks": distinct_looks, "cap": cap,
            "text_block_cap": cap_for("text_block"),
            "content_slides": n_content}


def transitions_report(plan_slides) -> dict:
    """Enforce ONE consistent section-transition system *when the deck uses one*:
    the reused-agenda progress divider (preferred) OR full-bleed breakers before
    every section — never mixed, never a single decorative one-off breaker.

    A single agenda / table-of-contents shown ONCE (no mid-deck tracking) is a
    legitimate — and for small decks, preferred — choice. It is a contents slide,
    NOT a progress-divider *system*, so it is never flagged, at any deck size.
    The tracker-consistency rules kick in only once the agenda is REUSED (2+
    instances): a progress divider is an all-or-nothing commitment — use it before
    every section with the current one highlighted, or don't use it as a tracker
    at all. (An agenda counts whether it is filled via the `divider` key or via
    plain `text`/`shapes`; the opening full-contents instance may omit `active`
    by design.)"""
    def tslide(s):
        n = s.get("template_slide")
        return n if isinstance(n, int) else -1

    breakers = [i for i, s in enumerate(plan_slides) if 30 <= tslide(s) <= 47]
    agendas = [i for i, s in enumerate(plan_slides) if 24 <= tslide(s) <= 28]
    ag_active = [i for i in agendas
                 if (plan_slides[i].get("divider") or {}).get("active") is not None]
    nb, nd = len(breakers), len(agendas)      # nd = agenda (progress-divider) instances
    warnings = []

    if nb and nd:
        warnings.append(
            f"mixed transition systems: {nd} agenda/progress divider(s) + {nb} "
            "breaker(s). Commit to ONE — the reused-agenda divider (preferred) "
            "or breakers before every section."
        )
    if nb == 1:
        warnings.append(
            "one-off section breaker (used once). Use a breaker before EVERY "
            "section (rotating color), or switch to the reused-agenda progress "
            "divider."
        )
    # A SINGLE agenda instance (nd == 1) is just a table of contents — always fine.
    # Only a REUSED agenda (2+) is a position tracker, and then it must actually
    # track: at least one instance has to highlight, or it is a repeated TOC.
    if nd >= 2 and not ag_active:
        warnings.append(
            f"agenda reused {nd}× but no instance sets `active` — a repeated "
            "table of contents that never highlights isn't a tracker. Either "
            "highlight the current section on each reuse, or show the contents "
            "once and drop the mid-deck repeats."
        )
    return {"ok": not warnings, "warnings": warnings,
            "breakers": nb, "dividers": nd, "dividers_active": len(ag_active)}


# --------------------------------------------------------------------------- #
# geometry / font resolution — read straight from the canonical slide's XML
# --------------------------------------------------------------------------- #
def _emu_in(v):
    return round(Emu(v).inches, 4) if v is not None else None


def _first_attr(body, tags, attr):
    """First value of `attr` found on any of `tags` inside a txBody."""
    for tag in tags:
        for el in body.findall(".//" + qn(tag)):
            val = el.get(attr)
            if val:
                return val
    return None


# Google exports write "Arial" (and sometimes Times New Roman) as a meaningless
# run/layout/theme default; the REAL face lives on the master placeholder. Treat
# these as "not set" so we fall through to the master.
BOGUS_FACES = {"arial", "times new roman", "calibri"}


def _first_typeface(body, tags):
    if body is None:
        return None
    for tag in tags:
        for el in body.findall(".//" + qn(tag)):
            latin = el.find(qn("a:latin"))
            face = latin.get("typeface") if latin is not None else None
            if face and face.lower() not in BOGUS_FACES:
                return face
    return None


def _master_typeface(shp, slide):
    """Resolve the real font face from the slide master placeholder matching this
    shape's placeholder idx (then type). Titles map to Libre Baskerville, body to
    Inter in the Attentive deck — the run/layout copies say 'Arial' and lie."""
    try:
        if not shp.is_placeholder:
            return None
        idx = shp.placeholder_format.idx
        ptype = shp.placeholder_format.type
    except Exception:
        return None
    try:
        master = slide.slide_layout.slide_master
    except Exception:
        return None
    by_type = None
    for ph in master.placeholders:
        pf = ph.placeholder_format
        body = ph._element.find(".//" + qn("p:txBody"))
        face = _first_typeface(body, ("a:defRPr", "a:rPr", "a:endParaRPr"))
        if face is None:
            continue
        if pf.idx == idx:
            return face
        if by_type is None and pf.type == ptype:
            by_type = face
    return by_type


def _layout_ph_defrpr(shp, slide):
    """The matching layout placeholder's defRPr element, or None."""
    try:
        if not shp.is_placeholder:
            return None
        idx = shp.placeholder_format.idx
    except Exception:
        return None
    try:
        for ph in slide.slide_layout.placeholders:
            if ph.placeholder_format.idx == idx:
                b = ph._element.find(".//" + qn("p:txBody"))
                if b is None:
                    return None
                dr = b.find(".//" + qn("a:defRPr"))
                return dr
    except Exception:
        return None
    return None


def resolve_slot(shp, slide) -> dict:
    """Measure the real box a text key will live in: width, height, font size
    (pt), font face (with weight), and the bullet hanging-indent if any.

    Resolution order for size/face: the run/end-paragraph properties on the
    slide, then the layout placeholder's defRPr (which is where Google-exported
    decks keep the inherited size). Geometry always comes from the shape.
    """
    body = shp._element.find(".//" + qn("p:txBody"))
    # size (sz is in hundredths of a point)
    sz = _first_attr(body, ("a:rPr", "a:endParaRPr", "a:defRPr"), "sz")
    face = _first_typeface(body, ("a:rPr", "a:endParaRPr", "a:defRPr"))
    if sz is None or face is None:
        dr = _layout_ph_defrpr(shp, slide)
        if dr is not None:
            if sz is None and dr.get("sz"):
                sz = dr.get("sz")
            if face is None:
                latin = dr.find(qn("a:latin"))
                cand = latin.get("typeface") if latin is not None else None
                if cand and cand.lower() not in BOGUS_FACES:
                    face = cand
    size_pt = (int(sz) / 100.0) if sz else None
    # The real face for placeholders lives on the master (run/layout say Arial).
    # But the master TITLE placeholder is Libre Baskerville, which is only right
    # for LARGE display titles (covers, section headers). Content "headers" reuse
    # the TITLE placeholder yet render as Inter SemiBold at ~22.5pt — so only
    # inherit the serif master face for big titles; smaller ones default to Inter.
    if face is None:
        m = _master_typeface(shp, slide)
        if m and "baskerville" in m.lower() and (not size_pt or size_pt < 28):
            m = None
        face = m
    font = face or "Inter"

    # hanging indent (bullets) — first paragraph marL, if present
    marL_in = 0.0
    first_p = body.find(qn("a:p")) if body is not None else None
    if first_p is not None:
        ppr = first_p.find(qn("a:pPr"))
        if ppr is not None and ppr.get("marL"):
            marL_in = round(Emu(int(ppr.get("marL"))).inches, 4)

    w = _emu_in(shp.width)
    h = _emu_in(shp.height)
    slot = {"font": font, "w": w or 4.0, "h": h, "marL": marL_in}
    if size_pt:
        slot["size"] = size_pt
        # Calibrate line capacity to the deck's own dense boxes: these layouts
        # are set near single spacing, so a height/size ratio matches the
        # designer's intended line count (slide 131 header -> 4 lines).
        if h:
            slot["expected_lines"] = max(1, round(h / (size_pt / 72.0)))
    return slot


# --------------------------------------------------------------------------- #
# key -> shape matching (mirrors template_deck.replace_text)
# --------------------------------------------------------------------------- #
def _shape_text(shp) -> str:
    return shp.text_frame.text if shp.has_text_frame else ""


def find_shapes_for_key(slide, key: str):
    """Every text shape whose current copy contains `key` (substring), matching
    how replace_text locates a placeholder."""
    hits = []
    for shp in slide.shapes:
        if not shp.has_text_frame:
            continue
        paragraphs = ["".join(r.text for r in p.runs)
                      for p in shp.text_frame.paragraphs]
        if key and any(key in paragraph for paragraph in paragraphs):
            hits.append(shp)
    return hits


# --------------------------------------------------------------------------- #
# paragraph-level resolution (so bullets are measured per-item, not per-box)
# --------------------------------------------------------------------------- #
def _para_text(p) -> str:
    return "".join(r.text for r in p.runs)


def _is_bullet_item(p) -> bool:
    """True if this paragraph renders as a bullet: it carries a real bullet glyph
    or a hanging indent (marL > 0). buNone / marL 0 (card titles, prose) → False."""
    ppr = p._p.find(qn("a:pPr"))
    if ppr is None:
        return False
    if ppr.find(qn("a:buNone")) is not None:
        return False
    if ppr.find(qn("a:buChar")) is not None or ppr.find(qn("a:buAutoNum")) is not None:
        return True
    marL = ppr.get("marL")
    return bool(marL and int(marL) > 0)


def _bullet_items(shp):
    """Non-empty bullet paragraphs in a shape."""
    if not shp.has_text_frame:
        return []
    return [p for p in shp.text_frame.paragraphs
            if _para_text(p).strip() and _is_bullet_item(p)]


def _find_paragraph(shp, key: str):
    """The paragraph whose current copy contains `key`."""
    if not shp.has_text_frame:
        return None
    for p in shp.text_frame.paragraphs:
        if key and key in _para_text(p):
            return p
    return None


def _resolve_para_font(p, shp, slide):
    """(size_pt, face) for a specific paragraph — its own run props first, then
    the shape/master fallback used for the whole box."""
    sz = face = None
    for r in p.runs:
        rpr = r._r.find(qn("a:rPr"))
        if rpr is not None:
            if sz is None and rpr.get("sz"):
                sz = rpr.get("sz")
            if face is None:
                latin = rpr.find(qn("a:latin"))
                cand = latin.get("typeface") if latin is not None else None
                if cand and cand.lower() not in BOGUS_FACES:
                    face = cand
    box = resolve_slot(shp, slide)  # shape/master fallback
    size_pt = (int(sz) / 100.0) if sz else box.get("size")
    return size_pt, (face or box.get("font", "Inter"))


_HINT_RANGE = re.compile(r"(\d{2,3})\s*[-–—]\s*(\d{2,3})\s*character", re.I)
_HINT_ONE = re.compile(r"(?:roughly|about|approx\.?|~)?\s*(\d{2,3})\s*character",
                       re.I)


def _parse_char_hint(text: str):
    """Pull an authoritative cap out of a canonical placeholder that states its
    own limit, e.g. 'must be 75-85 characters' -> 85, 'roughly 110 characters'
    -> 110. Returns None if the placeholder carries no such hint."""
    if not text:
        return None
    m = _HINT_RANGE.search(text)
    if m:
        return int(m.group(2))
    m = _HINT_ONE.search(text)
    if m:
        return int(m.group(1))
    return None


# --------------------------------------------------------------------------- #
# fit decision (shared) — with a grace band so tiny overages read as TIGHT
# --------------------------------------------------------------------------- #
def _decide(n: int, cap):
    if not cap or n <= cap:
        return "OK", 0
    ov = n - cap
    if ov <= max(2, round(0.05 * cap)):
        return "TIGHT", ov
    if n <= 1.25 * cap:
        return "COMPRESS", ov
    return "SPLIT", ov


# --------------------------------------------------------------------------- #
# one-line content-header check — mirrors the builder's fit_titles auto-fit
# --------------------------------------------------------------------------- #
def _header_one_line(slide, shp, new_text: str, slide_w_in: float):
    """One-line verdict for a content header, measured the SAME way the builder
    widens it (fit_titles.is_content_header / available_width, SemiBold model):
    can the replacement copy sit on ONE line at the widest this box could grow?

    The builder auto-widens a short header into the free space beside it, so a
    header only fails if it is too long to be one line even fully widened — in
    which case the fix is to shorten the copy. Returns a field dict, or None if
    the shape isn't a one-line header or can't be measured (fall back to the
    normal box path — e.g. the canonical 4-line workhorse header on slide 131,
    which is intentionally multi-line and left alone)."""
    if not fit_titles.is_content_header(shp):
        return None
    size_pt = fit_titles._size_pt(shp)
    cpi, _ = fit_text.chars_per_inch(fit_titles.HEADER_WEIGHT_FACE, size_pt or 0)
    if not size_pt or not cpi:
        return None
    avail = fit_titles.available_width(slide, shp, slide_w_in)
    usable = max(0.1, avail - 2 * fit_titles.PAD_IN)
    cap = max(1, int(usable * cpi))
    longest = max((len(s) for s in (new_text or "").split("\n")), default=0)
    status, ov = _decide(longest, cap)
    return {
        "status": status, "chars": longest, "cap": cap, "overflow": ov,
        "size_pt": size_pt, "avail_in": round(avail, 2),
    }


# --------------------------------------------------------------------------- #
# linting
# --------------------------------------------------------------------------- #
def lint_field(slide, key: str, new_text: str, shp=None, slide_w_in=None) -> dict:
    n = len(new_text or "")
    if shp is None:
        hits = find_shapes_for_key(slide, key)
        if not hits:
            return {"key": key, "status": "NO-MATCH", "chars": n}
        shp = hits[0]
        multi = len(hits) > 1
    else:
        # scoped to a named shape (per-shape fills): confirm the key is present
        if key and key not in "".join(
            r.text for p in shp.text_frame.paragraphs for r in p.runs
        ):
            return {"key": key, "status": "NO-MATCH", "chars": n, "shape": shp.name}
        multi = False
    para = _find_paragraph(shp, key)

    # Per-bullet path: a key that lands on a bullet inside a multi-item list box
    # is measured against ITS bullet's cap, not the whole box.
    if para is not None and _is_bullet_item(para) and len(_bullet_items(shp)) >= 2:
        size_pt, face = _resolve_para_font(para, shp, slide)
        w = _emu_in(shp.width) or 4.0
        ppr = para._p.find(qn("a:pPr"))
        marL = round(Emu(int(ppr.get("marL"))).inches, 4) \
            if (ppr is not None and ppr.get("marL")) else 0.0
        cpl = fit_text.chars_per_line(face, size_pt or 10.0, w, indent_in=marL)
        # authoritative cap if the placeholder states one; else a two-line bullet
        cap = _parse_char_hint(_para_text(para)) or (cpl * 2 if cpl else None)
        status, ov = _decide(n, cap)
        return {
            "key": key, "shape": shp.name, "status": status, "chars": n,
            "cap": cap, "overflow": ov, "size_pt": size_pt, "font": face,
            "box_in": [w, None], "multi_match": multi, "item": "bullet",
        }

    # Content-header path: a short top-left title/subtitle box the builder will
    # auto-widen onto ONE line. Measure it as a one-line field at its max widened
    # width (same helper the builder uses) so a header too long to ever be one
    # line is flagged here — the fix is to shorten it. Needs the slide width;
    # without it (legacy callers) fall through to the box path.
    if slide_w_in is not None:
        hdr = _header_one_line(slide, shp, new_text, slide_w_in)
        if hdr is not None:
            return {
                "key": key, "shape": shp.name, "status": hdr["status"],
                "chars": hdr["chars"], "cap": hdr["cap"],
                "overflow": hdr["overflow"], "size_pt": hdr["size_pt"],
                "font": fit_titles.HEADER_WEIGHT_FACE,
                "box_in": [hdr["avail_in"], None], "multi_match": multi,
                "item": "header",
            }

    # Whole-box path (titles, subtitles, prose, quotes, single fields).
    slot = resolve_slot(shp, slide)
    rep = fit_text.fit_report(new_text or "", slot)
    # An authoritative cap stated in the placeholder (e.g. "roughly 110
    # characters") beats the geometry estimate and sidesteps weight ambiguity.
    cap = _parse_char_hint(_shape_text(shp)) or rep["cap"]
    status, ov = _decide(rep["chars"], cap)
    return {
        "key": key, "shape": shp.name, "status": status, "chars": rep["chars"],
        "cap": cap, "overflow": ov, "size_pt": slot.get("size"),
        "font": slot.get("font"), "box_in": [slot.get("w"), slot.get("h")],
        "multi_match": multi, "item": "box",
    }


def lint_plan(plan_path: str) -> dict:
    plan_file = Path(plan_path).expanduser().resolve()
    plan = json.loads(plan_file.read_text())
    template = plan.get("template", DEFAULT_TEMPLATE)
    # resolve the template path the same way the builder does
    tp = None
    requested = Path(template).expanduser()
    if requested.is_absolute():
        candidates = [requested]
    elif template == DEFAULT_TEMPLATE:
        candidates = [HERE / template, HERE.parent / template,
                      plan_file.parent / requested, requested]
    else:
        candidates = [plan_file.parent / requested, requested,
                      HERE / requested, HERE.parent / requested]
    for cand in candidates:
        if cand.exists():
            tp = cand.resolve()
            break
    if tp is None:
        raise FileNotFoundError(f"Canonical template not found: {template}")
    prs = Presentation(str(tp))
    n_canon = len(prs.slides._sldIdLst)
    slide_w_in = prs.slide_width / fit_titles.EMU_PER_IN

    report = {"template": template, "slides": [], "counts": {}}
    for i, step in enumerate(plan["slides"], 1):
        num = step.get("template_slide")
        s = {"index": i, "template_slide": num, "note": step.get("note", ""),
             "fields": [], "images": []}
        if not isinstance(num, int) or not (1 <= num <= n_canon):
            s["error"] = f"template_slide {num} out of range 1..{n_canon}"
            report["slides"].append(s)
            continue
        slide = prs.slides[num - 1]
        for key, val in (step.get("text") or {}).items():
            s["fields"].append(lint_field(slide, key, val, slide_w_in=slide_w_in))
        # per-shape scoped fills — measure each against its named shape's box
        by_name = {sh.name: sh for sh in slide.shapes}
        for shape_name, repl in (step.get("shapes") or {}).items():
            shp = by_name.get(shape_name)
            for key, val in repl.items():
                if shp is None:
                    s["fields"].append({"key": f"{shape_name}", "status": "NO-MATCH",
                                        "chars": len(val or "")})
                else:
                    s["fields"].append(
                        lint_field(slide, key, val, shp=shp, slide_w_in=slide_w_in))
        # image shape-name existence
        shape_names = {sh.name for sh in slide.shapes}
        for shape_name in (step.get("images") or {}):
            s["images"].append(
                {"shape": shape_name, "status": "OK" if shape_name in shape_names
                 else "NO-MATCH"}
            )
        report["slides"].append(s)

    # tally
    tally = {"OK": 0, "TIGHT": 0, "COMPRESS": 0, "SPLIT": 0,
             "NO-MATCH": 0, "ERROR": 0}
    for s in report["slides"]:
        if s.get("error"):
            tally["ERROR"] += 1
        for f in s["fields"]:
            tally[f["status"]] = tally.get(f["status"], 0) + 1
        for im in s["images"]:
            if im["status"] == "NO-MATCH":
                tally["NO-MATCH"] += 1
    report["counts"] = tally
    report["clean"] = (tally["COMPRESS"] == 0 and tally["SPLIT"] == 0
                       and tally["NO-MATCH"] == 0 and tally["ERROR"] == 0)
    report["variety"] = variety_report(plan["slides"])
    report["transitions"] = transitions_report(plan["slides"])
    report["vividness"] = antibland.vividness_report(plan["slides"])
    # A deck is only OK to build when it fits AND isn't monotonous AND uses a
    # consistent transition system AND isn't bland (low-impact / proof-free).
    # Each of these blocks the build like overflow does (override with --force).
    # The anti-bland gate can be toggled off via antibland.GATE_ON_VIVIDNESS.
    report["ok_to_build"] = (report["clean"]
                             and report["variety"]["ok"]
                             and report["transitions"]["ok"]
                             and (report["vividness"]["ok"]
                                  or not antibland.GATE_ON_VIVIDNESS))
    return report


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #
_ICON = {"OK": "✓", "TIGHT": "≈", "COMPRESS": "~", "SPLIT": "✗", "NO-MATCH": "?"}


def _short(s, n=40):
    s = (s or "").replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


def print_report(report: dict):
    print(f"Pre-flight fit check — {report['template']}")
    print("=" * 68)
    for s in report["slides"]:
        head = f"slide {s['index']:>2}  ·  canonical #{s['template_slide']}"
        if s["note"]:
            head += f"  ({s['note']})"
        print("\n" + head)
        if s.get("error"):
            print(f"   ✗ ERROR: {s['error']}")
            continue
        if not s["fields"] and not s["images"]:
            print("   (no text/image replacements)")
        for f in s["fields"]:
            icon = _ICON.get(f["status"], "?")
            if f["status"] == "NO-MATCH":
                print(f"   {icon} NO-MATCH  key not on this slide: "
                      f"\"{_short(f['key'], 46)}\"")
                continue
            cap = f["cap"]
            detail = f"{f['chars']}/{cap} chars" if cap else f"{f['chars']} chars"
            extra = ""
            if f["status"] == "TIGHT" and f["overflow"]:
                extra = f"  (at the edge, +{f['overflow']})"
            elif f["status"] in ("COMPRESS", "SPLIT") and f["overflow"]:
                extra = f"  (over by {f['overflow']})"
            meta = f"{f['font']} {f['size_pt']}pt" if f.get("size_pt") else f["font"]
            tag = {"bullet": "bullet · ", "header": "1-line · "}.get(
                f.get("item"), "")
            print(f"   {icon} {f['status']:<8} {detail}{extra}"
                  f"   [{tag}{meta}]  →\"{_short(f['key'], 28)}\"")
            if f.get("multi_match"):
                print("       · key matches >1 shape; first measured")
        for im in s["images"]:
            if im["status"] == "NO-MATCH":
                print(f"   ? NO-MATCH  image shape not on slide: \"{im['shape']}\"")

    v = report.get("variety")
    if v is not None:
        print("\n" + "-" * 68)
        cap_note = f"cap {v.get('cap', '?')}/look"
        tb = v.get('text_block_cap')
        if tb is not None and tb < v.get('cap', tb):
            cap_note += f", text_block {tb}"
        print(f"Template variety:  {v.get('distinct_looks', v['distinct_families'])} "
              f"distinct looks ({v['distinct_families']} families) across "
              f"{v['content_slides']} content slides · {cap_note}")
        if v["warnings"]:
            for w in v["warnings"]:
                print(f"   ⚠ MONOTONY  {w}")
            print("   → vary the template families so pass 1 isn't repetitive "
                  "(see attentive-slide-design archetypes → 'Deck variety'). "
                  "This BLOCKS the build unless --force.")
        else:
            print("   ✓ good spread — no look overused")

    t = report.get("transitions")
    if t is not None:
        print(f"\nSection transitions:  {t['dividers']} progress divider(s) "
              f"({t['dividers_active']} highlighted) · {t['breakers']} breaker(s)")
        if t["warnings"]:
            for w in t["warnings"]:
                print(f"   ⚠ TRANSITIONS  {w}")
            print("   → commit to ONE transition system (see archetypes → "
                  "'Section transitions').")
        else:
            print("   ✓ consistent transition system")

    vv = report.get("vividness")
    if vv is not None:
        m = vv.get("metrics") or {}
        if m:
            print(f"\nAnti-bland vividness:  mean impact {m.get('mean_body_impact', '?')} · "
                  f"{len(m.get('dataviz_slides', []))} data-viz · "
                  f"{len(m.get('hero_slides', []))} hero · "
                  f"longest flat run {m.get('longest_bland_run', 0)}")
        else:
            print("\nAnti-bland vividness:  (inactive — no scored body slides / no scores file)")
        for w in vv.get("hard", []):
            print(f"   ⛔ BLAND  {w}")
        for w in vv.get("warnings", []):
            print(f"   ⚠ bland   {w}")
        if not vv.get("hard") and not vv.get("warnings"):
            print("   ✓ vivid enough — impact, proof, and pacing hold up")
        elif vv.get("hard"):
            print("   → route a metric-bearing or single-idea slide to a vivid template "
                  "(stat/KPI/chart/statement/quote). This BLOCKS the build unless --force.")
        else:
            print("   → advisory only; the notes above do not block the build")

    c = report["counts"]
    print("\n" + "=" * 68)
    print(f"Summary:  ✓ {c['OK']} ok   ≈ {c.get('TIGHT', 0)} tight   "
          f"~ {c['COMPRESS']} compress   ✗ {c['SPLIT']} split   "
          f"? {c['NO-MATCH']} no-match   ⚠ {c['ERROR']} error")
    if report.get("ok_to_build", report["clean"]):
        print("Result:   CLEAN — safe to build.")
    else:
        tips = []
        if c["COMPRESS"]:
            tips.append("tighten COMPRESS fields")
        if c["SPLIT"]:
            tips.append("SPLIT fields need a denser template or a slide split")
        if c["NO-MATCH"]:
            tips.append("fix NO-MATCH keys via `--inspect <N>`")
        if c["ERROR"]:
            tips.append("fix out-of-range slides")
        if not report.get("variety", {}).get("ok", True):
            tips.append("diversify the templates flagged under MONOTONY")
        if not report.get("transitions", {}).get("ok", True):
            tips.append("use one consistent transition system")
        if not report.get("vividness", {}).get("ok", True) and antibland.GATE_ON_VIVIDNESS:
            tips.append("lift the flagged BLAND slides onto vivid templates")
        print("Result:   NEEDS WORK — " + "; ".join(tips) + ".")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    plan_path = args[0]
    as_json = "--json" in args
    strict = "--strict" in args
    strict_variety = "--strict-variety" in args
    report = lint_plan(plan_path)
    if as_json:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)
    if strict and not report["clean"]:
        sys.exit(1)
    if strict_variety and not (report.get("variety", {}).get("ok", True)
                               and report.get("transitions", {}).get("ok", True)):
        sys.exit(1)


if __name__ == "__main__":
    main()
