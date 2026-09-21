#!/usr/bin/env python3
"""verify_fills.py — post-build guard for the placeholder-fill pitfalls that have
shipped before (see SKILL.md "Placeholder-fill pitfalls"). It does NOT check
geometry — build_from_plan already preserves that. It checks the *copy* you put
into the duplicated slides:

  1. leftover template placeholders (Lorem/ipsum, "Content aa", "Section 0N",
     "goes here", "Deck title", "Optional …", "Title of section", "Placeholder",
     "XX%", "Thing N", etc.) on a slide you meant to fill;
  2. a title or subtitle line that repeats within a single slide (the
     "Attentive 101 / Attentive 101" duplicate-title / duplicate-subtitle bug).

Usage:
    python verify_fills.py out.pptx                 # scan every slide
    python verify_fills.py out.pptx --skip 1,2,12   # slides intentionally left canonical

Exit code is non-zero if any defect is found, so it can gate a build.
"""
import re, sys
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

def _all(shapes):
    """Recurse into groups so grouped placeholders are checked too."""
    for sh in shapes:
        yield sh
        if sh.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from _all(sh.shapes)

PLACEHOLDER = re.compile(
    r"lorem|ipsum|consectetur|adipiscing|aliquam|proin|aenean|incididunt|"
    r"vestibulum|Content aa|Content bb|Content cc|Content dd|Content ee|"
    r"goes here|Deck title|Section 0\d|Optional (Subtitle|subject)|"
    r"Title of [Ss]ection|Content Here|Placeholder|to be replaced|"
    r"\bXX+%|Thing \d|Role #|Another topic|Glowing quote|Company X|"
    r"Point number|\d+-\d+ character|<\d+ character|Information line|"
    r"Project Thing|Important thing", re.I)

def paragraphs(slide):
    for sh in _all(slide.shapes):
        if sh.has_text_frame:
            for para in sh.text_frame.paragraphs:
                yield "".join(r.text for r in para.runs).strip()
        if getattr(sh, "has_table", False):
            for row in sh.table.rows:
                for cell in row.cells:
                    yield cell.text.strip()

def stacked_dups(slide):
    """A title/subtitle written twice shows up as the SAME non-empty text in two
    consecutive paragraphs of the SAME shape (e.g. a title box filled on both its
    "line 1"/"line 2" paragraphs). Scoping to consecutive same-shape paragraphs
    avoids false alarms on legitimately repeated chart/stat/agenda values that
    live in separate shapes."""
    out = []
    for sh in _all(slide.shapes):
        if not sh.has_text_frame:
            continue
        prev = None
        for para in sh.text_frame.paragraphs:
            t = "".join(r.text for r in para.runs).strip()
            if t and t == prev:
                out.append(t)
            prev = t
    return out

def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    path = args[0]
    skip = set()
    if "--skip" in args:
        skip = {int(x) for x in args[args.index("--skip")+1].split(",") if x.strip()}
    prs = Presentation(path)
    defects = 0
    for i, sl in enumerate(prs.slides, 1):
        if i in skip:
            continue
        texts = [t for t in paragraphs(sl) if t]
        # 1) leftover placeholders
        for t in texts:
            if PLACEHOLDER.search(t):
                print(f"  slide {i}: leftover placeholder -> {t[:60]!r}")
                defects += 1
        # 2) title/subtitle written twice: same text in consecutive paragraphs
        #    of one shape (the "Attentive 101 / Attentive 101" bug)
        for t in stacked_dups(sl):
            print(f"  slide {i}: title/subtitle written twice -> {t!r}")
            defects += 1
        # 3) a table with more than one font size (the "big bottom row" bug)
        for sh in _all(sl.shapes):
            if not getattr(sh, "has_table", False):
                continue
            sizes = {r.font.size for row in sh.table.rows for cell in row.cells
                     for p in cell.text_frame.paragraphs for r in p.runs
                     if r.text.strip() and r.font.size}
            if len(sizes) > 1:
                print(f"  slide {i}: table has {len(sizes)} font sizes (unify them)")
                defects += 1
    if defects:
        print(f"\n✗ {defects} fill defect(s) found. Fix the copy and rebuild.")
        sys.exit(1)
    print(f"✓ No fill defects across {len(prs.slides._sldIdLst)} slides.")

if __name__ == "__main__":
    main()
