#!/usr/bin/env python3
"""polish.py — a narrow, EXPLICITLY-AUTHORIZED polish pass applied to a built
deck. Everything here is a targeted tweak the user asked for that the plan format
can't express (paragraph alignment, table-font consistency). It is a whitelist:
it never touches geometry or formatting the user didn't approve.

Approved tweaks:
  • KPI number cards (canonical 92): center-align the big number so the ▲ marker
    and number read as a centered group instead of sitting off to the left.
  • Data tables (96/97 and any table): force every cell's font to Inter so the
    whole table renders in one typeface (some template cells had no explicit font
    and fell back to a different one).

Usage:  python polish.py out.pptx
"""
import sys
from pptx import Presentation
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# canonical slide -> shape names whose paragraphs should be center-aligned
CENTER_TEXT = {
    92: {"Google Shape;2277;p291", "Google Shape;2279;p291", "Google Shape;2280;p291"},
}
# canonical slide -> shapes that should be TOP-anchored so text sits directly
# under the timeline bar (bottom-anchored boxes leave a gap under the bar)
ANCHOR_TOP = {
    163: {"Google Shape;3580;p362", "Google Shape;3581;p362",
          "Google Shape;3582;p362", "Google Shape;3583;p362"},
}

def center_numbers(prs):
    n = 0
    for slide_no, names in CENTER_TEXT.items():
        if slide_no > len(prs.slides._sldIdLst):
            continue
        sl = prs.slides[slide_no - 1]
        for sh in sl.shapes:
            if sh.name in names and sh.has_text_frame:
                for para in sh.text_frame.paragraphs:
                    para.alignment = PP_ALIGN.CENTER
                    n += 1
    return n

def anchor_top(prs):
    n = 0
    for slide_no, names in ANCHOR_TOP.items():
        if slide_no > len(prs.slides._sldIdLst):
            continue
        for sh in prs.slides[slide_no - 1].shapes:
            if sh.name in names and sh.has_text_frame:
                sh.text_frame.vertical_anchor = MSO_ANCHOR.TOP
                n += 1
    return n

def unify_table_fonts(prs, font="Inter"):
    """One typeface AND one size per table. Some template cells had no explicit
    font/size and fell back to a larger default (the "big bottom row" bug), so we
    set every run to Inter at the table's most common existing size."""
    from collections import Counter
    n = 0
    for sl in prs.slides:
        for sh in sl.shapes:
            if not getattr(sh, "has_table", False):
                continue
            tbl = sh.table
            sizes = Counter()
            for row in tbl.rows:
                for cell in row.cells:
                    for para in cell.text_frame.paragraphs:
                        for run in para.runs:
                            if run.font.size:
                                sizes[run.font.size] += 1
            dom = sizes.most_common(1)[0][0] if sizes else None
            for row in tbl.rows:
                for cell in row.cells:
                    for para in cell.text_frame.paragraphs:
                        for run in para.runs:
                            if run.text.strip():
                                run.font.name = font
                                if dom:
                                    run.font.size = dom
                                n += 1
    return n

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    path = sys.argv[1]
    prs = Presentation(path)
    a = center_numbers(prs)
    b = unify_table_fonts(prs)
    d = anchor_top(prs)
    prs.save(path)
    print(f"polish: centered {a} number paragraph(s); set {b} table run(s) to Inter; "
          f"top-anchored {d} timeline box(es).")

if __name__ == "__main__":
    main()
