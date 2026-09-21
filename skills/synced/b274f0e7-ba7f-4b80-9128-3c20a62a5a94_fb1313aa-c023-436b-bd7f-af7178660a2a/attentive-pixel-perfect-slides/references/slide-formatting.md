# Attentive Slide Formatting (pass 1: mechanical correctness)

Slide generation is two passes. **This skill is pass 1**: get the geometry,
fit, wrapping, and overflow right. It is brand-agnostic — it does not pick
colors, motifs, or images. That is pass 2 (`attentive-slide-design`). A slide
must pass formatting before any design polish is applied; polishing a slide
whose text overflows just hides the bug.

The governing principle from the build playbook: **stop guessing.** Every layout
value must trace to the canonical deck's XML or to an owner-confirmed answer.
Anything in between is debt.

> **⛔ NON-NEGOTIABLE:** slides are produced by **duplicating an existing
> canonical template slide and filling it**, never by generating a layout from
> scratch. Fit work decides whether content fits the chosen template's existing
> slots and, when it doesn't, whether to pick a different existing template,
> compress the copy, or split across multiple duplicated template slides. It is
> **never** license to resize, shrink, reposition, or redesign template elements
> to force a fit. The four outcomes are fits / compress / split / paginate — not
> "rebuild the slide."
>
> **Before creating any slide, answer internally:** (1) which canonical template
> slide am I duplicating? (2) why does that template fit the content? (3) which
> existing placeholders am I replacing? (4) will the content fit without changing
> template geometry? (5) if not — compress, split, or pick another template?
>
> **QA (required):** every generated slide must originate from a duplicated
> canonical template slide. Flag any slide built from scratch as a **FAILURE**
> unless the user explicitly approved a custom slide.

## When to use

- Turning content into Attentive slides (run this, then the design skill, then
  the builder).
- Deciding whether a block of content fits a template, or needs to be
  compressed / rerouted / split.
- Re-auditing a new or updated canonical deck into fresh measurements.
- QA: checking an existing deck for overflow, clipping, or off-grid boxes.

## What this skill owns

Layout and object geometry · text-box sizing and padding · font sizes ·
wrapping and line counts · slot capacity (max chars / lines / items) · tables
(rows, columns, per-column width) · bullets and indents · alignment · image
frames · z-order · **overflow handling** (fit / compress / denser template /
split). It explicitly does **not** own color, dividers, motifs, image
selection, pills, stat/quote-card styling, or template-family aesthetics.

## Workflow

### 1. Audit the canonical deck (only when the deck is new/changed)

```bash
python scripts/audit_pptx.py --pptx "<canonical>.pptx" --out _audit
```

Walks every slide's OOXML — including **tables** (`<a:tbl>` cells) and
**pictures** — and writes `audit.json`, `audit_shapes.csv` (one row per
text-bearing element, for spot-checking), `families.json` (slides clustered into
template families), and `audit_summary.txt` (fonts, palette, family counts).
It is **read-only** on the deck. Spot-check three shapes per family against the
raw XML before trusting it (playbook §III.1).

### 2. Decide fit with the fit engine

`scripts/fit_text.py` is the mechanical decision-maker. For any text field:

```python
import fit_text
rep = fit_text.fit_report(text, slot)   # slot = a contract dict
# rep["decision"] is one of: fits | compress | split
```

Its chars-per-inch table (`CPI_TABLE`) is **empirically anchored to the deck's
own designer hints** (e.g. slide 131's "110-character, four-line header" and
"75–85-character bullets"), because characters-per-line does **not** scale
linearly with font size. For lists, use `plan_list()` — it paginates rather than
dropping the tail.

### 3. Apply the fit decision

Read [slide-formatting/formatting-rules.md](slide-formatting/formatting-rules.md). The only
four outcomes are `fits`, `compress`, `split`, and (for lists) paginate. **There
is no truncation.** Never drop a bullet or row without surfacing it.

**Compression stays on-voice.** When you shorten copy to fit, keep it in
Attentive's brand voice — rewrite tighter with the **`attentive-brand-voice`**
skill rather than padding with filler or slipping in banned words (leverage,
seamless, unlock…) to hit a length. Fewer words, still on-brand.

### 4. Hand off to the builder + design skill

Once content fits the [slot contracts](slide-formatting/slot-contracts.md),
`attentive-slide-design` picks which canonical slide to use and
`attentive-slide-builder` **duplicates that canonical slide and fills it**
(`build_from_plan.py`). Neither step ever generates geometry from scratch.

## Files

- `scripts/audit_pptx.py` — read-only OOXML audit → JSON + CSV + family clusters
  (handles tables and pictures).
- `scripts/fit_text.py` — chars-per-inch calibration, line estimation, the
  fit/compress/split decision, and list pagination.
- `slide-formatting/formatting-rules.md` — the rules: canvas, grid, slots, fit
  decision, overflow, OOXML pitfalls.
- `slide-formatting/slot-contracts.md` — per-template slot capacities (companion to
  `attentive-slide-builder/contracts.json`).

## Non-negotiables

- **Fit content into a duplicated canonical template slide; never resize or
  redesign template elements to make it fit.** When content overflows: pick a
  different existing template, compress, or split — fits / compress / split /
  paginate are the only outcomes.
- Pixel-perfect means geometry, padding, line counts, and z-order match the
  source. Measure; do not eyeball.
- Formatting happens **before** design embellishment.
- Never silently truncate. Never drop a bullet/row without reporting it.
- Preserve canonical placeholder text — it carries the designer's fit hints.
- Verify in the rendered output, not just the code.
