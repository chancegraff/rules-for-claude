# Design tokens — Attentive 2026 system

The numerical truth of the Attentive slide system. **Every value below was
extracted from the bundled canonical deck** (`Template—2026 NEW Attentive
Company Deck Template.pptx`) — from the deck's own "Colors" and "Fonts" spec slides, its theme
color scheme, and `audit_pptx.py` measurements. Use these exact values;
approximating loses the polish.

> **System note.** This deck defines the **2026 Inter-based** Attentive system:
> primary typeface **Inter**, serif accent **Libre Baskerville**, canvas cream
> `#FCFAEE`/`#FAF4DF`, and accent yellow `#FFD60B`. This differs from an earlier
> Montserrat + `#FFF382` system some older workflows encoded. Do not mix the two;
> the bundled 2026 template is authoritative for this skill.

## Slide dimensions

**10 in × 5.625 in** (Google Slides 16:9). EMU: width `9144000`, height
`5143500`. Never the PowerPoint 13.333 × 7.5 default.

## Color palette

From the deck's "Colors" spec slide (slide 6) and the theme `clrScheme`. Three
roles — **canvas**, **ink**, **accent** — each color belongs to one role.

### Canvas (slide / panel backgrounds)

| Hex | Name | Theme | Use |
|-----|------|-------|-----|
| `#FCFAEE` | Off-white | lt1 | Default slide background. The paper. |
| `#FAF4DF` | Cream | lt2 | Warmer canvas; table banding; alt panels. |
| `#F4F2E6` | Card cream | — | Card / quote-panel fill (measured on components). |
| `#E5E5DD` | Warm gray | accent6 | Neutral panels, inactive states. |
| `#FFFFFF` | White | — | Card fill when you need crisp contrast. |
| `#1E1C1C` | Ink | dk1 | Cover / section-divider canvas (dramatic). |
| `#FFD60B` | Yellow | accent3 | Full-bleed section dividers, accent covers. |

### Ink (text)

| Hex | Name | Use |
|-----|------|-----|
| `#1E1C1C` | Ink | Primary text on light canvases. Default foreground. |
| `#FCFAEE` | Off-white | Text on ink/dark canvases. |
| `#91969C` | Mid gray | Secondary / source / attribution text. |

Do not use pure `#000000` for body text; the brand ink `#1E1C1C` is warmer.

### Accent (highlights, cards, icon dots)

| Hex | Name | Theme | Use |
|-----|------|-------|-----|
| `#FFD60B` | Yellow | accent3 | Primary accent: stat cards, image holders, highlights. |
| `#F6DA71` | Soft yellow | accent5 | Secondary yellow when the bright one over-saturates. |
| `#6E8A09` | Olive | accent4 | Category coding, positive icons. |
| `#6079DC` | Blue | accent2 | Category coding, data. |
| `#DF6A30` | Orange | accent1 | Category coding, emphasis. |

**Dark shade row** (from the under-swatch labels — use for text/dividers on the
matching accent, or for charts): `#D29C00` (dark yellow), `#303D00` (dark
green), `#2D36B0` (dark blue), `#720C07` (dark red).

Pick the accent that codes the slide's meaning; do not substitute for aesthetics.

## Typography

**Two families**, confirmed on the deck's "Fonts" spec slide (slide 3):

- **Inter** — primary. Weights used: Regular, Medium, SemiBold. Titles, body,
  labels, captions, attribution, table cells.
- **Libre Baskerville** — serif accent. Used for: quote text (italic), **card
  title chips** ("XXXX" / card labels on slides 8–10), stat data-point call-outs,
  and the large decorative **page headers** on the front-matter style-guide
  slides ("Colors", "Icon Library"). Sparingly, and never for body copy.

**Standard slide titles are Inter SemiBold, not serif.** The serif page headers
are specific to the internal style-guide pages; customer content titles use the
Inter SemiBold title style (confirmed in slide layout 35). Reserve Libre
Baskerville for the four uses above.

Italic is the primary emphasis treatment — heavier here than in most decks.
Italicize the key word in a title (Inter italic), a quote (serif italic), or a
big stat number.

### Type scale (measured)

| Role | Size (pt) | Font | Notes |
|------|-----------|------|-------|
| Cover / section title | 30 | Inter SemiBold | Large display. |
| Slide title | 22.5 | Inter SemiBold | Standard header. |
| Large header | 18 | Inter SemiBold | Alternate. |
| Body — default | 10 | Inter | Bullets, paragraphs. |
| Body — dense | 9 | Inter | Columns, cards. |
| Caption | 8 | Inter | In-card copy. |
| Source / attribution | 7 | Inter | Mid-gray. |
| Topic label | 9 | Inter SemiBold | Tracked caps (~0.6pt). |
| Stat number | 18–20 (in card) / 30 (hero) | Libre Baskerville italic | Short. |
| Display specimen | 70 | Inter / Libre Baskerville | Front-matter only. |

Default body is Inter 10pt; default title is Inter SemiBold 22.5pt.

## Spacing & geometry

- **Margins:** content left `0.2202 in`, top/right `0.25 in`; bottom clear
  ≥`0.3 in` (last safe baseline ≈ 5.25 in). Covers/dividers use left `0.5404 in`.
- **Standard grid:** topic label `y=0.1794`, title `y=0.3235`, body from
  `y≈1.7–2.1`.
- **Cards / panels:** `roundRect`, corner radius ~0.04–0.06 of the short side,
  fill `#F4F2E6` (cream) or `#FFFFFF`, **no shadow, no outline** (flat system).
- **Image placeholder:** `roundRect` filled yellow `#FFD60B` with centered
  "Insert Placeholder Image Here" (Inter 10). Replace with a real photo framed
  in the same rounded rectangle.
- **Card title chip:** small `roundRect` (yellow `#FFD60B` or ink `#1E1C1C`)
  with Libre Baskerville text — the deck's card-label motif (slides 8–10).
- **Footer:** "© 2026 Attentive Mobile Inc." Inter ~8–10pt, mid-gray,
  bottom-left (`x≈0.28, y≈5.32`) — the "Footer components" motif (slide 11).
- **Logo:** the Attentive **"A" monogram mark** (solid ink), as seen on the
  style-guide pages (bottom-left). Use the brand asset; a text wordmark is a
  stand-in only. Use the dark mark on light/yellow canvases, a light mark on ink.
  Omit on full-bleed image slides where the image reaches the corner.

## Shape presets (ECMA-376)

`rect` (most shapes), `roundRect` (cards, pills, image frames, stat cards),
`ellipse` (logo holders, icon dots). Stay geometric — avoid stars, bursts,
clouds, callout-with-tail shapes.

## What's NOT in the system

The deck embeds many borrowed fonts (Helvetica Neue, Arial, plus the front-matter
specimen text). Only **Inter** and **Libre Baskerville** are in the live system —
treat the rest as artifacts of borrowed slides. The deck also contains internal
"this slide is not part of the standard template" reference pages; never
replicate those as customer content.
