# Attentive Slide Design (pass 2: brand judgment)

Slide generation is two passes. **This skill is pass 2**: once a slide is
mechanically correct (geometry, fit, no overflow — handled by
`attentive-slide-formatting`), apply Attentive's 2026 brand judgment. Color,
motifs, image treatment, emphasis, and the choice of template family for the
content's purpose and density.

Do not run this before formatting. Picking a beautiful palette for a slide whose
header overflows just hides the defect. Get it correct, then make it Attentive.

> **⛔ NON-NEGOTIABLE:** you are **not** designing new slides — you are choosing
> which **existing canonical template slide** to duplicate and fill. Template-
> family choice = selecting the best-matching existing template slide by number
> and category, then duplicating it. Replace only placeholder text, images,
> charts, tables, and data; preserve all original geometry, spacing, fonts,
> colors, dividers, backgrounds, frames, icons, shapes, and z-order. Never draw a
> new layout, and never add cards/dividers/icons/decorative elements a template
> already has. If content doesn't fit, pick a different existing template,
> compress, or split — never resize or redesign template elements to force a fit.
> Build a custom slide **only** with explicit user approval that no template fits.
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

- Turning content into on-brand Attentive slides (after formatting, before/with
  the builder).
- Choosing the right template family for a piece of content's narrative purpose.
- QA: does this deck match the Attentive 2026 brand system?

## What this skill owns

Color and canvas mood · section dividers · motifs (topic labels, stat cards,
quote cards, icon dots, arrow bullets, tables) · **list-marker semantics** (which
bulleted template by the list's order/polarity) · **copy voice** (wording, tone,
approved terms/trademarks — via the `attentive-brand-voice` skill) · image
selection, cropping, and framing · visual emphasis (italic, serif accent) ·
template-family choice by purpose and density. It does **not** own geometry, fit,
or overflow — that is pass 1.

## The system in one screen

- **Two fonts:** Inter (primary) and Libre Baskerville (serif accent, italic for
  quotes and stat numbers). Italic is the primary emphasis treatment.
- **Three canvas moods, one per slide:** off-white `#FCFAEE` (content, ~70%),
  yellow `#FFD60B` (dividers/accent covers), ink `#1E1C1C` (cover, light text).
- **Accent palette codes meaning:** yellow `#FFD60B` (primary), soft yellow
  `#F6DA71`, olive `#6E8A09`, blue `#6079DC`, orange `#DF6A30`. Pick by meaning,
  not aesthetics.
- **Preserve canonical fills:** do not add shadows, gradients, or heavy outlines;
  retain any inherited canonical treatment exactly. Cards and image frames are
  `roundRect`. Bullets are arrows (`→`), not theme dots.
- **List markers carry meaning:** numbers only for ordered sequences, green `✓`
  only for positive points, red `✗` only for negative points, neutral `●`/`→` for
  plain unordered lists. Pick the bulleted template by the list's meaning — see
  [slide-design/archetypes.md → "List markers"](slide-design/archetypes.md).
- **Logo:** dark wordmark top-right on light canvases; yellow on dark/yellow;
  omit on full-bleed image slides.

Full numbers in [slide-design/design-tokens.md](slide-design/design-tokens.md).

## Workflow

1. **Confirm formatting passed.** Content fits its slot contracts (pass 1). If
   not, return to `attentive-slide-formatting` first.
2. **Choose the template family by purpose and density.** Use
   [slide-design/archetypes.md](slide-design/archetypes.md) — purpose → family →
   block schema.
2b. **Plan the whole deck for variety — up front, not as polish.** Spread the
   families: no **look** more than ⌈content/5⌉ times (~3 in a 20-slide deck),
   never >2 of the same look in a row, same exact slide ≤2×. Look-alikes count as
   ONE look: `prose`+`content_card` = `text_block`; `stat_trio`+KPI (80/92/104-107)
   = `big_number` (other data-viz — table, bar, trend, pie, timeline — stay
   distinct). On **≥15-slide decks `text_block` is capped at 2**. Reach for the
   richer families (columns, stat/data-viz, statement, card grid, comparison,
   timeline, testimonial, case study) instead of defaulting to a paragraph
   slide. This is **gated — a monotonous plan is refused at build**, not just
   warned. Start from the default pitch arc and use ONE consistent
   section-transition system (the reused
   agenda progress divider is preferred). See
   [archetypes.md → "Deck variety"](slide-design/archetypes.md). The fit pre-flight
   flags monotony — heed it like an overflow.
2c. **Score the plan for vividness (anti-bland) — variety is necessary, not
   sufficient.** A deck can be perfectly varied in *layout* and still read as
   bland: all low-impact, text-dense, and proof-free. The anti-bland layer
   (`attentive-slide-builder/antibland.py`, backed by `slide_scores.json` — every
   template rated 1–5 on **data-viz / text-density / high-impact**) closes that
   gap. Use it two ways:
   - **While authoring** — call `antibland.suggest(block)` on a content block to
     see the vivid home vs. the flat one. It profiles what the *content* wants
     (a metric like "$80B" or "10+ hours" → route to a stat/KPI/chart, not a
     bullet; a single idea or quote → a statement/testimonial, not prose) and
     ranks candidate canonical slides, weighting impact and data-viz above raw
     density. Heed its `bland_flag`.
   - **At build** — `preflight_lint.py` now runs `vividness_report()` beside the
     monotony and transitions checks. Two **hard floors gate the build** (refused
     like an overflow, `--force` to override): a deck of ≥4 argument slides with
     **no data-viz slide** (proof reads as assertion), and **>2 low-impact text
     slides in a row** (a wall of words, even if the looks differ). Softer notes
     (flat mean impact, no hero moment, high bland ratio) advise. Toggle the gate
     with `antibland.GATE_ON_VIVIDNESS`.
3. **Match motifs to a canonical slide.** Section labels, stat/quote cards, icon
   dots, arrow bullets, and tables already exist on the canonical slides —
   [slide-design/motifs.md](slide-design/motifs.md) documents them. This skill is how
   you decide *which canonical slide* (with the motifs you need) to duplicate and
   *which accent* codes the slide. You never draw these; you pick the slide that
   already has them.
4. **Treat images.** Select, crop-to-fill, and frame in a rounded rectangle —
   [slide-design/image-rules.md](slide-design/image-rules.md). Use the yellow
   placeholder until a real asset is in hand.
5. **Set emphasis.** One italic key word per title; serif italic only for quotes
   and stat numbers; one focal element per slide.
5b. **Write/QA the copy in the brand voice.** Every text field (topic label,
   header, body, bullets, stat text, quote, caption) must read as Attentive —
   run it through the bundled [brand-voice reference](brand-voice.md).
   Lead with customer value, cut banned words and hype, use active voice and
   Attentive's mechanics, and get product names/trademarks right on first mention.
   The word choices are as much a brand decision as the palette.
6. **QA against the brand.** One canvas mood per slide; exact hex from the
   palette; no newly added shadow/gradient; arrow bullets; logo placed/omitted
   correctly; image frames rounded; no off-system fonts; **copy passes the
   `attentive-brand-voice` checklist** (no banned terms, correct trademarks,
   "Attentive" not "Attentive Mobile").

## Files

- `slide-design/design-tokens.md` — palette, type scale, geometry, spacing
  (measured from the deck's own spec slides + theme).
- `slide-design/motifs.md` — how to draw each recurring decorative element.
- `slide-design/image-rules.md` — image selection, cropping, framing.
- `slide-design/archetypes.md` — narrative purpose → template family + density
  guidance.
- `../attentive-slide-builder/antibland.py` + `slide_scores.json` — the anti-bland
  decisioning layer: per-template 1–5 scores (data-viz / text-density / high-impact),
  the `suggest()` selection advisor, and the `vividness_report()` build gate.

## Non-negotiables

- **Choose and duplicate an existing canonical template slide; never design one
  from scratch.** Family choice selects WHICH template to duplicate, not
  permission to rebuild it. Replace only placeholders; preserve all geometry,
  motifs, frames, and z-order. Custom slides only with explicit user approval.
- Design decisions use Attentive's **actual** palette, motifs, image style, and
  template families — measured from the canonical deck, not invented.
- **Vary the template looks across the deck** (gated, not just a guideline): no
  look more than ⌈content/5⌉ times, never >2 in a row, same exact slide ≤2×
  (`prose`+`content_card` are one `text_block` look); use the richer families,
  not paragraph-by-default; commit to one consistent section-transition system.
  A monotonous plan is refused at build.
- **Keep the deck vivid, not just varied** (gated): a body of ≥4 argument slides
  must show at least one data-viz slide, and never stack >2 low-impact text slides
  in a row. The anti-bland vividness gate refuses a bland plan at build; route
  metrics and single ideas to stat/KPI/chart/statement/quote templates.
- Design happens **after** formatting, never before.
- One canvas mood per slide; the system is flat and geometric.
- The accent color codes meaning; don't substitute for aesthetics.
- **All copy is written in Attentive's brand voice** via the
  `attentive-brand-voice` skill — on-voice wording, approved terms and
  trademarks, no banned words. Off-voice copy fails brand QA just like an
  off-palette color does.
