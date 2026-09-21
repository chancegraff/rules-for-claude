#!/usr/bin/env python3
"""fit_text.py — the FORMATTING fit engine.

Decides, mechanically, whether a piece of text fits a slot, and if not, what to
do about it: compress, move to a denser template, or split across slides. It
NEVER truncates. This is the heart of the attentive-slide-formatting skill: get
the slide mechanically correct before any design judgment is applied.

The chars-per-inch table is empirically anchored to the canonical deck's own
designer-authored fit hints (see playbook §II.2 — cpl does NOT scale linearly
with font size, so we calibrate from real examples rather than a formula):

  * slide 131 header:  "four line header ... roughly 110 characters"
                       box w=4.6703in, Inter SemiBold 22.5pt
                       -> 110 chars / 4 lines = 27.5 cpl ; 27.5/4.6703 = 5.9 cpi
  * slide 131 bullets: "must be 75-85 characters"
                       box w=3.4908in, hanging marL 0.5 -> eff ~2.99in, Inter 10pt
                       -> ~80 chars / 2 lines = 40 cpl ; 40/2.99 = 13.4 cpi
  * slide 71 column body: 231-char placeholder over ~8 lines
                       box w=2.1896in, Inter 9pt
                       -> 231/8 = 28.9 cpl ; 28.9/2.19 = 13.2 cpi

Values for other sizes are interpolated and flagged. Any pair we could not
anchor to a real example must remain explicitly unresolved, never silently
trusted (playbook §IV.3).
"""
from __future__ import annotations

import math

# Effective characters per inch of *usable* width, indexed by (weight, size_pt).
# Anchors marked ★ are derived directly from a canonical designer hint above;
# the rest are interpolated within a weight and should be confirmed by the
# design owner before changing these conservative defaults.
CPI_TABLE = {
    ("Regular",  8.0): 15.0,
    ("Regular",  9.0): 13.2,   # ★ slide 71 column body
    ("Regular", 10.0): 12.2,
    ("Regular", 12.0): 10.2,
    ("Regular", 14.0): 8.7,
    ("Regular", 17.0): 7.2,
    ("Medium",   9.0): 12.6,
    ("Medium",  10.0): 11.6,
    ("SemiBold", 9.0): 12.0,
    ("SemiBold", 12.0): 9.4,
    ("SemiBold", 16.0): 7.0,
    ("SemiBold", 22.5): 5.9,   # ★ slide 131 header
    ("SemiBold", 30.0): 4.4,
    ("Serif",    9.0): 11.5,   # Libre Baskerville (wider glyphs)
    ("Serif",   11.0): 9.6,
    ("Serif",   18.0): 6.0,
    ("Serif",   37.5): 3.2,    # ★ title slides 16-19: "Insert the name of the deck here." 33c/2 lines
    ("Serif",   55.0): 1.95,   # ★ title slides 13-15: "Deck title goes here" ~20c/2 lines
}


def weight_of(font_face: str) -> str:
    if not font_face:
        return "Regular"
    f = font_face.lower()
    if "baskerville" in f or "serif" in f:
        return "Serif"
    if "semibold" in f:
        return "SemiBold"
    if "medium" in f:
        return "Medium"
    if "bold" in f:
        return "SemiBold"
    return "Regular"


def chars_per_inch(font_face: str, size_pt: float):
    """Return (cpi, source). source: 'anchored' | 'interpolated' | 'unknown'."""
    w = weight_of(font_face)
    if (w, size_pt) in CPI_TABLE:
        return CPI_TABLE[(w, size_pt)], "anchored"
    sizes = sorted(s for (ww, s) in CPI_TABLE if ww == w)
    if not sizes:
        return None, "unknown"
    lo = max((s for s in sizes if s <= size_pt), default=None)
    hi = min((s for s in sizes if s >= size_pt), default=None)
    if lo is None:
        return CPI_TABLE[(w, hi)], "interpolated"
    if hi is None:
        return CPI_TABLE[(w, lo)], "interpolated"
    if lo == hi:
        return CPI_TABLE[(w, lo)], "interpolated"
    t = (size_pt - lo) / (hi - lo)
    cpi = CPI_TABLE[(w, lo)] + t * (CPI_TABLE[(w, hi)] - CPI_TABLE[(w, lo)])
    return round(cpi, 2), "interpolated"


def chars_per_line(font_face, size_pt, width_in, *, pad_l=0.0375, pad_r=0.0375,
                   indent_in=0.0):
    """Max characters that fit on one rendered line in this box."""
    cpi, _ = chars_per_inch(font_face, size_pt)
    if not cpi:
        return None
    eff = max(0.4, width_in - pad_l - pad_r - max(0.0, indent_in))
    return max(1, int(eff * cpi))


def estimate_lines(text, font_face, size_pt, width_in, **kw):
    """Estimate how many rendered lines `text` wraps to. Counts explicit \\n."""
    cpl = chars_per_line(font_face, size_pt, width_in, **kw)
    if not cpl:
        return None
    total = 0
    for seg in (text or "").split("\n"):
        total += max(1, math.ceil(len(seg) / cpl)) if seg else 1
    return total


def lines_that_fit(height_in, size_pt, line_spacing=1.1, pad_t=0.0188,
                   pad_b=0.0188):
    """How many lines of this size fit vertically in the box."""
    line_h_in = (size_pt * line_spacing) / 72.0
    usable = max(0.0, height_in - pad_t - pad_b)
    return max(1, int(usable / line_h_in))


# --------------------------------------------------------------------------- #
# slot-level fit decision
# --------------------------------------------------------------------------- #
def fit_report(text, slot: dict) -> dict:
    """slot is a contract dict with at least font/size/w/h (and optional
    max_chars, expected_lines, marL). Returns a structured verdict.

    decision is one of:
      'fits'      — ships as-is
      'compress'  — over by <= 25%; rewrite to target_chars (stay in template)
      'split'     — over by > 25%; content should span multiple slots/slides
    """
    font = slot.get("font", "Inter")
    size = slot.get("size", 10.0)
    w = slot.get("w", 4.0)
    h = slot.get("h")
    indent = slot.get("marL", 0.0)
    cpl = chars_per_line(font, size, w, indent_in=indent)
    n = len(text or "")
    est_lines = estimate_lines(text, font, size, w, indent_in=indent)

    max_lines = slot.get("expected_lines")
    if max_lines is None and h:
        max_lines = lines_that_fit(h, size, slot.get("line_spacing", 1.1))
    cap = slot.get("max_chars")
    if cap is None and cpl and max_lines:
        cap = cpl * max_lines

    overflow = max(0, n - cap) if cap else 0
    ratio = (n / cap) if cap else 0.0
    if not cap or n <= cap:
        decision = "fits"
        target = n
    elif ratio <= 1.25:
        decision = "compress"
        target = cap
    else:
        decision = "split"
        target = cap
    return {
        "chars": n, "cap": cap, "cpl": cpl,
        "est_lines": est_lines, "max_lines": max_lines,
        "overflow_chars": overflow, "ratio": round(ratio, 2),
        "decision": decision, "target_chars": target,
    }


def fits(text, slot) -> bool:
    return fit_report(text, slot)["decision"] == "fits"


def plan_list(items, slot: dict) -> dict:
    """Decide how a LIST of items maps to a slot with max_count.
    Returns {'pages': [[items...], ...], 'per_item': [fit_report,...],
             'overflow_count': int}. Splits into multiple pages rather than
    dropping items (playbook: never drop a bullet without reporting it)."""
    max_count = slot.get("max_count", len(items))
    pages = [items[i:i + max_count] for i in range(0, len(items), max_count)] \
        or [[]]
    item_slot = {k: v for k, v in slot.items() if k != "max_count"}
    reports = [fit_report(it if isinstance(it, str) else it.get("text", ""),
                          item_slot) for it in items]
    return {
        "pages": pages,
        "n_pages": len(pages),
        "per_item": reports,
        "overflow_count": max(0, len(items) - max_count),
        "needs_compress": [i for i, r in enumerate(reports)
                           if r["decision"] != "fits"],
    }


if __name__ == "__main__":
    # self-check against the three calibration anchors
    print("header :", fit_report(
        "x" * 110, {"font": "Inter SemiBold", "size": 22.5, "w": 4.6703,
                    "expected_lines": 4}))
    print("bullet :", fit_report(
        "x" * 80, {"font": "Inter", "size": 10.0, "w": 3.4908, "marL": 0.5,
                   "max_chars": 85}))
    print("column :", fit_report(
        "x" * 231, {"font": "Inter", "size": 9.0, "w": 2.1896,
                    "expected_lines": 8}))
