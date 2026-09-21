# Slot contracts — capacity spec per template family

A **slot contract** is the mechanical promise a template makes: "this box is at
`(x, y)`, this size, this font, and holds at most N characters / lines / items."
The machine-readable companion is `attentive-slide-builder/contracts.json`; this
file is the human-readable reference. Every value traces to a measured canonical
slide or an explicitly labeled authoring cap.

These caps are for **authoring**. At build time the pre-flight
(`attentive-slide-builder/preflight_lint.py`) measures each box straight from the
canonical slide's own XML, so these numbers don't drive the build — the
duplicated slide's own geometry does. The authoritative per-slide **category**
(which family a slide belongs to) is `slide_scores.json`.

> **Exemplar numbers.** Motif/spec families are measured from the deck's own
> front-matter component pages (slides 1–12, the same convention `design-tokens.md`
> uses): `split_image` → slide 4 ("Photography Library"), `section_divider` →
> slide 2. `stat_trio`, `testimonial`, and `card_grid` cite the **working** slides
> you actually duplicate (80, 49–58, 81–84) — the previous `stat_trio` → 7 and
> `card_grid` → 24 citations were wrong (slide 7 is a *testimonial* component page,
> slide 24 is the agenda). `cover` is an idealized full-width cover spec, not tied
> to a single canonical slide.

How to read a row: `geometry (x,y,w,h in)` · `font size` · `cap` (max chars per
line-unit or per item) · `lines/count`. "★" marks a cap taken directly from a
designer hint in the canonical placeholder text.

> **Content headers are ONE line, short and sweet.** The `header` / `title` slots
> below list the canonical box's multi-line capacity, but the house style is a
> single-line headline (plus an optional one-line subtitle). The builder
> auto-widens the content-header box to hold a short title on one line within the
> free space beside it (`attentive-slide-builder/fit_titles.py`), and the
> pre-flight measures each header as a one-line field at that widened width —
> flagging any header too long to be one line. Keep titles to a few words; put
> detail in the body. This does **not** apply to the big display titles on
> covers, section dividers, and title slides, which stay multi-line by design.

## content_with_card — the workhorse (exemplar slide 131)

Topic label + four-line header + up to 4 arrow bullets, with a cream card or
image panel on the right.

| Slot | Geometry (x, y, w, h) | Font | Cap | Lines/Count |
|------|----------------------|------|-----|-------------|
| card/image | 5.0795, 0.2416, 4.6703, 4.9213 | — | — | panel |
| topic | 0.2202, 0.1794, 2.1306, 0.1759 | Inter SemiBold 9 | 22 | 1 |
| header | 0.2202, 0.3235, 4.6703, 1.4012 | Inter SemiBold 22.5 | ★110 | 4 |
| bullets | 0.2202, 2.0796, 3.4908, 1.9232 (hang 0.5) | Inter 10 | ★75–85 ea | max 4 |

## title_slide — deck opener (exemplar slides 13–19)

The first slide of any deck. Seven canonical variants; the title is **Libre
Baskerville serif**. Pick by title/subtitle length (see
[archetypes → "Title slides"](../slide-design/archetypes.md))
— never shrink to force a fit.

| Variant | Background | Decoration | Title | Subtitle |
|---------|-----------|-----------|-------|----------|
| 13 | yellow | photo + "A" cutout | 55pt, ≤22ch / 2 lines | — |
| 14 | yellow | tonal-A watermark | 55pt, ≤22ch / 2 lines | — |
| 15 | cream | plain | 55pt, ≤22ch / 2 lines | — |
| 16 | yellow | tonal-A | 37.5pt, ≤33ch / 2 lines | short ≤30ch / 1 line |
| 17 | cream | plain | 37.5pt, ≤33ch / 2 lines | short ≤30ch / 1 line |
| 18 | yellow | tonal-A | 37.5pt, ≤33ch / 2 lines | long ≤100ch / 2 lines |
| 19 | cream | plain | 37.5pt, ≤33ch / 2 lines | long ≤100ch / 2 lines |

Geometry (measured): big title box `0.25, 1.75, 5.25 × 1.8501` (styles 13–15);
title+subtitle title box `0.25, 1.75, 5.25 × 1.25` (styles 16–19); subtitle box
`0.25, 3.0652, 4.6801 × 0.25` (short) or `× 0.5` (long), Inter 12pt; wordmark
bottom-left. Title sizes (55 / 37.5pt) are the layout placeholder `defRPr`
values; the ≤22 and ≤33 caps are anchored to the canonical placeholders
("Deck title goes here", "Insert the name of the deck here.").

## section_divider (exemplar slide 2)

| Slot | Geometry | Font | Cap | Lines |
|------|----------|------|-----|-------|
| title | 0.5404, 1.275, 5.3366, 1.6211 | Inter SemiBold 30 | 44 | 2 |
| subtitle | 0.5404, 3.1461, 5.3366, 1.0256 | Inter 17 | 130 | 3 |

## cover

| Slot | Geometry | Font | Cap |
|------|----------|------|-----|
| eyebrow | 0.5404, 0.9, 7.0, 0.3 | Inter SemiBold 11 (yellow) | 40 |
| title | 0.5404, 1.275, 8.5, 1.9 | Inter SemiBold 30 | 60 / 2 lines |
| subtitle | 0.5404, 3.3, 8.0, 1.0 | Inter 14 | 120 |

## agenda — table of contents (exemplar slides 24–28)

Layout chosen by **section count**: 3→24, 4→25, 5→26, 6→27, 7–10→28. >10 means
split or consolidate (there is no canonical 11+ agenda). Headings,
section labels, and the numbered list are **Libre Baskerville serif**.

| Sections | Slide | Layout |
|----------|-------|--------|
| 3 | 24 | serif "Table of contents" heading + 3 columns |
| 4 | 25 | + 4 columns |
| 5 | 26 | + 5 columns |
| 6 | 27 | yellow "A" panel (left) + serif vertical list (right), active highlighted |
| 7–10 | 28 | "Agenda" label + serif numbered list |

Column layout (24–26): heading `0.2202, 0.1736, 4.1266 × 1.612` serif 40pt; each
section column has a **colored accent divider bar** at `y=2.267, h=0.153`
(cycle: yellow→olive→blue→orange→soft-yellow / accent 3,4,2,1,5), a serif label
at `y=2.62` (≤26 chars), and an optional Inter 9pt content list at `y=3.0387`.
Column x-positions: 3-col `[0.2202, 3.4766, 6.6886]`, 4-col `[0.2202, 2.654,
5.0545, 7.4551]`, 5-col `[0.2202, 2.1632, 4.0796, 5.996, 7.9178]`.

Progress (27): list box `3.7391, 0.45, 6.0108, 4.7`, serif 26pt, ≤6 items.
Numbered (28): numbers `0.2203, 0.5735, 0.6243 × 4.5787` + names `0.8902,
0.5735, 4.8524 × 4.5787`, serif 22pt, ≤10 items, ≤34 chars each.

## content_columns (exemplar slide 71)

Title band + 2–4 parallel columns at `x = 0.2202, 2.6761, 5.132, 7.5879`,
each `w=2.1896, h=1.7523` at `y=2.0861`.

| Slot | Font | Cap |
|------|------|-----|
| topic | Inter SemiBold 9 | 22 |
| title | Inter SemiBold 22.5 | 40 |
| column head | Inter SemiBold 9 | 28 |
| column body | Inter 9 | ★~230 / 8 lines |

## split_image (exemplar slide 4)

| Slot | Geometry | Font | Cap |
|------|----------|------|-----|
| header | 0.25, 1.6667, 3.8337, 0.9 | Inter SemiBold 22.5 | 36 |
| body | 0.25, 2.7555, 3.9409, 2.0 | Inter 12 | 320 / 7 lines |
| image | 4.4916, 0.25, 5.2585, 5.128 (roundRect) | — | full-height right |

## stat_trio (exemplar slide 80)

Topic + title + up to 3 yellow cards in a row (auto-widened to fill 9.56 in).

| Slot | Font | Cap |
|------|------|-----|
| number | Libre Baskerville 18–20 italic | 14 |
| caption | Inter 8–9 | 70 |
| name / source | Inter 7 | 30 |

## dataviz — three KPI cards + trend arrows (slide 92)

A distinct layout from `stat_trio`: **three fixed-width KPI cards, each with a
big Inter-Bold number and a small up-arrow to its left** ("▲ 20%"). The middle
card is the highlighted one (yellow gradient); the outer two are cream
`#F4F2E6`. Numbers are **Inter Bold 24pt, center-aligned** — *not* the serif
italic of `stat_trio`. Cards are **fixed 3.07 in wide** (they do **not**
auto-widen). This slide breaks in two specific ways; the caps and the arrow rule
below exist to prevent them.

| Slot | Geometry (x, y, w, h) | Font | Cap |
|------|----------------------|------|-----|
| card L / M / R | left 0.25 / 3.47 / 6.68, top 3.112, 3.07 × 2.045 (roundRect) | — | fixed; ~0.15 gap; middle = gradient, outer = cream |
| number L / M / R | fills card, centered; card-centers x = **1.785 / 5.005 / 8.215** | Inter Bold 24 | **≤4 glyphs / ≤~0.8 in wide** |
| caption L / M / R | card-left +~0.08, y 3.385, w ~1.0–1.24, h 0.223 | Inter 11 | ~22 / 1 line |
| trend arrow L / M / R | left **1.054 / 4.383 / 7.602**, y 4.063, **0.176 × 0.152** (isosceles triangle) | — | fixed size; see rule |

**Failure mode 1 — numbers too large.** The number box is fixed at 24pt and the
card never widens, so a long value overflows or collides with the arrow. Keep
each value to **≤4 glyphs and ≤~0.8 in rendered** (the template values are
`20%` 0.67 in, `587` 0.56 in, `4.7K` 0.70 in). **Abbreviate:** `4.7K` not
`4,700`, `2.3M` not `2,300,000`, `20%` not `20.4%`, `12x` not `1200%`. One
decimal max; no thousands separators; avoid long currency (`$4.5M`, not
`$4,500,000`). Widths at 24pt bold: digit ≈ 0.185 in, `.`/`,` ≈ 0.09 in,
`%` ≈ 0.28 in, `K`/`M`/`x` ≈ 0.33 in.

**Failure mode 2 — arrow spacing goes off.** The number is **center-aligned**
and the arrow is a **separate, absolutely-positioned shape** the template author
hand-placed just left of *that specific* value. Change the value's length and
its left edge shifts but the arrow stays put → broken gap or overlap. Two fixes,
in order of preference:

- **A (preferred, no geometry change):** keep each value about as wide as the
  slot original — **left card 3 glyphs, middle 3, right 4.** Then the arrow stays
  aligned and you touch no geometry. A ±1-glyph difference is usually fine.
- **B (only if width must change):** move the arrow to follow the number's new
  left edge — shift it left by **half** the width change (the number grows
  symmetrically from the center), ≈ **0.09 in per extra glyph** (right per
  fewer). Exact: `arrow_left = card_center − number_width/2 − 0.15 (gap) − 0.176
  (arrow_w)`. **Never resize the arrow or change its y (4.063).**

If a KPI has **no** meaningful up/down trend, this is the wrong template (the
arrow implies one) — use a plain stat template (slide 80 / `stat_trio`) instead,
or rotate the arrow 180° for a genuine decline. Don't leave an up-arrow on a
down number.

## testimonial (exemplar slides 49–58)

| Slot | Geometry | Font | Cap |
|------|----------|------|-----|
| quote card | 0.2202, 1.6125, 4.6, 3.43 | — | cream panel |
| quote | inside card | Libre Baskerville 11 italic | 260 / 6 lines |
| name / source | inside card | Inter 8 / 8 | 32 / 40 |
| image | 5.05, 1.6125, 4.7, 3.43 (roundRect) | — | optional |

## comparison_table (exemplar slide 96)

Table at `0.25, 1.3, 9.5, ≤3.9`. Header row dark (Inter 7.5 bold, white text);
body rows cream-banded (Inter 7). Max **10 cols × 12 rows**; per-cell ≈ 14
chars. Respect **per-column** width — narrow columns hold less.

## card_grid (exemplar slides 81–84)

Topic + title + **3 or 4** equal cream cards across 9.56 in, each: icon dot
(0.5 in, theme accent) + card title (Inter SemiBold 12, ≤26 chars) + body
(Inter 9, ~180 chars / 6 lines).

---

## Values that are NOT fully derivable

Some caps are computed from `CPI_TABLE` interpolation rather than a direct
designer hint, and a few geometry choices for newly-composed families (stat
card height, card_grid icon size) were set to the nearest measured analogue.
Each unresolved capacity remains labeled as such rather than guessed. Confirm it
against a rendered deck before relying on a tight fit.
