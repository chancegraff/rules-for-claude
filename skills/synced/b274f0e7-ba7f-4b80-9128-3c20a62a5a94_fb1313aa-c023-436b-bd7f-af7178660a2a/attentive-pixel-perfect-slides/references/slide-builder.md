# Attentive Slide Builder (the rendering engine)

> ## ⛔ NON-NEGOTIABLE: duplicate a canonical template slide — never generate from scratch
>
> The canonical Attentive template deck is the source of truth. You are **not**
> generating slides from scratch; you are **selecting, duplicating, and filling**
> existing template slides. The slide-breakdown rules say WHICH existing template
> slide to use — they do **not** grant permission to recreate the slide manually.
>
> **Workflow for every deck:** start from the canonical template deck → work in a
> duplicated copy → for each needed slide pick the best-matching existing template
> slide by slide number and category → duplicate that exact slide → replace **only**
> the placeholder text, images, charts, tables, and data → preserve all original
> geometry, spacing, font sizes, colors, dividers, backgrounds, image frames,
> tables, icons, shapes, and z-order.
>
> - "Use slide 24" = duplicate slide 24 and fill it. "Use slides 91–116" / "choose
>   from 131–164" = pick the best existing template in that range, duplicate it,
>   replace the data — **do not recreate its structure.** A slide number is a
>   reference to a physical template slide, not a design spec to rebuild.
> - Don't draw a new layout, or add new text boxes, cards, dividers, icons, chart
>   areas, or decorative elements, when the chosen template already has them.
> - If content doesn't fit: pick a different existing template, compress the copy,
>   or split across multiple duplicated template slides. **Never** silently resize,
>   shrink, reposition, or redesign template elements to force a fit.
> - Build a custom slide **only** when the user explicitly says no template fits and
>   approves it.
>
> Before creating any slide, answer internally: (1) which canonical template slide
> am I duplicating? (2) why does it fit? (3) which placeholders am I replacing?
> (4) will it fit without changing template geometry? (5) if not — compress, split,
> or pick another template? **QA:** every slide must originate from a duplicated
> canonical template slide; flag any from-scratch slide as a FAILURE unless the
> user explicitly approved a custom slide. See
> [slide-builder/qa-checklist.md](slide-builder/qa-checklist.md).

The execution layer. Formatting (pass 1) decides whether content fits; design
(pass 2) decides which canonical slide to use; **this skill duplicates that
slide from the canonical deck and fills its placeholders**. It never renders
geometry from coordinates — the geometry is the source slide's, copied verbatim.

> **Fill with on-voice copy.** The text you write into `text` / `shapes` / `runs`
> / `tables` / `divider` must already be in Attentive's brand voice — apply the
> bundled [brand-voice reference](brand-voice.md) when authoring it.
> The builder fills verbatim; it does not rewrite, so any banned word, wrong
> trademark, or "Attentive Mobile" you hand it ships as-is. On-voice in, on-voice
> out.

## Architecture

```
Template—2026 NEW Attentive Company Deck Template.pptx   (164 canonical slides)
                 │
                 ▼
       template_deck.py  →  build_from_plan.py
   (clone a canonical       (CLI: plan.json → out.pptx,
    slide + swap text/img,   one duplicated slide per step,
    geometry preserved)      with a per-slide trace log)
```

- **`template_deck.py`** — the duplication engine. Works inside a copy of the
  canonical deck (so masters, layouts, theme, fonts, and media are all present
  and linked), `clone`s the exact canonical slide you ask for (deep-copying its
  shapes and remapping image/media relationships), exposes `replace_text` /
  `replace_image` (which preserve run formatting and frames), and on `save` drops
  the original canonical slides so only your filled clones remain, in order.
- **`build_from_plan.py`** — the CLI entry point. Reads a `plan.json`, duplicates
  the referenced canonical slide for each step, applies the text/image swaps, and
  prints a per-slide trace (`slide N: duplicated canonical #M — replaced K text
  block(s)`). Flags any text key that wasn't found so you can correct it.

Use only the bundled duplication, inspection, linting, and verification tools.
Do not substitute an unbundled from-scratch slide generator.

## Usage

```bash
# 1. Inspect the canonical slide to copy its EXACT placeholder strings.
python build_from_plan.py --inspect 24

# 2. (optional) Pre-flight the plan directly — measures each field's real box
#    and flags overflow (OK/TIGHT/COMPRESS/SPLIT), per-bullet, plus unmatched keys.
python preflight_lint.py plan.json          # --strict to fail on overflow

# 3. Build. The pre-flight runs AUTOMATICALLY first and REFUSES to build on
#    overflow / unmatched keys (use --force to override, --no-lint to skip).
python build_from_plan.py plan.json deck.pptx
```

A `plan.json` references physical canonical slides to **duplicate** and the
literal text to replace inside each:

```json
{"template": "Template—2026 NEW Attentive Company Deck Template.pptx",
 "slides": [
   {"template_slide": 16, "note": "cover",
    "text": {"Insert the name of the deck here.": "Six reasons to stay with Attentive"}},
   {"template_slide": 24, "note": "agenda",
    "text": {"Section 01": "Overview", "Section 02": "Results"},
    "images": {"Picture 3": "assets/hero.png"}}
 ]}
```

`template_slide` is a reference to an existing canonical slide to duplicate — not
a spec to rebuild. Always `--inspect` first; text matching is literal (a trailing
space or line break in the placeholder must be matched or split into separate
keys). The same `template_slide` may be reused as many times as you need. When a
template can't hold the content, pick a denser canonical slide or split across
multiple duplicated slides — never resize or redraw.

### Titles: short and sweet, on ONE line (auto-fit)

Attentive content-header titles read best **short and punchy on a single line**.
The canonical header box is narrow (~2.55in), so a header even slightly too long
wraps to 2–4 lines and — on icon / stat / card layouts — spills into the row
beneath it (the classic "the subtitle is sitting on top of the first card"
bug). Two things keep titles clean:

1. **Write short headers.** A title is a headline, not a sentence — aim for a few
   words. Push detail into the subtitle (also short) or the body. The pre-flight
   now measures every content header as a **one-line** field at the widest its
   box could grow, and flags anything too long to ever be one line
   (`COMPRESS` / `SPLIT`) so you shorten it before building.
2. **The builder auto-fits the box.** After filling each slide, the builder
   widens the **content-header box only** just enough for its title/subtitle to
   sit on one line, using the free space beside it. This is the *one* sanctioned
   geometry change on a duplicated slide (see `fit_titles.py`): it only ever
   **grows** the box, never shrinks it; never crosses a neighbouring shape (keeps
   a gutter) or the slide edge; never touches x / y / height / font / colour /
   z-order; and never touches display titles (covers, section breakers,
   statements) or agenda lists. A short header snaps onto one clean line; a
   header too long to be one line in the free space is left alone (and the
   pre-flight already told you to shorten it).

Disable with `--no-fit-titles`, or per step with `"fit_title": false`, if you
ever need the raw canonical box. The trace log prints `title → 1 line
(old→new in)` on each slide it widened.

### Filling repeated placeholders (columns, stat trios, card grids, tables)

The `text` map does a **whole-slide** find/replace, so it replaces every copy of
a string with the same value. The expressive templates repeat a placeholder
across their columns/cards/cells (four identical `"Title of section"` + lorem in
the 4-column slide 71; three `"40M total"` in the stat slide 80), which `text`
can't fill distinctly — so relying on `text` alone quietly steers you onto the
prose family and makes decks monotonous. Fill those **per shape** instead (still
pure duplicate-and-fill — only text changes, geometry is untouched):

```json
{"template_slide": 71, "note": "four reasons",
 "shapes": {                                    // find->replace SCOPED per shape
   "Google Shape;2021;p270": {"Title of section": "White-glove support",
                              "Lorem ipsum … consequat.": "A dedicated strategist …"},
   "Google Shape;2022;p270": {"Title of section": "Identity + AI",
                              "Lorem ipsum … consequat.": "Server-side identity …"}}}

{"template_slide": 96, "note": "comparison",
 "tables": {"Google Shape;2392;p295":            // 2-D rows OR [row,col,text] triples
            [["Feature","Attentive","Klaviyo"], ["Support","Dedicated CSM","Self-serve"]]}}

{"template_slide": 60, "note": "statement",
 "runs": {"Google Shape;1918;p259":              // positional per-run (keeps emphasis)
          ["Your customers live on their ", "", "phones", "", "", "", " — email won't."]}}
```

Get the exact shape names from `--inspect <N>` (they read `Google Shape;…`), or
`deck.list_slide_text(N)` for text shapes. `shapes`, `runs`, `tables`, `text`,
and `images` can all appear on the same step.

> **Repurposing a comparison table (156/157) for a non-comparison?** Relabel
> **all** its headers — including the logo. Besides the `"Category"` / `"Competitor"`
> text headers, the middle-column header is the **Attentive wordmark as a picture**,
> so it stays put unless you `images`-swap it. Hide it by replacing that picture
> shape with a small PNG filled in the canvas colour (`#FCFAEE` cream) so it blends
> away — a fully transparent PNG can render as a grey box. Bake each column's
> meaning into the **cells** (e.g. `"None (1)"` … `"Rich chart (5)"`) and clear the
> boilerplate disclaimer text box. Full guidance in
> [Attentive slide-design archetypes → data-viz](slide-design/archetypes.md).

### Reusing the agenda as a section tracker (progress divider)

Duplicate an agenda slide (24–28) and highlight the current section instead of
building one-off breakers. Reuse the SAME `sections` list on every divider:

```json
{"template_slide": 27, "note": "section: proof",
 "divider": {"sections": ["The opportunity","Why we win","Proof",
                          "One platform","Getting started","Next steps"],
             "active": 2}}          // 0-based; omit `active` for a plain contents list
```

The active section renders ink + bold, the rest muted. See
[Attentive slide-design archetypes → "Deck variety" and "Section transitions"](slide-design/archetypes.md).

Programmatic:

```python
from template_deck import TemplateDeck
deck = TemplateDeck("Template—2026 NEW Attentive Company Deck Template.pptx")
deck.list_slide_text(24)                  # see the placeholders
s = deck.use(24)                          # duplicate canonical slide 24
s.replace_text({"Section 01": "Overview"})            # whole-slide find/replace
s.fill_shapes({"Google Shape;2021;p270": {"Title of section": "Support"}})  # per shape
s.fill_runs("Google Shape;1918;p259", ["Your ", "", "phones", "", ""])       # positional
s.fill_table("Google Shape;2392;p295", [["Feature","Attentive","Klaviyo"]])  # table cells
s.fill_divider(["Overview","Results","Next"], active=1)   # agenda → progress divider
s.replace_image("Picture 3", "assets/hero.png")
deck.save("deck.pptx")
```

## Placeholder-fill pitfalls (learned — check every time)

Real defects that shipped before. Each is about *what copy goes in which
placeholder*, not geometry. Watch for them whenever you fill a slide, and confirm
them in the render.

- **Multi-line titles are ONE title split across paragraphs — fill line 1, clear
  the rest.** Cover title boxes read `"Deck title"` / `"goes here"` (two
  paragraphs) and the ToC title reads `"Table of"` / `"contents"`. They are a
  single title broken onto two lines, **not** two fields. Put the title on the
  first line and set the trailing line(s) to `""` — never write the title into
  both, or it renders twice (e.g. "Attentive 101 / Attentive 101").
- **"Optional Subtitle" is optional — leave it blank if the main subtitle is set.**
  Content headers (slides 60–89) often have both a `"Subtitle"` run *and* a
  separate `"Optional Subtitle"` shape. Filling both with the same text prints the
  subtitle twice. Fill `"Subtitle"`; set `"Optional Subtitle"` to `""` unless it
  genuinely needs a *different* second line.
- **Cover / speaker subtitles are a short tagline or one descriptive line — never
  a body paragraph.** Placeholders like `"Lorem ipsum dolor sit amet"` and
  `"Consectetur adipiscing elit, sed do…"` on slides 16–22 are sized for one short
  line. Drop a full sentence in and it wraps to 2–3 lines and the title↔subtitle
  spacing breaks. Keep them ≤ ~1 line (≈50 chars).
- **Agenda / table-of-contents section names render LARGE — keep them 1–3 words.**
  On slides 24–28 the section labels are big display type in narrow columns. Long
  names ("The AI marketing platform") wrap and overlap the content list beneath
  them. Use tiny names ("The platform", "SMS & email", "Getting started"). Also
  fill the `"Content aa/bb/cc…"` sub-items (short parallel labels) — don't leave
  them as placeholders.
- **Content-slide headers (`"Title of section"`, 60–89) must fit ONE line.** The
  header box is narrow (~20 chars wrap before auto-widen). Even "One platform, one
  view" wraps. Write 1–3 words; push detail into the subtitle/body. This is the
  short-and-sweet title rule enforced at fill time.
- **A short title register ≠ the display title.** Big cover / section-breaker
  boxes can hold a longer display line; content headers and agenda names cannot.
  Keep separate short vs. display versions of each title and use the short one for
  content headers and agenda.
- **The big-serif content-header SUBTITLE wraps and bleeds — blank it.** In the
  "Title of section" + "Subtitle" boxes (slides 60–89), the `"Subtitle"` line
  renders as LARGE serif in a narrow column; anything longer than ~1 word wraps to
  2–3 lines and bleeds into the body, image, or stat cards below. Fill only the
  short bold title (+ the `"Attentive 101"`-style eyebrow) and set `"Subtitle"` to
  `""`. A short title + eyebrow is a complete, clean header.
- **Titles must never overlap an image/body box — this is the #1 recurring
  defect.** Keep the title to one short line; if it still collides with a picture
  frame or the body, that means the copy is too long (shorten it) or the title box
  needs widening. `fit_titles.py` may widen a content-header box horizontally
  into verified free space. It must not move the box or change its x, y, height,
  font, color, or z-order. If safe widening is insufficient, shorten the title or
  choose another canonical slide.
- **Bold lead-in placeholders: bold the label only, not the sentence.** Rows like
  `"Main topic N"` (a BOLD run) + `"is 130-140 characters…"` (a NORMAL run) are a
  bold label followed by a normal description. Fill them POSITIONALLY (`runs`): a
  short label into the bold run, the sentence into the normal run — with a
  separator (`": "`) so they don't jam together ("SMSAttentive…"). Never let
  paragraph-level find/replace pour the whole sentence into the bold run, or the
  entire paragraph renders bold.
- **KPI number cards: center the number so the ▲ marker + number read centered.**
  On the KPI-summary layout (slide 92) the big number is left-aligned by default,
  so the ▲ + number sits off to the left. Center-align the number paragraph
  (handled by `polish.py`).
- **Tables: one font AND one size across every cell.** Some template cells carry
  no explicit font/size and fall back to a larger default (the "big bottom row"
  look). After filling a table, force every cell run to Inter at the table's
  dominant size (handled by `polish.py`).

- **Placeholder char/line specs are REQUIREMENTS — read them and match them.**
  Many template placeholders state their own budget: `"This is a three line header
  that contains roughly 70-80 characters"`, `"Point number 1 must be 75-85
  characters"`, `"This is a two line header that has <55 characters"`, `"four line
  header … roughly 110 characters"`, `"<20 character stat"`. Write copy that MEETS
  that spec — long enough to look intentional on a multi-line header, and **never
  over the max**. A 12-character title in a box that asks for ~110 looks broken;
  a 120-character title in a box that asks for 70–80 bleeds into the body. Parse
  the number and fit to it.
- **When no number is stated, the placeholder's own text length is the budget.**
  The template authors sized the lorem to fit the box, so a replacement no longer
  than the original placeholder text will fit too. Never pour a full sentence into
  a small stat-description, caption, or timeline line — fit to the box, or it
  overlaps its neighbors, the image, or the footer logo. (The builder does this
  with a length-budget picker: pick the copy nearest the target length that is ≤
  the max, else trim at a word boundary.)
- **Line count is font-dependent — eyeball multi-line headers in the render.**
  Meeting the character count usually gives the right number of lines in Google
  Slides (real Inter), but a substituted render font can wrap differently. After
  building, confirm each multi-line header sits in its box and clears the body.
- **Narrow cards and tight boxes: bias the copy SHORT.** A sub-point that meets a
  `<50 character` spec can still wrap to three lines in a narrow card column and
  spill past it. For card sub-points, stat descriptions, and timeline lines, aim
  for the LOW end of the budget (~60% of max) and prefer very short, verb-first
  phrases so they reliably sit on one or two lines. The builder's length picker
  takes a `bias="tight"` for these and `bias="fill"` only for multi-line headers
  that should look full.
- **Text hides inside GROUPED shapes — always recurse into groups.** On several
  slides (e.g. timeline 162) placeholders live inside group shapes. Top-level
  `slide.shapes` skips group children, so if you don't recurse you leave
  `Project Thing` / `Thing 2` unfilled AND the guard won't see them. The builder,
  the plan generator, and `verify_fills` now walk groups via `_iter_shapes`; keep
  it that way, and never assume a clean top-level scan means the slide is fully
  filled.
- **Vertical anchor matters — align text to its anchor edge.** Timeline text
  under the bar must be TOP-anchored so it sits against the bar instead of
  floating low; text above the bar is BOTTOM-anchored. Some template boxes ship
  with the wrong anchor — `polish.py` fixes the known ones (slide 163). Timeline
  bar labels must also be short enough to fit the bar's width.

### Timelines: default to Template 5 (canonical slide 163)

Of the six timeline templates (159–164), **Timeline Template 5 (canonical slide
163) is the preferred default** — milestones above and below a single bar, text
top-anchored so it sits against the bar. Reach for it first for onboarding /
roadmap timelines unless a different one clearly fits better.

### Data-viz: charts are DRAWN SHAPES, not native charts

The template's graphs are **not** editable PowerPoint charts — there is no chart
part to `replace_data`. They are drawn with shapes, and how you update them
depends on the shape type:

- **VERTICAL stacked bar (slide 101) is the preferred stacked-bar exemplar.**
  Its bars are freeform rectangles rather than an editable chart object. The
  bundled builder safely supports text and image replacement, not a general
  data-to-geometry transformation. Replace labels only unless the user approves
  a custom geometry edit and that edit is independently verified.
- **Know the chart's ORIENTATION.** Slide 102 is horizontal, not vertical. Relabel
  only unless an explicitly approved, verified custom edit is required.
- **Line/area (98), pie (99), radar (100), and 91's curve are FREEFORM — labels
  only.** The series are hand-drawn path geometry; swapping the axis/segment
  LABELS works and looks right (tested: pie 99 → Enterprise/Mid-market/SMB/Other,
  radar 100 → product axes), but the shape itself won't reflect new numbers.
  Redrawing a path from data is a real project — prefer a bar layout (101) when
  the story needs live numbers.
- **Some "charts" have no data shapes at all.** Slide 112 is just an X/Y axis with
  legend dots — there are no bars to drive. Don't treat every graph-looking slide
  as chartable; inspect the shapes first.

### Bubble / pill "sections" (slide 91 timeline)

The segment pills have FIXED widths tied to their position on the Jan–Apr axis.
When a label is longer than its pill:

- **Best: shorten the label** ("Automated" → "Auto", "One-time" → "1-time"). The
  pills keep their positions, so the timeline stays meaningful and everything
  fits (tested).
- **Widening a pill to fit the copy breaks the axis** — the pills stop lining up
  with the month gridlines. Only do it if the pills are a legend, not a timeline.
- Never let a label overflow its pill. Fit the copy to the pill, not the reverse.

> **User-authorized polish pass (`polish.py`).** Paragraph alignment, table-font
> consistency, and title-box resizing are formatting the plan JSON can't express.
> `polish.py` applies only these narrow, pre-approved tweaks to a built deck; it is
> a whitelist and never touches geometry/formatting the user didn't approve. Run it
> right after `build_from_plan.py`, before `verify_fills.py`.

### Confidence these mistakes recur (after the fixes above)

| Mistake | Guard / rule now in place | Recurrence |
|---|---|---|
| Duplicate title on 2-line title boxes | `verify_fills` fails on stacked dup | **Low** |
| Cover/speaker subtitle too long (spacing) | short-subtitle rule | **Low** |
| Agenda section names too long | short-name constants + rule | **Low** |
| Table font/size inconsistency | `polish.py` forces one font+size | **Low** |
| KPI number not centered | `polish.py` centers it | **Low** |
| Whole paragraph bolded (bold lead-in) | positional-fill rule + `verify_fills` bold check | **Low–Medium** |
| Content-header title too long / not one line | short-title rule + `fit_titles` + preflight | **Medium** — title length is a per-slide judgment; keep checking the render |
| Title overlapping an image/body box | short-title + resize rule; no auto-detector yet | **Medium** — depends on each layout's picture frame; always eyeball the render |
| Ignoring a placeholder's stated char/line limit | length-budget picker parses the spec + rule | **Low–Medium** — spec is honored automatically; line count can still vary by render font |
| Text overflowing into the logo / adjacent box | fit-to-budget (never exceed the placeholder's own length) | **Low–Medium** — small boxes are auto-fitted; verify dense slides in the render |
| Repeated identical line down a column (timeline/list) | distinct short-label pools + rotating fallback + `verify_fills` stacked-dup check | **Low** |
| Copy wraps past a narrow card/box | tight-bias picker (~60% of max) + short verb-first pools | **Low–Medium** — narrow columns still need a render eyeball |
| Grouped placeholders left unfilled | builder/generator/guard recurse into groups (`_iter_shapes`) | **Low** |
| Text mis-anchored under a timeline bar | `polish.py` sets vertical anchor to top | **Low** — known layouts fixed; check any new timeline layout |
| Label overflowing a fixed-width bubble/pill | shorten the label (don't widen the pill) | **Low** |
| Retargeting the VERTICAL stacked bar (101) from data | height-from-value rescale + label reposition (`adjust_stacked_bar`) | **Low–Medium** — reliable; always render to confirm scale |
| Rescaling a chart without checking orientation | 102 is horizontal; vertical rescaler breaks it → relabel or use 101 | **Low–Medium** — inspect orientation first; render to catch it |
| Redrawing a line/pie/radar chart from data | freeform geometry; labels only | **High if attempted blindly** — treat as a real task, or switch to a bar layout |
| Assuming every graph slide is chartable | 112 is axis-only; inspect shapes first | **Low** |

The two **Medium** items are the ones to watch every build: after rendering, look
specifically at each content header and confirm the title is one line and clear of
every image frame and body block. Shorten the copy or widen the box until it is.

Run the placeholder self-scan after building: reopen the output and assert no
`Lorem`/`ipsum`/`Content aa`/`Section 0N`/`goes here`/`Deck title`/`Optional`/
`Title of section` survives on any filled slide, and that no title or subtitle
string repeats within a slide.

## Verify

```bash
python build_from_plan.py --inspect <N>   # confirm the placeholder strings you targeted
python verify_fills.py out.pptx --skip <canonical slides>   # catch the pitfalls above
```

`verify_fills.py` is the mechanical guard for the pitfalls above: it fails the
build if any slide you meant to fill still shows a template placeholder
(Lorem/`Content aa`/`Section 0N`/`goes here`/`Title of section`/`XX%`/…) or if a
title/subtitle is written twice in one shape, or if a body box of repeated
identical paragraphs got the same sentence in every line. Run it after every
build and fix the copy until it prints `✓ No fill defects`.

Then reopen the output and confirm the slide count, that each slide's shapes
still carry the canonical names (e.g. `Google Shape;…`), and render to images
(`soffice --headless --convert-to pdf` then `pdftoppm`) and eyeball every slide.
A side-by-side against the source canonical slide should differ **only** in the
text/images you swapped. (A Linux box without the brand fonts substitutes a
fallback font — that's a render artifact, not a deck defect; Google Slides has
the fonts natively.)

## Hand off

Save the `.pptx`, then: upload to Google Drive → right-click → Open with Google
Slides. Drive's converter preserves Inter and exact positioning. Tell the user
any assumption you made (compressed text, split slides, placeholder images) that
they should check.

## Using a different kind of slide

There is nothing to "add" — all 164 canonical slides are already available to
duplicate. To use a layout you haven't used before:

1. Browse the canonical deck (`--inspect <N>`) to find the slide whose existing
   structure matches your content's purpose and density.
2. Reference it as a `template_slide` in your plan and fill its placeholders.
3. If no canonical slide fits, do **not** build one — compress, split across
   duplicated slides, or get explicit user approval for a custom slide.

## Non-negotiables

- **Duplicate a canonical template slide; never generate one from scratch.** The
  breakdown rules pick WHICH existing template to duplicate, not permission to
  rebuild it. Replace only placeholders; preserve all geometry, spacing, fonts,
  colors, dividers, backgrounds, frames, tables, icons, shapes, and z-order.
- If content doesn't fit, pick another existing template, compress, or split —
  never silently resize, reposition, or redesign template elements.
- Custom slides only with explicit user approval that no template fits.
- Geometry, padding, colors, and z-order match the source (pixel-perfect).
- Never silently truncate; never drop a bullet/row without reporting it.
- Validate slot counts; raise rather than overflow.
- Verify in the rendered output, not just the code: every slide must trace to a
  duplicated canonical template (see `slide-builder/qa-checklist.md`).
