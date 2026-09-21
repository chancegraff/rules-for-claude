---
name: attentive-pixel-perfect-slides
description: Use when creating, converting, editing, or QAing Attentive PowerPoint decks with the canonical 2026 template, including new presentations, rebranding existing decks, and checking brand or layout fidelity.
---

# Attentive Pixel-Perfect Slides

Create editable `.pptx` decks by duplicating and filling approved slides from the
bundled 164-slide Attentive template. Vanessa Kuras maintains this skill.

## Non-negotiable method

Every output slide must trace to one physical canonical slide number. Use
`attentive-slide-builder/build_from_plan.py`, which duplicates the selected slide
and replaces only its content. Never recreate a template layout with blank
slides, `add_slide()` plus shapes, or hand-written OOXML geometry.

If no canonical slide fits, shorten the copy, split the content, or select a
different canonical slide. Build a custom layout only after the user explicitly
approves that exception.

Before beginning, read the resources that match the task:

- New deck: [brand voice](references/brand-voice.md),
  [formatting](references/slide-formatting.md),
  [design](references/slide-design.md), and
  [builder](references/slide-builder.md).
- Existing-deck conversion: follow the structural extraction and mapping-approval
  steps below before building.
- Final QA: read the [QA checklist](references/slide-builder/qa-checklist.md).
- Brand details: open [voice and tone](references/brand-voice/voice-and-tone.md),
  [messaging](references/brand-voice/messaging.md),
  [mechanics](references/brand-voice/mechanics.md),
  [terms and trademarks](references/brand-voice/terms-and-trademarks.md), or the
  [final checklist](references/brand-voice/checklists.md) as needed.
- Layout selection details: open
  [archetypes](references/slide-design/archetypes.md),
  [design tokens](references/slide-design/design-tokens.md), and
  [slot contracts](references/slide-formatting/slot-contracts.md) as needed.

## Workflow

### 1. Confirm the brief without inventing facts

Establish the audience, purpose, source content, and approximate slide count.
Ask only for missing information that would materially change the deck. Never
invent metrics, dates, owners, customer claims, links, or launch status. When the
user asks you to use judgment, make conservative assumptions and list them at
handoff.

For an existing deck, keep its structure intact and extract it directly:

```bash
python3 attentive-slide-builder/extract_source.py source.pptx \
  --rank --images-dir source-images --out source-blocks.json
```

Show a source-to-canonical mapping table and obtain approval before building.
The table must include source slide, narrative purpose, proposed canonical slide,
and any content that must be shortened, split, or omitted.

### 2. Write Attentive copy

Apply [brand voice](references/brand-voice.md) to every topic label, title, body,
bullet, statistic, quote, and caption. Keep content-slide headers short enough to
remain on one line. Preserve trademarks and approved product names exactly.

### 3. Check capacity, then choose canonical slides

Formatting comes before design. Use the slot contracts and fit rules to determine
whether each block fits. Never truncate. Compress, split, or paginate content
that does not fit.

Choose canonical slides by purpose and density using the archetypes and the
machine-readable builder data. Inspect the chosen slide and its known traps
instead of rescanning the entire template:

```bash
python3 attentive-slide-builder/build_from_plan.py --inspect 24
python3 attentive-slide-builder/slide_facts.py --slide 24
```

Answer these questions for every slide:

1. Which canonical slide am I duplicating?
2. Why does it fit the content?
3. Which existing placeholders am I replacing?
4. Will the content fit without changing template geometry?
5. If not, should I compress, split, or choose another template?

Pay special attention to repeated slots, reading order, positive/negative
variants, roadmap badges, inherited image crops, stock photography, comments,
speaker notes, hyperlinks, and empty placeholders. `slide_facts.py` records the
known traps.

### 4. Create and preflight the plan

Store the plan and output deck in the user's working directory, not inside this
skill. A slide number always means “duplicate this physical canonical slide,”
never “rebuild this design.”

```json
{
  "template": "Template—2026 NEW Attentive Company Deck Template.pptx",
  "slides": [
    {
      "template_slide": 16,
      "note": "cover",
      "text": {
        "Insert the name of the deck here.": "Six reasons to stay with Attentive"
      }
    },
    {
      "template_slide": 24,
      "note": "agenda",
      "text": {
        "Section 01": "Overview",
        "Section 02": "Results"
      }
    }
  ]
}
```

Matching is literal, so run `--inspect` before authoring each map. For repeated
placeholders, use the builder's per-shape `shapes`, `runs`, or `tables` fields;
do not use a whole-slide text replacement that would give siblings identical
copy.

```bash
python3 attentive-slide-builder/preflight_lint.py /path/to/plan.json --strict
```

Resolve every overflow, unmatched key, invalid slide number, monotony finding,
and transition inconsistency before building. Do not use `--force` or
`--no-lint` for a deliverable deck.

### 5. Build and verify

The scripts require Python 3 with `python-pptx`. Check the current environment
first. If it is unavailable, use an already-configured compatible runtime or tell
the user what is missing. Do not install packages into the runtime while using
this skill.

```bash
python3 attentive-slide-builder/build_from_plan.py \
  /path/to/plan.json /path/to/deck.pptx
```

Post-build structural verification runs automatically. If LibreOffice and
Poppler are already available, add `--verify-render` and inspect every rendered
slide at full size. Do not install system software as part of a deck request.

Before delivery, confirm:

- Every output slide traces to its canonical source number.
- Slide size is exactly 10 × 5.625 inches.
- There is no overflow, placeholder copy, empty structural placeholder, stray
  bullet, unresolved comment, unapproved note, unexpected hyperlink, inherited
  stock image, or accidental crop.
- Theme, masters, layouts, geometry, z-order, typography, colors, and logos are
  preserved except for an explicitly approved change.
- Titles retain their intended line count and all user-supplied facts are
  represented accurately.

Render-based checks do not replace a native Microsoft PowerPoint spot-check.
Call out that remaining limitation when native PowerPoint was not used.

### 6. Hand off clearly

Deliver the `.pptx` and list:

- canonical slide numbers used,
- assumptions or content compression,
- any unresolved font or native-rendering risk, and
- the recommended final human review.

For Google Slides, upload the `.pptx` to Google Drive and open it with Google
Slides. Keep the `.pptx` as the editable source of record until conversion is
confirmed.

## Included resources

- `attentive-slide-builder/`: canonical template plus the sanctioned duplication,
  inspection, extraction, linting, and verification tools.
- `attentive-slide-formatting/scripts/`: read-only audit and text-fit helpers.
- `references/brand-voice.md`: wording, messaging, mechanics, and trademarks.
- `references/slide-formatting.md`: fit rules and slot capacity.
- `references/slide-design.md`: template-family and brand-treatment decisions.
- `references/slide-builder.md`: detailed plan schema and builder behavior.
- `references/template-provenance.json`: pinned template identity, size, and
  slide count for release validation.
