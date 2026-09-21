# Formatting rules — make the slide mechanically correct first

These rules govern **pass 1** of slide generation: geometry, fit, wrapping,
overflow. They are content-agnostic and brand-agnostic. A slide that violates a
rule here is broken regardless of how good the design looks. Design judgment
(color, motif, image choice) is **pass 2** and lives in the
`attentive-slide-design` skill — do not apply it until the rules below pass.

Every number traces to the canonical deck via
`attentive-slide-formatting/scripts/audit_pptx.py` or to an explicitly labeled
authoring cap. Nothing should be silently guessed.

## The slide canvas

- The slide is **10 in × 5.625 in** (Google Slides 16:9). In python-pptx:
  `prs.slide_width = Inches(10)`, `prs.slide_height = Inches(5.625)`. Never the
  PowerPoint 13.333 × 7.5 default — every coordinate in the contracts assumes
  10 × 5.625 and will be wrong on the bigger canvas.
- **Safe margins:** content lives inside ~0.22 in left, ~0.25 in top/right, and
  leaves ≥0.3 in of clear space at the bottom (last safe baseline ≈ 5.25 in).
- **The standard content grid** (measured, dominant across the deck): a topic
  label at `x=0.2202, y=0.1794`, the title directly under it at
  `x=0.2202, y=0.3235`, and body content beginning around `y=1.7–2.1`. Section
  dividers and covers use a larger left margin (`x=0.5404`) and a vertically
  centered title.

## Slots and their capacity

A **slot** is one text or image box with fixed geometry and a capacity contract:
font face, size, box width/height, padding, and the number of characters/lines
it can hold. Capacities live in `attentive-slide-builder/contracts.json` and in
[slot-contracts.md](slot-contracts.md). The capacity rules:

1. **Characters per line do not scale linearly with font size** (the single most
   expensive wrong assumption on the prior build). Use the empirical
   `CPI_TABLE` in `scripts/fit_text.py`, which is anchored to the deck's own
   designer hints, not a formula.
2. **Effective width, not box width.** A paragraph with a hanging indent
   (`marL`) wraps at `width − pad_l − pad_r − indent`. The slide-131 bullets sit
   in a 3.49 in box but wrap at ~2.99 in because of the 0.5 in hang. Always
   subtract the indent.
3. **Designer hints in placeholder text are ground truth.** When the canonical
   placeholder says "four line header that contains roughly 110 characters" or
   "must be 75-85 characters," that count overrides any computed value. The
   audit parses these into `explicit_line_hint` / `explicit_char_hint`; the
   contracts use them directly.
4. **Per-paragraph fonts.** A lead-in run can be SemiBold while the rest of the
   paragraph is Regular; they wrap differently. Fit each run group with its own
   weight.

## Fit decision (the only four outcomes)

For every text field, run `fit_text.fit_report(text, slot)`. It returns exactly
one decision — there is no fifth option, and **truncation is never one of them**:

| Decision | When | What to do |
|----------|------|------------|
| `fits` | `chars ≤ cap` | Ship as-is. |
| `compress` | over by ≤ 25% | Rewrite the text to `target_chars` (rephrase, drop filler) and stay in the same template. |
| `split` | over by > 25% | The content is too big for this slot. Move to a **denser template**, or **split across multiple slides** (e.g. 5 bullets → two 4-bullet slides), or restructure the content. |
| (lists) `plan_list` | more items than `max_count` | Paginate into multiple slides; never drop the tail. |

Rules that follow from this:

- **Never truncate silently.** If you must shorten, record the before/after
  length and surface it. If you must drop anything, that is a hard stop that must
  be surfaced to the user, not a quiet `[:n]`.
- **Never drop a bullet or a table row without reporting it.** Over-capacity
  lists paginate; over-capacity scalars compress-and-flag.
- **Prefer compression inside the template over rerouting.** The prior build
  found that 10–15% compression usually beats jumping to a different template.
  Reroute only when `split` fires.

## Overflow handling, concretely

- **Headers** (`content_with_card`, `split_image`): cap ≈ 110 chars / 4 lines.
  Over that → compress; if it cannot be said in 110 chars, the idea is two
  slides.
- **Bullets**: 75–85 chars each, max 4 per `content_with_card`. 5+ bullets →
  paginate across slides with `fit_text.plan_list()` (never drop the tail).
- **Column bodies** (`content_columns`): ~230 chars over ~8 lines per column.
- **Tables**: respect **per-column** width. Narrow columns hold less text than
  wide ones — do not reuse the wide column's content in a narrow one (this
  overflowed a column on the prior build). Max ~12 rows, ~10 cols before the
  cells become unreadable; beyond that, split the table.
- **Stat numbers**: keep short (`+38%`, `12x`, `$2.4M`). The symbol carries the
  punch; no verbs in the number.

## OOXML mechanics that break silently

These render fine in PowerPoint but fail in Google Slides, so they are easy to
miss. The canonical slides already encode them correctly — you duplicate those
slides, you don't draw shapes — but respect them in any hand edit:

- **Table cell borders must precede the fill** inside `<a:tcPr>` (`a:lnL/R/T/B`
  before `a:solidFill`). Wrong order → Google Slides drops the borders.
- **Z-order is order of insertion** into the shape tree. Add backgrounds and
  cards first, then text, then any overlapping badge last. There is no z-index.
- **Verify the actual `prst`** for any non-rectangle. python-pptx enum names do
  not always map to the preset you expect (`CHEVRON` → `homePlate`).
- **Kill preset shadows.** Auto-shapes carry a theme drop-shadow via `<p:style>`;
  the Attentive system is flat. The canonical slides are already flat — preserve
  that in any hand edit.
- **Lock autofit.** Set `noAutofit` so the box does not silently shrink the font
  to hide an overflow you should have caught.

## Verify in the render, not the code

A contract value is only correct if the rendered slide proves it. After
generating, rasterize (`soffice --headless --convert-to pdf` then `pdftoppm`)
and check: nothing clipped, no empty stray bullets, no text touching a box edge,
no overlap, and the bottom margin is clear. Render every slide and eyeball it
before shipping.
