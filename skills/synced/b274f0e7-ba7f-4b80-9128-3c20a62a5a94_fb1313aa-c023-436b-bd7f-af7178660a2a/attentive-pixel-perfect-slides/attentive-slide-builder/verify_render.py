#!/usr/bin/env python3
"""verify_render.py — assert on the BUILT deck, not on the plan.

WHY THIS EXISTS
---------------
Rebranding the AI Guild deck produced eleven defects. Tallying how each was
actually caught:

    rendering and looking at it ... 7   (slot order ×2, inherited crops,
                                        white-box backgrounds, surviving stock
                                        photos, grey empty frames, title wraps)
    the existing pre-flight ....... 3   (overflow, unmatched keys, bland deck)
    a human asking a question ..... 1   (a source graphic silently dropped)

`preflight_lint.py` reasons about the PLAN before the build and is good at fit.
Everything else was invisible until something was rendered and inspected. This
closes that gap with checks that need no judgement.

Two layers, because most of it does not actually need a renderer:

  STATIC (exact, fast — reads the .pptx)
    1. leftover canonical dummy text anywhere in the output
    2. plan key order vs on-slide reading order for repeated slots
    3. picture placeholders still empty (they render as grey boxes)
    4. inherited crops on a replaced image
    5. canonical stock photos surviving into the output

  RENDER (needs soffice + pdf2image; use --render)
    6. uniform-colour picture frames (empty or a flat pale box)
    7. picture frames that do not match the page background where they should

    python verify_render.py out.pptx
    python verify_render.py out.pptx --plan plan.json      # enables check 2
    python verify_render.py out.pptx --plan plan.json --render
    python verify_render.py out.pptx --strict              # exit 1 on warnings

Exit code is 1 if any ERROR is found (or any warning under --strict), so this can
gate a build in CI.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

from pptx import Presentation

try:
    from pptx.enum.shapes import MSO_SHAPE_TYPE
except ImportError:  # pragma: no cover
    MSO_SHAPE_TYPE = None

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_NAME = "Template—2026 NEW Attentive Company Deck Template.pptx"


def _resolve_template(name=TEMPLATE_NAME):
    """Find the template next to this script or one level up."""
    for cand in (name, os.path.join(HERE, name), os.path.join(HERE, "..", name)):
        if os.path.isfile(cand):
            return cand
    return os.path.join(HERE, name)


TEMPLATE = _resolve_template()
EMU_PER_IN = 914400.0

# Generic filler that betrays an unfilled slot even if the exact canonical string
# was edited. Kept deliberately narrow to avoid false hits on real copy.
GENERIC_FILLER = [
    re.compile(r"\bLorem ipsum\b", re.I),
    re.compile(r"\bdolor sit amet\b", re.I),
    re.compile(r"^Topic\s*\d*$", re.I),
    re.compile(r"^Thing\s*\d+$", re.I),
    re.compile(r"^Content Here$", re.I),
    re.compile(r"^Title of [Ss]ection$"),
    re.compile(r"^Subtitle$"),
    re.compile(r"\bPoint number \d\b", re.I),
    re.compile(r"\bUpcoming feature number\b", re.I),
    re.compile(r"[<~]\s*\d+\s*char", re.I),
    re.compile(r"\bXX+%|\bXXX%"),
    re.compile(r"^Insert .*here\.?$", re.I),
    re.compile(r"\bFirst_name last_name\b", re.I),
    re.compile(r"\bmust be \d+-\d+ characters\b", re.I),
    re.compile(r"^Section name$|^goes here$", re.I),
    re.compile(r"^Name$|^Company, Title$", re.I),
    re.compile(r"^40M total$|^100M total$|^Lorem$", re.I),
]


class Report:
    def __init__(self):
        self.rows = []

    def add(self, level, check, slide, msg):
        self.rows.append((level, check, slide, msg))

    @property
    def errors(self):
        return [r for r in self.rows if r[0] == "ERROR"]

    @property
    def warns(self):
        return [r for r in self.rows if r[0] == "WARN"]

    def print(self):
        if not self.rows:
            print("  ✓ all checks clean")
            return
        by_check = collections.defaultdict(list)
        for level, check, slide, msg in self.rows:
            by_check[check].append((level, slide, msg))
        for check, items in by_check.items():
            print(f"\n  {check}")
            for level, slide, msg in items:
                mark = "✗" if level == "ERROR" else "⚠"
                where = f"slide {slide}" if slide else "deck"
                print(f"    {mark} {where}: {msg}")


def _in(v):
    return (v or 0) / EMU_PER_IN


def _shape_texts(slide):
    for shp in slide.shapes:
        if getattr(shp, "has_text_frame", False):
            for para in shp.text_frame.paragraphs:
                t = para.text.strip()
                if t:
                    yield shp.name, t
        if getattr(shp, "has_table", False):
            for row in shp.table.rows:
                for cell in row.cells:
                    t = cell.text.strip()
                    if t:
                        yield shp.name, t


# --------------------------------------------------------------------------- #
# 1. leftover canonical dummy text
# --------------------------------------------------------------------------- #
def check_dummy_text(prs, canonical_strings, rep):
    """The single cheapest high-value check: nothing verified that the shipped
    deck contains no template filler. An unfilled slot is silent otherwise —
    it just reads as a real slide with odd copy."""
    for i, slide in enumerate(prs.slides, 1):
        for shape_name, text in _shape_texts(slide):
            hit = None
            if text in canonical_strings:
                hit = f"exact canonical placeholder still present: {text[:60]!r}"
            else:
                for pat in GENERIC_FILLER:
                    if pat.search(text):
                        hit = f"filler text {text[:60]!r} (matched {pat.pattern})"
                        break
            if hit:
                rep.add("ERROR", "leftover dummy text", i,
                        f"{shape_name.split(';')[1] if ';' in shape_name else shape_name} — {hit}")


# --------------------------------------------------------------------------- #
# 2. plan key order vs on-slide reading order
# --------------------------------------------------------------------------- #
def check_semantics(plan, facts, rep):
    """Flag canonical slides whose MEANING is easy to misuse.

    Two of this session's defects passed every fit check while saying the wrong
    thing: canonical 149 is the red-✕ negative twin of 150's green-✓ layout, and
    canonical 142 badges its last two rows as roadmap items. Both look correct in
    a plan diff and only betray themselves on screen. There is no way to infer
    the author's intent, so these are warnings asking for confirmation — not
    errors.
    """
    for idx, step in enumerate(plan.get("slides", []), 1):
        num = str(step.get("template_slide"))
        f = facts["slides"].get(num)
        if not f:
            continue
        note = step.get("note", "")
        if f["polarity"] == "negative":
            rep.add("WARN", "slide semantics", idx,
                    f"canonical {num} is the NEGATIVE variant "
                    f"(bullet glyph {'/'.join(f['bullet_glyphs']) or '—'}) — "
                    f"confirm the content is negative{f' [{note}]' if note else ''}")
        if f["has_roadmap_badge"]:
            rep.add("WARN", "slide semantics", idx,
                    f"canonical {num} badges its last rows as roadmap items — "
                    f"confirm those rows are future/upcoming"
                    f"{f' [{note}]' if note else ''}")
        stock = [s for s in f["image_slots"] if s["ships_filled"]]
        addressed = set((step.get("images") or {}).keys())
        unreplaced = [s["shape"] for s in stock if s["shape"] not in addressed]
        if unreplaced:
            rep.add("WARN", "slide semantics", idx,
                    f"canonical {num} ships {len(unreplaced)} stock photo(s) not "
                    f"replaced by this plan "
                    f"({', '.join(n.split(';')[1] for n in unreplaced)}) — they will ship")


def check_slot_order(plan, facts, rep):
    """Repeated slots are addressed by shape name, and shape-id order is NOT
    left-to-right order. This shuffled content twice in one deck: canonical 150's
    stage columns run 3303 / 3311 / 3307 and 152's image slots run
    3338 / 3337 / 3341. Authors write content in reading order, so a plan whose
    key order differs from reading order is almost always a shuffle."""
    for idx, step in enumerate(plan.get("slides", []), 1):
        num = str(step.get("template_slide"))
        f = facts["slides"].get(num)
        if not f:
            continue
        groups = list(f["repeated_groups"])
        groups.append({"arity": len(f["image_slots"]),
                       "reading_order": [s["shape"] for s in f["image_slots"]],
                       "sample": "image slots"})
        for source in ("shapes", "runs", "images"):
            keys = list((step.get(source) or {}).keys())
            if len(keys) < 2:
                continue
            for g in groups:
                order = g["reading_order"]
                addressed = [k for k in keys if k in order]
                if len(addressed) < 2:
                    continue
                expected = [s for s in order if s in addressed]
                if addressed != expected:
                    rep.add("ERROR", "slot order", idx,
                            f"canonical {num}: `{source}` keys are in "
                            f"{[k.split(';')[1] for k in addressed]} order but "
                            f"reading order is "
                            f"{[k.split(';')[1] for k in expected]} "
                            f"({g['arity']}-slot group) — content is probably shuffled")


# --------------------------------------------------------------------------- #
# 3-5. image integrity
# --------------------------------------------------------------------------- #
def canonical_image_hashes(template):
    """Hashes of every photo the template itself ships, so a stock photo that
    survived into the output can be recognised."""
    out = set()
    try:
        prs = Presentation(template)
    except Exception:
        return out
    for slide in prs.slides:
        for shp in slide.shapes:
            if MSO_SHAPE_TYPE and shp.shape_type == MSO_SHAPE_TYPE.PICTURE:
                try:
                    out.add(hashlib.md5(shp.image.blob).hexdigest())
                except Exception:
                    pass
    return out


def _carries_blip(shape) -> bool:
    """True if the shape references an image at all.

    A picture placeholder can hold its image two ways: as a `<p:pic>` element,
    which python-pptx reports as shape_type PICTURE, or as a `blipFill` on the
    shape's own fill, which it still reports as an unfilled PLACEHOLDER. Canonical
    34 uses the second form — its circle photo renders perfectly while every API
    check calls it empty — so testing shape_type alone cries wolf.
    """
    try:
        return 'r:embed="' in shape._element.xml
    except (AttributeError, ValueError):
        return False


def check_images(prs, stock_hashes, rep):
    for i, slide in enumerate(prs.slides, 1):
        for shp in slide.shapes:
            w, h = _in(shp.width), _in(shp.height)
            if w * h < 0.6:
                continue
            # 3 — placeholder never filled
            try:
                if shp.is_placeholder and "PICTURE" in str(shp.placeholder_format.type):
                    if (MSO_SHAPE_TYPE and shp.shape_type != MSO_SHAPE_TYPE.PICTURE
                            and not _carries_blip(shp)):
                        rep.add("WARN", "empty picture frame", i,
                                f"{shp.name.split(';')[1]} ({w:.1f}x{h:.1f}in) is an "
                                f"unfilled picture placeholder — renders as a grey box")
                        continue
            except (AttributeError, ValueError):
                pass
            if not (MSO_SHAPE_TYPE and shp.shape_type == MSO_SHAPE_TYPE.PICTURE):
                continue
            # 4 — inherited crop on a replaced image
            crop = {}
            for side in ("left", "right", "top", "bottom"):
                try:
                    crop[side] = float(getattr(shp, f"crop_{side}") or 0.0)
                except (AttributeError, TypeError):
                    crop[side] = 0.0
            try:
                iw, ih = shp.image.size
                img_ar, frame_ar = iw / ih, w / h
                fitted = abs(img_ar - frame_ar) / frame_ar < 0.02
                asym = (abs(crop["left"] - crop["right"]) > 0.02
                        or abs(crop["top"] - crop["bottom"]) > 0.02)
                if fitted and any(v > 0.01 for v in crop.values()):
                    rep.add("ERROR", "inherited crop", i,
                            f"{shp.name.split(';')[1]} image already matches the "
                            f"frame aspect yet is cropped "
                            f"{ {k: round(v,2) for k,v in crop.items()} } — "
                            f"almost certainly the previous photo's crop")
                elif asym and max(crop.values()) > 0.25:
                    rep.add("WARN", "inherited crop", i,
                            f"{shp.name.split(';')[1]} has a large asymmetric crop "
                            f"{ {k: round(v,2) for k,v in crop.items()} } — check it "
                            f"is intended and not the previous photo's framing")
                # 5 — a canonical stock photo shipped
                h5 = hashlib.md5(shp.image.blob).hexdigest()
                if h5 in stock_hashes:
                    rep.add("WARN", "stock photo shipped", i,
                            f"{shp.name.split(';')[1]} still holds a photo from the "
                            f"canonical template — intended, or an unreplaced slot?")
            except Exception:
                pass


# --------------------------------------------------------------------------- #
# 6-7. render checks
# --------------------------------------------------------------------------- #
def render_pages(pptx_path, dpi=80):
    from pdf2image import convert_from_path
    with tempfile.TemporaryDirectory(prefix="verify_render_") as tmp:
        try:
            subprocess.run(["soffice", "--headless", "--convert-to", "pdf",
                            "--outdir", tmp, pptx_path],
                           check=False, capture_output=True, timeout=540)
        except (OSError, subprocess.SubprocessError):
            return None
        pdfs = [f for f in os.listdir(tmp) if f.endswith(".pdf")]
        if not pdfs:
            return None
        return convert_from_path(os.path.join(tmp, pdfs[0]), dpi=dpi)


def check_rendered(prs, pages, rep, dpi=80):
    """Catches what only pixels show. The motivating case: three image panels
    composited on transparency rendered as pale near-white boxes (253,253,253)
    on a cream page (252,250,238) — invisible in the XML, obvious on screen."""
    import numpy as np
    for i, (slide, page) in enumerate(zip(prs.slides, pages), 1):
        arr = np.array(page.convert("RGB")).astype(int)
        ph, pw = arr.shape[:2]
        # page background = modal colour of a thin margin strip
        margin = np.concatenate([arr[2:14, :, :].reshape(-1, 3),
                                 arr[-14:-2, :, :].reshape(-1, 3)])
        bg = tuple(int(v) for v in collections.Counter(map(tuple, margin)).most_common(1)[0][0])
        for shp in slide.shapes:
            if not (MSO_SHAPE_TYPE and shp.shape_type == MSO_SHAPE_TYPE.PICTURE):
                continue
            w, h = _in(shp.width), _in(shp.height)
            if w * h < 0.6:
                continue
            x0 = int(_in(shp.left) / 10.0 * pw)
            y0 = int(_in(shp.top) / 5.625 * ph)
            x1 = int((_in(shp.left) + w) / 10.0 * pw)
            y1 = int((_in(shp.top) + h) / 5.625 * ph)
            x0, y0 = max(0, x0), max(0, y0)
            x1, y1 = min(pw, x1), min(ph, y1)
            if x1 - x0 < 6 or y1 - y0 < 6:
                continue
            region = arr[y0 + 3:y1 - 3, x0 + 3:x1 - 3, :]
            if region.size == 0:
                continue
            std = float(region.reshape(-1, 3).std(axis=0).mean())
            mean = tuple(int(v) for v in region.reshape(-1, 3).mean(axis=0))
            name = shp.name.split(";")[1] if ";" in shp.name else shp.name
            if std < 2.0:
                delta = max(abs(mean[c] - bg[c]) for c in range(3))
                if delta > 4:
                    rep.add("ERROR", "flat picture frame", i,
                            f"{name} renders as a flat block {mean} against page "
                            f"background {bg} — empty frame or a pale box")
                else:
                    rep.add("WARN", "flat picture frame", i,
                            f"{name} renders as flat {mean}, matching the page — "
                            f"image may be invisible")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx")
    ap.add_argument("--plan", help="the plan.json used to build it (enables slot-order check)")
    ap.add_argument("--facts", default=os.path.join(HERE, "slide_facts.json"))
    ap.add_argument("--template", default=TEMPLATE)
    ap.add_argument("--render", action="store_true", help="also run pixel checks")
    ap.add_argument("--strict", action="store_true", help="exit 1 on warnings too")
    args = ap.parse_args()

    prs = Presentation(args.pptx)
    rep = Report()
    print(f"verifying {os.path.basename(args.pptx)} — {len(prs.slides.__iter__.__self__._sldIdLst)} slides")

    canonical_strings = set()
    inv_path = os.path.join(HERE, "inventory.json")
    if os.path.exists(inv_path):
        inv = json.load(open(inv_path))
        for entries in inv.values():
            for _, v in entries:
                for line in str(v).replace("\x0b", "\n").split("\n"):
                    line = line.strip()
                    if len(line) > 3:
                        canonical_strings.add(line)
    check_dummy_text(prs, canonical_strings, rep)

    if args.plan and os.path.exists(args.facts):
        plan = json.load(open(args.plan))
        facts = json.load(open(args.facts))
        check_slot_order(plan, facts, rep)
        check_semantics(plan, facts, rep)
    elif args.plan:
        print("  (no slide_facts.json — run slide_facts.py to enable the slot-order check)")

    check_images(prs, canonical_image_hashes(args.template), rep)

    if args.render:
        pages = render_pages(args.pptx)
        if pages is None:
            rep.add("WARN", "render", None, "could not render (soffice missing?)")
        else:
            check_rendered(prs, pages, rep)

    rep.print()
    n_e, n_w = len(rep.errors), len(rep.warns)
    print(f"\n{n_e} error(s), {n_w} warning(s)")
    if n_e or (args.strict and n_w):
        print("⛔ verification FAILED")
        sys.exit(1)
    print("✓ verification passed")


if __name__ == "__main__":
    main()
