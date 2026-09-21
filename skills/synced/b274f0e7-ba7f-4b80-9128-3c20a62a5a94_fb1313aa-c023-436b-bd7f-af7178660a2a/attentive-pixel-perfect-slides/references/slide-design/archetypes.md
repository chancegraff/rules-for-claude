# Archetypes — narrative purpose → template family

> **⛔ NON-NEGOTIABLE — template selection means DUPLICATE, not rebuild.**
> Choosing a family/template here means **selecting the best-matching existing
> canonical template slide** (by slide number and category) and **duplicating it**
> into the working deck — never recreating its structure by hand. "Use slide 24" =
> duplicate slide 24 and fill it. "Use slides 91–116" / "choose from 131–164" =
> pick the best existing template in that range, duplicate it, and replace the
> data. A slide number is a reference to a physical template slide, not a design
> spec to rebuild. Replace only placeholder text, images, charts, tables, and
> data; preserve all geometry, spacing, fonts, colors, dividers, backgrounds,
> frames, icons, shapes, and z-order. If content won't fit, pick a different
> existing template, compress, or split — never resize/redesign template elements.
> Custom layouts only with explicit user approval that no template fits.
>
> **Before creating any slide, answer internally:** (1) which canonical template
> slide am I duplicating? (2) why does that template fit the content? (3) which
> existing placeholders am I replacing? (4) will the content fit without changing
> template geometry? (5) if not — compress, split, or pick another template?
> **QA (required):** every generated slide must originate from a duplicated
> canonical template slide; flag any from-scratch slide as a **FAILURE** unless
> the user explicitly approved a custom slide.

The design skill's job is to match the **narrative purpose** of a piece of
content to the right template family, given its **density**, then apply the
brand treatment. This catalog maps purpose → family → the content each family
needs. A family choice is a decision about **which existing canonical slide to
duplicate** — there is no generator to route to. You then fill the duplicated
slide via a `build_from_plan.py` plan step (`text` / `shapes` / `runs` /
`tables` / `divider`). The "block keys" columns below describe the shape of
content each family wants; that same shape is what `antibland.suggest(block)`
reads when it ranks candidate canonical slides and flags a flat pick for you.

Pick by purpose first, then check density against the
[slot contracts](../slide-formatting/slot-contracts.md).
If content overflows, the formatting skill decides compress vs. split — design
does not solve overflow by shrinking type.

## Titles & headers — short and sweet, on ONE line

A content-slide header is a **headline, not a sentence**. Write it short enough
to sit on a **single line**, and keep any subtitle short and one-line too — push
the detail into the body. A few words beats a full clause: "The payoff" not "The
consolidation payoff you get from switching"; "Enterprise email" / "Not a
bolt-on" not "Email built to drive revenue / Enterprise email, not a bolt-on".
This is what keeps a title from wrapping into the cards, stats, or icons beneath
it. The builder auto-widens the header box to hold a short title on one line
(within the free space beside it), and the pre-flight flags any header too long
to ever be one line — but the fix is always to **shorten the copy**, not to hope
the box stretches. Display titles (covers, section breakers, statements) keep
their intended large multi-line styling; this rule is about content headers.

## Deck variety — vary the family across the deck (first-pass requirement)

A deck that reuses one family for most of its body reads as bland, even when
every slide is individually correct. **Diversity is a first-pass requirement, not
a later polish.** Plan the whole arc before filling slides, and spread the
families deliberately. **These rules are enforced by the pre-flight and now BLOCK
the build (like an overflow) — not just warn.**

- **The cap is per LOOK, not per family, and it is measured on CONTENT slides.**
  Look-alike families are collapsed into one "look" bucket so you can't dodge the
  count by alternating siblings: **`prose` (63–68) and `content_card` (73–77) are
  ONE look — `text_block`** (both are a title + paragraph). The **big-number
  KPI/stat layouts also merge**: `stat_trio` (80), the KPI summary (92) and the
  KPI row (104–107) are one `big_number` look, so three interchangeable number
  slides can't pass as variety. Everything else in data-viz stays its OWN look —
  a table (96–97), bar (93–95), trend (98/109/112), pie (99), stacked (101/111),
  matrix (103) and timeline (91) are all distinct, so a genuinely chart-diverse
  deck is never penalised. Dividers, covers and closers don't count.
- **No look more than ⌈content/5⌉ times** (min 2) — that's **3 for a 20-slide
  deck** (~12 content slides) — and **never more than 2 slides of the same look in
  a row.** Alternating 73 / 75 / 68 is still five `text_block` slides and will be
  refused. A run of paragraph slides is the classic failure — break it with a
  statement, columns, a stat/data-viz, a card grid, a comparison, a testimonial,
  or a timeline.
- **`text_block` gets a stricter cap on larger decks:** on a deck of **≥15 total
  slides** it may appear **at most twice** (smaller decks keep the general cap,
  which is already 2 at that size, so this only bites on ~18–20+ slide decks
  where the general cap would otherwise rise to 3–4). The paragraph workhorse
  never dominates a big deck.
- **The same exact canonical slide may appear at most twice**, and a content deck
  must show a **minimum spread of distinct looks** (≥⌈content/4⌉). Both are gated.
- **Reach for the richer families by default,** not just prose. Most content has
  a more expressive home than a title+paragraph: parallel points → `columns`
  (69–72); proof/metrics → `stat_trio`/`dataviz` (80, 92, 91–116); a single idea
  → `statement` (60–62); grouped ideas → `card_grid` (81–84); a comparison →
  `comparison_table` (96, 156); a process → numbered/timeline (143, 159–164);
  customer voice → `testimonial` (49–58); a specific brand story → `case_study`
  (118–120). `text_block` (prose 63–68 + content_card 73–77) is for genuine
  narrative, **not the default for everything — treat it as capped budget you
  spend deliberately.**
- **These richer templates repeat a placeholder across their columns/cards/
  cells** (e.g. four identical "Title of section" + lorem in slide 71, three
  "40M total" in slide 80). Whole-slide find/replace can't fill them
  distinctly — fill them **per shape** with the builder's `shapes` / `tables` /
  `runs` plan keys (see attentive-slide-builder). Do **not** fall back to a prose
  template just because the richer one has repeated placeholders.

**Default pitch arc (a varied skeleton to start from, ~14–16 slides).** Adapt the
content, keep the family rotation:

1. `title_slide` (cover) · 2. `agenda` divider — *The opportunity* active
3. `statement` (the hook) · 4. `title_prose` or `split_image` (why now)
5. `agenda` divider — *Why we win* active · 6. `content_columns` (the reasons)
7. `agenda` divider — *Proof* active · 8. `stat_trio`/`dataviz` (the numbers)
9. `testimonial` (customer voice) · 10. `agenda` divider — *One platform* active
11. `content_with_card` or `comparison_table` · 12. `agenda` divider — *Getting
started* active · 13. numbered sequence (143) or timeline (159–164)
14. `content` next-steps · 15. `end` (closer)

The recurring `agenda` divider is the one intentional repeat — it is the section
tracker (see below), not a content family, and is exempt from the no-repeat rule.

The pre-flight reports variety by **distinct looks** (not just families) and a
per-look cap (`preflight_lint.py` → "Template variety"). A MONOTONY finding now
sets `ok_to_build = False`, so `build_from_plan.py` **refuses to build** exactly
as it does on overflow. `--force` overrides, but the right fix is to diversify
the templates, not to force past the gate.

## Section transitions — progress divider vs one-off breaker

Two different devices move a deck into a new section. They are **not
interchangeable**, and a deck must commit to **one** and use it **the same way
every time**. Mixing them — or dropping in a single decorative breaker — is the
most visible structural error in a deck.

**Progress divider — the reused agenda (preferred for any multi-section deck).**
The agenda / table-of-contents slide (24–28) does double duty: you show the full
contents once, then **reuse the same slide before each section with the current
item highlighted** (ink + bold) and the rest muted. It is a *recurring tracker* —
its whole value is that it repeats, so the audience always knows where they are on
the roadmap. Because it repeats by design, it is **exempt from the no-repeat
variety rule**. Drive it with the builder's `divider` plan key — same `sections`
list every time, bump `active`:

```json
{"template_slide": 27, "divider": {"sections": ["The opportunity","Why we win",
  "Proof","One platform","Getting started","Next steps"], "active": 2}}
```

**One-off breaker — a standalone full-bleed transition slide (30–47).** A breaker
is a single color / photo / panel slide carrying just a section title. It
**announces** "new section" but does **not** track position — it can't tell the
audience how far along they are. If you use breakers, use one **before every**
section and **rotate the accent color** so the set reads as a system.

**Choose one system for the whole deck:**

| Use… | when |
|------|------|
| **Single contents table** (one agenda, shown once, no `active`) | **small / short decks.** A table of contents up front with no mid-deck tracking. Legitimate and preferred when the deck is short enough that a running tracker would be overkill. **Not** a progress divider — just a contents slide. |
| **Progress divider** (reused agenda, `active` set) | 3+ sections; a roadmap the audience should track; most pitch/sales decks. **Default for longer decks.** |
| **Breakers, one per section** (rotating color) | short decks, or when each section wants a bold full-bleed color/photo moment and no tracker is needed |

**A single opening agenda is fine — the progress divider is all-or-nothing.**
Showing the agenda **once** as a table of contents (no `active`, no mid-deck
repeats) is a complete, valid choice, especially on a small deck. The
progress-divider *system* (reuse + highlight) is a **whole-deck commitment**: if
you reuse the agenda as a tracker, do it before **every** section with the
current one highlighted — or don't reuse it at all. Don't drop in a single
highlighted divider mid-deck and stop; that's an inconsistent tracker. For a
small presentation, prefer the single contents table and skip mid-deck dividers.

**Anti-patterns — all real mistakes:**

- ❌ One agenda up front as a table of contents, then a single breaker later — two
  half-systems. Pick one and use it at *every* transition.
- ❌ A lone decorative breaker used once in an otherwise divider-less deck.
- ❌ Mixing dividers and breakers in the same deck.
- ❌ A progress divider used **inconsistently** — reused a few times but not before
  every section, or one highlighted divider dropped in mid-deck. Track every
  section or none.
- ✅ **Not** a mistake: a single agenda / table of contents shown once with no
  `active` and no mid-deck repeats. That is a contents slide, not a broken tracker.

The fit pre-flight checks this and warns (mixed systems, a one-off breaker, an
agenda reused 2+ times that never highlights) under "Section transitions" — but it
**does not** flag a single contents agenda, at any deck size. Fix warnings before
building.

| Purpose | Family | Block keys | Design treatment |
|---------|--------|-----------|------------------|
| **Open the deck (preferred)** | `title_slide` | `title_slide:true, title, subtitle?, image_path?, prefer?` | One of the 7 canonical openers (slides 13–19), chosen by fit — see below. |
| Open the deck (generic) | `cover` | `cover:true, eyebrow, title, subtitle` | Ink/yellow canvas opener for non-standard covers. Prefer `title_slide`. |
| **Move into a new section** | **progress divider** *or* `section_breaker` | `divider:{sections,active}` — or `section_breaker:true, title, color?` | Reused agenda with the active item highlighted (**preferred tracker**), OR a full-bleed breaker (30–47) used before *every* section. Commit to ONE — see "Section transitions". |
| Roadmap of the talk | `agenda` | `sections[≤10], active?` | One of 5 canonical layouts by section count — see below. |
| Make an argument with support | `content_with_card` | `topic, header, bullets[≤4], panel` | The workhorse. 4-line header, arrow bullets, cream card or yellow image panel right. |
| Explain a process / parallel ideas | `content_columns` | `topic, title, columns[2–4]{head,body}` | Equal columns; bold heads; no dividers between. |
| Contrast / editorial moment | `split_image` | `topic, header, body, image_path` | Big right image (rounded), short left copy. No wordmark (image owns the corner). |
| Prove impact with numbers | `stat_trio` | `topic, title, cards[1–3]{number,caption,name,source}` | Yellow cards; serif italic numbers; short captions. |
| Customer voice / quote | `testimonial` | `quote, name, source, image_path?, color?` | Canonical full-page serif quote (slides 49–58); headshot variant if an image is given — see below. |
| Compare options / metrics | `comparison_table` | `topic, title, headers, rows` | Ink header row, cream banding; respect per-column width. |
| Pillars / focus areas / problems | `card_grid` | `topic, title, cards[3–4]{title,body,glyph}` | Cream cards, accent icon dots cycled per card. |

## Title slides — choosing the deck opener (slides 13–19)

The first slide of any new deck must be one of the seven canonical title
templates, **never a custom layout**. The title is Libre Baskerville serif. Pick
by the title's and subtitle's character length and line count so the text fits
the template's intended size — do not shrink, stretch, or reflow:

1. **No subtitle, short title (≤22 chars):** big 55pt title-only.
   - `13` yellow + a hero **photo** with the "A" cutout (when you have an image),
   - `14` yellow + the tonal **"A" watermark** (default, graphic),
   - `15` cream + **plain** (minimal / quiet).
2. **Title (≤33 chars) + short subtitle (≤30 chars):** 37.5pt title.
   - `16` yellow + tonal-A, `17` cream + plain.
3. **Title (≤33 chars) + longer subtitle (≤100 chars, 2 lines):** 37.5pt title.
   - `18` yellow + tonal-A, `19` cream + plain.

Pick the variant whose title/subtitle character budget your copy fits
(`--inspect 13`…`19` shows the exact placeholder text). Choose the finish
deliberately: cream/plain (15/17/19) for a minimal look, tonal-A (14/16/18) for
graphic, the photo cutout (13) when you have a hero image. If nothing fits at the
intended size, **compress the title/subtitle or ask for approval before changing
meaning** — never drop to a smaller font to force it. The final slide must look
like a native title slide from the deck, not a custom approximation.

## Section breakers — one-off transition slides (slides 30–47)

> **First decide divider vs breaker** ("Section transitions", above). A breaker is
> the **one-off** device: a standalone slide that *announces* a new section but
> does **not** track position. For a multi-section roadmap, prefer the reused
> agenda **progress divider**. If you choose breakers, that is a **whole-deck
> commitment**: one before **every** section, rotating color — **never** a single
> decorative breaker, and never mixed with dividers.

A breaker resets attention and orients the audience at a section boundary. Select
from slides 30–47 only; never build a custom breaker. Unlike titles/agendas there
is no count rule — choose by the section title's length, tone, and the
surrounding flow. Three families × four accent colors:

- **solid** (30–33): a full-bleed accent color with a centered Libre Baskerville
  title. Text is ink on yellow, off-white on green/blue/orange.
- **photo** (34–43): the same accent canvas with a large centered circular photo
  and the title over it (off-white). Use when the section is about people /
  customers / stories.
- **panel** (44–47): a cream canvas with a left colored "A"-monogram panel and
  the title on the right. The most branded / formal option.

Choose the style by what the section needs — photo (34–43) when it's about
people/customers/stories, solid (30–33) otherwise, panel (44–47) for the most
formal option — and **rotate the accent color across successive sections** so
each reads as distinct. Keep titles ≤~50 chars (2 lines at 30pt); a longer title
is **rewritten shorter while preserving meaning**, never shrunk or crowded. The
result must feel like a native transition slide from the deck.

## End slide (slides 126–129) — required closer

**Every deck must end with exactly one end slide.** Include exactly one of
126–129 as the last step of your plan (the builder duplicates only what you
list — it does not append a closer for you). Four canonical variants =
background × optional "Thank you!":

- **126** yellow + "Thank you!" + tonal A + big wordmark
- **127** cream + "Thank you!" + big wordmark
- **128** yellow + tonal A + wordmark (no closing text)
- **129** cream + wordmark (no closing text)

Pick by tone: `warm`/`customer` → a "Thank you!" variant (126/127); `minimal`
→ cream (127/129); `bold` → yellow (126/128). Keep any closing text concise
(≤~40 chars). Use only 126–129 — never a custom closer.

## Demo slides (slides 122–124)

Use a demo slide to make the product concrete — a workflow, a platform screen, a
step-by-step example. Pick from the three canonical templates by demo format:

- **`speaker` (122, dark):** an intro card — circular headshot + name (Inter
  SemiBold 26pt, yellow) + company/title + a brand logo line. For introducing a
  person or brand before a live demo.
- **`moment` (123, dark):** an annotated product moment — "Product demo" pill +
  headshot + headline (yellow) + subhead + a short body. For one key screen.
- **`workflow` (124, light):** a before/after or step sequence — pill + title +
  **2–4 screenshot frames** with arrow connectors, side annotations, and an
  optional gap label ("A few days later…").

Place real screenshots into the existing frames and keep the template's crop;
**if none are available, use the placeholder treatment** rather than inventing a
visual style. Keep annotations/labels concise. **Don't overcrowd** — the
workflow caps at 4 steps; a longer workflow **splits across multiple demo
slides**. Don't stretch or distort screenshots to fit.

## Case-study slides (slides 118–120)

Use a case study to tell a specific customer/brand story — context, challenge,
solution, results, proof. Pick from the three canonical templates by **story
density**:

- **`stats` (118):** title + an optional quote and product screenshots + **three
  stat blocks** (Libre Baskerville 38pt over yellow pills). The richest,
  results-led layout.
- **`narrative` (119):** eyebrow + title + a **long body** (~780 chars) + a
  product image card on the right + a quote card bottom-left.
- **`text` (120):** serif title + **two short paragraphs** (story + outcome) +
  up to two yellow stat pills + a right image/logo card. The simplest.

Rules: preserve the customer name, the quoted language, and the metrics exactly.
Keep copy within the template's density (a `text` body is ≤~500 chars; a
`narrative` body ≤~780). Don't force a long story into a sparse template or drop
proof — if it won't fit, **split into multiple case-study slides** or summarize
with approval (the builder reports, e.g. "3 stats but 'text' holds 2", rather
than silently omitting). Preserve the image/logo crop and the stat/quote
treatment of the chosen template.

## Fallback / extended templates (slides 131–164)

**Secondary templates — reach for these only when the primary content slides
(60–89) can't hold the amount or format of content.** Choose by structure first,
then character count, and **duplicate** the canonical slide (131–164) whose
structure matches. The pre-flight validates the counts and rejects overflow, so
nothing is silently dropped (bullets, rows, columns, stats, phases, or items).

- **131–148 — extended bullet & proof:** 2/3/4-line headers × 4–6 bullets, with
  optional subhead, two stats, a large metric, two proof cards, QX/future
  badges, or a numbered sequence. (e.g. 131 long-header + four bullets, 137 three
  detail blocks, 142 five bullets + QX badges.)
- **149–158 — structured alternatives:** 3 negative / 3 positive point cards,
  3 detail / 3 example columns, 4 areas of focus, 4 role cards, 4 problem cards,
  a binary comparison table, a long-description comparison table, 6 areas.
  (149 three negative points, 154 four role cards, 156 binary comparison table,
  158 six areas of focus.)
- **159–164 — timelines:** 5-phase, 4-phase, 2-workstream, swimlane, 9 story
  blocks, 9 "important-thing" blocks. (159 five-phase timeline, 162 swimlane
  timeline, 164 nine "important-thing" blocks.)

Match the placeholder character density; if content still doesn't fit, split
across multiple slides or compress. Preserve bold lead-ins, metric styling, QX
badges, the comparison-table formatting, and timeline labels when present.

## List markers — pick the bulleted template by the list's MEANING

A bulleted section's **marker carries meaning**. A template whose native marker
contradicts the content is a brand error as visible as a wrong color. Before you
route bulleted content to a template, classify the list on two axes — *is it
ordered?* and *what is its polarity?* — then pick the template whose native marker
matches:

| The list is… | Correct marker | Route to canonical | Never use |
|---|---|---|---|
| An **ordered sequence** — steps that must happen in order, ranked items, a numbered process | `1. 2. 3.` auto-number | **143** (numbered "sequence"), timelines **159–164** | a ●/✓/✗ list — numbers imply an order that isn't there |
| **Positive** points — benefits, wins, capabilities, "what works", things we did | green **✓** check | **144, 150**, 131–135, 140–148 | **✗** (reads as failure), numbers (imply ranking) |
| **Negative** points — problems, blockers, limitations, "what doesn't work", risks | red **✗** cross | **149** | **✓** (reads as a win), numbers |
| **Neutral / mixed** — a plain unordered list: context, observations, a problem stated without per-item polarity | neutral **●** dot or **→** arrow | **65, 81** (native ● dot); or the arrow-bullet motif | ✓/✗ (adds a polarity the content lacks), numbers |

**The two mistakes to watch for (both seen in real decks):**

- **Numbers where there is no sequence.** 143 auto-numbers its bullets — its header
  literally reads "explains a sequence." Only send genuinely ordered content there.
  Four loose observations are **not** a sequence: use a ● dot / → arrow list
  (65/81), or re-mark 143's list to `●` (see below).
- **✓ / ✗ that fights the content.** 149 (✗) is for **negative** points; 150 (✓)
  and 144 (✓) for **positive**. A game plan or benefits list on 149 marks every
  step as a failure; a problem/blocker list on 150/144 marks every problem as a
  win. Match the check/cross to polarity, or drop to a neutral ● dot.

When no canonical template pairs the **right marker** with the **layout you need**
(e.g. you need header + bullets + image, which only the ✓ template 144 or the
numbered template 143 provide, but the content is neutral), it is an allowed,
user-serving fix to **re-mark the duplicated template's list** — swap its
`buAutoNum`/`✓` for the deck-native `buChar ●` used on slide 65. This reuses a
marker the **same deck already ships**; it is not inventing a new style, and it
does not touch geometry, font, color, or position. **Never** invent a marker glyph
the deck doesn't use, and never re-mark to force a polarity onto content.

## Data-visualization slides (slides 91–116)

Use a data-viz slide for numbers, trends, comparisons, metrics, or proof points.
**These are shape-based** — the canonical deck draws each chart from rectangles,
connectors, freeform fills, pie shapes, and number grids, so the shapes already
exist on the canonical slide. Treat them as charts, not text slides: **duplicate
the slide and fill its data** via the builder's per-shape `shapes` / `tables` /
`runs` keys — never redraw one. Pick by data type first, then visual fit:

| Data type | Layout | Canonical |
|-----------|--------|-----------|
| Timeline / milestones | timeline | 91 |
| 3 headline KPIs | three-KPI summary | 92 |
| Bar comparison | bar chart | 93–95, 110 |
| Table (rows/cols) | data table | 96–97 |
| Composition / share | pie chart | 99 |
| Stacked bars / segments | stacked bar | 101, 111 |
| Dense matrix / heatmap | matrix comparison | 103 |
| Row of big KPIs | KPI row | 104–107 |
| Quote + data proof | quote + data | 108 |
| Trend / time-series | trend chart | 98, 105, 109, 112 |

Rules: pass **structured data**, not pasted text. Keep numeric formatting
consistent (pass pre-formatted `value_labels` like "$120M", "20%"). Preserve
emphasis — the highlighted KPI/bar stays yellow (or ink) and dominant. Don't
overcrowd: each chart caps its categories/rows (bars ≤8, matrix ≤8×10, pie ≤6);
beyond that, simplify, split across slides, or pick another data-viz template.
Never silently drop a bar, row, slice, or segment — the templates validate
counts and raise. Brand yellow is the primary series; secondary series cycle
blue → olive → orange.

**Repurposing a comparison table (156, 157) for a non-comparison — relabel ALL
its headers, including the logo.** The comparison tables carry a baked-in
"Attentive vs. a competitor" identity: text headers that read **"Category"** and
**"Competitor"**, *and* a middle-column header that is the **Attentive wordmark
as a picture** (not text). If you reuse one of these tables for something that
isn't an Attentive-vs-competitor comparison (e.g. a rubric or a generic
attribute table), those native headers are **wrong and misleading** and must all
be handled:
  - Relabel the two **text** headers (`"Category"`, `"Competitor"`) to your real
    column names via a per-shape `text` swap.
  - **Neutralise the wordmark picture header.** You can't set text on a picture,
    so `replace_image` that shape with a small solid PNG **filled in the slide's
    canvas colour** (`#FCFAEE` cream) so it blends away — leaving that column
    header blank. (A fully transparent PNG can render as a grey box in some
    engines; a canvas-coloured fill is robust everywhere.) Then bake the column's
    meaning into the **cells** (e.g. lead each cell with its scale, "None (1)" …
    "Rich chart (5)") so the blank header isn't confusing.
  - Clear the boilerplate **disclaimer** text box if it isn't relevant.
  - Only worth it when you genuinely want the table *look*; otherwise a card grid
    or columns may say it more directly. Always render and eyeball — the headers
    are the thing that most often stays "wrong" after a table repurpose.

## Content slides — the body of the deck (slides 60–89)

Content slides carry the substance. Study them as a system and choose by
**content type** and **density** — never invent a custom layout when one of
60–89 fits, and never force dense content into a sparse template (or vice versa).
Match the block's keys to a family below, then duplicate that canonical slide;
`antibland.suggest(block)` ranks the candidates and flags a flat pick if you want
a second opinion.

| Content type | Family | Block keys | Canonical |
|--------------|--------|-----------|-----------|
| Single statement / transition thought | `statement` | `statement, topic?, emphasis?, image_path?` | 60–62 |
| Narrative explanation | `title_prose` | `topic, title, prose, image_path?` | 63–68, 73–77 |
| Several related ideas / pillars / steps | `content_columns` | `topic, title, columns[2–5]` | 67–72 |
| One idea + bullets + a supporting panel | `content_with_card` | `topic, header, bullets[≤4], panel` | 73–77 |
| Left/right split (narrative + image) | `split_image` | `topic, header, body, image_path` | 78–80 |
| Proof points / stats | `stat_trio` | `topic, title, cards[1–3]{number,caption}` | 80 |
| Modular cards / grouped ideas | `card_grid` | `topic, title, cards[3–4]` | 81–84 |
| Visual/caption-led (screenshots, logos, examples) | `caption_grid` | `topic, title, captions[3–4]{label?,caption}` | 85–89 |

Density rules: if content overflows the chosen template, **shorten the copy,
split across multiple slides, or move to a denser template** — do not shrink the
font below the template's hierarchy or crowd the slide. Preserve the character
density the template demonstrates (e.g. a `statement` is one focused idea ≤~70
chars; a `title_prose` intro is ≤~260 chars; column bodies ~230 chars each).

- **statement** (60–62): 38pt Libre Baskerville, one italic emphasis word, on
  cream or full-bleed over a photo (white text). **Two things differ across the
  three and must both be checked:**
  - **Contrast (legibility).** The cream variant (60) is always legible — ink on
    cream. The photo variants (61, 62) put white text over an image and are only
    legible when the region **behind the centred text** is dark; a bright area
    (e.g. a window) makes the text vanish. Prefer **cream (60)** for guaranteed
    contrast; use a photo statement **only** when you've confirmed the area behind
    the text is dark. Never ship a photo statement without eyeballing the render.
  - **Capacity.** The variants hold different amounts: **cream 60 ≈ 29 chars**,
    the photo variants more (**62 ≈ 58 chars**). Pick by copy length *and*
    contrast — and if the punchy line only fits the photo box, shorten it to fit
    the cream box rather than sacrificing legibility. (The pre-flight flags a
    statement that overflows its box, but it can't see contrast — that's a render
    check.)
- **caption_grid** (85–89): 3 or 4 images across with a short caption (bold
  label + body) beneath each; images below the title, captions at the bottom.

## Testimonials — quote slides (slides 49–58)

Use a testimonial slide **whenever you add a customer / partner / employee quote**
— for credibility, social proof, or a human voice. Select from slides 49–58
only. The rule is image availability:

- **No person image → slides 49–53:** a full-page Libre Baskerville quote (37.5pt,
  first sentence bold, curly quotes) with the attribution (name bold + title/
  company) bottom-left.
- **Person image / headshot → slides 54–58:** a circular headshot top-left with
  the attribution below it, and the quote on the right.

Both families come in five backgrounds — `cream` (default), `yellow`, `green`,
`blue`, `orange` — with ink text on cream/yellow and off-white on green/blue/
orange. Use the with-image family (54–58) when you have a headshot, the full-page
quote (49–53) otherwise. Keep quotes ≤~145 chars (≈5 lines); a longer quote
is **shortened while preserving the speaker's meaning and tone**, never shrunk or
crowded. Headshots are circle-cropped. The result must look like a native
testimonial slide from the deck.

## Agenda / table of contents — choosing by section count (slides 24–28)

The agenda layout is dictated by the number of major deck sections, **not** by
taste. Count the sections and use the matching canonical template — never a
custom agenda layout, and never squeeze extra sections into a lower-capacity
slide:

- **3 → slide 24**, **4 → slide 25**, **5 → slide 26**: a "Table of contents"
  serif heading with one **column per section**, each topped by a colored accent
  divider bar (cycle yellow → olive → blue → orange → soft-yellow). Each column
  can list a few sub-topics under it (Inter, mid-gray).
- **6 → slide 27**: a yellow "A" panel on the left and a serif vertical list of
  the six sections on the right; pass `active` to highlight the current section
  (it doubles as a between-sections progress divider).
- **7–10 → slide 28**: a serif numbered list (number + section name).

Select the agenda by section count (above), then duplicate that slide. Keep
section labels concise (≤~26 chars for the column layouts, ≤~34 for the numbered
list);
if a label is too long, **rewrite it shorter while preserving meaning**. For
**more than 10 sections**, split the agenda across slides or ask how to
consolidate — there is no canonical 11+ agenda. The result must look like a
native table-of-contents slide from the deck.

### Use an agenda as a progress divider only when the deck needs tracking

A single unhighlighted agenda is a valid table of contents for a short deck. For
longer decks that need progress tracking, reuse the same agenda layout before
**every** section with the current item highlighted (ink + bold) and the rest
muted. Reuse the **same section list** on every instance so it reads as one
consistent tracker; just move which item is `active`. The clean vertical list of
**slide 27** (and the numbered **slide 28**) reads best as a recurring divider;
the column layouts (24–26) work too but carry sub-topics you would repeat.

Build each divider with the builder's `divider` plan key (it fills the section
labels and applies the active/muted styling for you):

```json
{"template_slide": 27, "note": "section: proof",
 "divider": {"sections": ["The opportunity","Why we win","Proof",
                          "One platform","Getting started","Next steps"],
             "active": 2}}
```

Omit `active` for a standalone contents slide or for the opening instance of a
tracker. If you start a tracker, use it consistently before every section. See
"Section transitions" for divider-vs-breaker rules and pre-flight checks.

## Choosing by density

- **One number that matters** → a single `stat_trio` card (hero), not a
  paragraph. Let it breathe.
- **3–5 supporting points** → `content_with_card`. 6+ points → split into two
  slides or move to `content_columns` if they're parallel.
- **A genuine comparison (≥3 rows × ≥3 cols)** → `comparison_table`. Two items
  with prose → `content_columns` instead; a table of two looks thin.
- **A quote** → `testimonial`, never a bullet. Attribution is required.
- **Pillars/areas** → `card_grid` at exactly 3 or 4. At 5–6, split or use two
  rows on successive slides.

## Mood per slide

Each slide picks **one** canvas mood — don't blend:

- **Off-white `#FCFAEE`** — default content. ~70% of slides.
- **Yellow `#FFD60B`** — section dividers, the occasional accent cover.
- **Ink `#1E1C1C`** — cover and rare dramatic call-outs (light text).

Accent yellow inside a content slide (cards, stat fills, image holders) is fine
on an off-white canvas; a full yellow canvas is reserved for dividers/covers.

## Emphasis

- One italic key word per title (Inter italic) — not the whole title.
- Serif italic (Libre Baskerville) is reserved for quotes and stat numbers.
- Bold-italic lead-ins start a bullet ("**Recognize mobile shoppers** by …").
- Don't stack emphasis: a slide has one focal element, not five.
