# Recurring motifs to preserve

The decorative elements that recur across the Attentive 2026 deck. Select a
canonical slide that already contains the needed motif and preserve it. All specs
were measured from the canonical deck's component slides (the "Testimonial
components", "Colors", and standard content slides).

Do not add shadows, gradients, or outlines. Preserve any inherited canonical fill
exactly as supplied.

---

## Topic label

A small tracked-caps label that names the slide's section, sitting directly
above the title.

- Position: `x=0.2202, y=0.1794`, height `~0.18 in`.
- Type: **Inter SemiBold ~9pt, ALL CAPS, letter-spacing ~0.6pt**, color ink
  `#1E1C1C` (or yellow on dark canvases).
- Content: 1–3 words (`OVERVIEW`, `RESULTS`, `WHY NOW`, `CUSTOMER`).
- Not a filled pill in this system — it is plain tracked caps. (A filled pill is
  acceptable only if a section uses an accent chip; default to plain caps.)

## Card / panel

The base surface for content on the right side of a split, or behind a quote.

- Geometry: `roundRect`, corner radius ~0.04–0.06 of the short side.
- Fill: **two documented modes** (slides 9–10): card cream `#F4F2E6` (ink text)
  or **dark ink `#1E1C1C` (off-white text)**. White `#FFFFFF` is a third option.
  Flat, no outline, **no shadow**. Pair light/dark cards in a row for rhythm.
- The standard content card is `5.0795, 0.2416, 4.6703, 4.9213` (right panel).

## Card title chip

A small rounded label pill that sits on a card to name it (the deck's "XXXX" /
"Blank Card Title Here" motif on the component slides 8–10). This — not a colored
section pill above the title — is the deck's pill motif.

- Geometry: `roundRect`, corner radius ~0.16 of the height.
- Fill: yellow `#FFD60B` (default) or ink `#1E1C1C`; text the contrasting color.
- Text: **Libre Baskerville**, ~9–11pt, centered. 1–3 words.
- `components.title_chip()` builds it.

## Yellow image placeholder

Where a photo, screenshot, or chart will go.

- Geometry: `roundRect`, fill yellow `#FFD60B`, flat.
- Centered label "Insert Placeholder Image Here", Inter 10, ink.
- Replace with a real image framed in the **same** rounded rectangle (see
  [image-rules.md](image-rules.md)).

## Stat / data-point card

A flat card carrying a single big number and a short caption.

- Geometry: `roundRect`, fill yellow `#FFD60B` (or cream for a quieter row).
- Number: **Libre Baskerville italic**, 18–20pt in a card / up to 30pt as a
  hero, ink. Short — `+38%`, `12x`, `$2.4M`, `92%`. No verbs.
- Caption: Inter 8–9pt, ink, 5–9 words.
- Optional attribution at the bottom: name (Inter SemiBold 7) + source (Inter 7,
  mid-gray).
- **Trend-arrow KPI cards (slide 92)** are a stricter variant: three fixed-width
  cards, each with an **Inter Bold 24pt number and a separate up-arrow shape** to
  its left. Because the number is centered and the arrow is hand-placed, keep
  each value **short (≤4 glyphs, abbreviated — `4.7K`, `20%`, `12x`)** and match
  the slot's original glyph count (3 / 3 / 4) so the arrow stays aligned. If the
  value must change width, reposition the arrow to follow the number's left edge.
  Full geometry, caps, and the arrow-reposition formula:
  [slot-contracts.md → "dataviz — three KPI cards + trend arrows"](../slide-formatting/slot-contracts.md).

## Quote / testimonial card

A flat cream card with a serif italic quote and an attribution.

- Geometry: `roundRect`, fill `#F4F2E6` or white, flat.
- **Logo holder:** an `ellipse` (or small `roundRect`) top-left, fill ink
  `#1E1C1C` (or an accent), holding the customer logo. ~0.8 in.
- **Quote:** Libre Baskerville **italic**, ~9–11pt, ink. Curly quotes `“ ”`.
  Bold-italic the key phrase.
- **Attribution:** name (Inter SemiBold ~7–8pt) over source/role (Inter ~7–8pt,
  mid-gray), bottom-left.

## Icon system

The deck ships an **Icon Library** (slide 5): a grid of **solid, single-color
ink (`#1E1C1C`) monochrome pictograms** — geometric, single-weight, *filled*
(not outline) glyphs (arrow, cart, bell, mail, home, lock, chart, etc.), drawn
from an external library ("Link to library"). Icons are ~0.16 in in the
reference grid; use ~0.2–0.5 in on slides.

- On a light card, icons are ink; on a dark card or an accent dot, they are
  off-white or ink to contrast.
- `components.icon_glyph()` places a real library PNG (falls back to a dot).
- Do **not** use outline-style or multi-color icons — the system is solid mono.

## Icon dot

A small filled circle used as a card marker or step number.

- Geometry: `ellipse`, ~0.5 in, fill a **theme accent** cycled per card
  (yellow → blue → olive → orange), flat.
- Glyph: a number, an ink pictogram, or a short label centered, Inter SemiBold,
  ink (or white on dark fills). Disable wrap so multi-digit labels stay on one
  line.

## Footer

A bottom-of-slide note (slide 11: "Footer components").

- Copyright: "© 2026 Attentive Mobile Inc." — Inter ~8–10pt, mid-gray,
  bottom-left (`x≈0.28, y≈5.32`).
- Source / "as of" notes use the same treatment. `components.footer()`.

## List markers — carry meaning, choose by content

The marker in front of a bullet is **semantic**, not just decorative. Match it to
the list's order and polarity (full selection table in
[archetypes.md → "List markers"](archetypes.md#list-markers--pick-the-bulleted-template-by-the-lists-meaning)):

- **`1. 2. 3.` auto-number** → only a genuinely **ordered** sequence (ranked steps,
  a numbered process). Slide 143 and the timelines. Never for an unordered list.
- **green `✓` check** → **positive** points (benefits, wins, capabilities, things
  done). Slides 144, 150, 131–135, 140–148.
- **red `✗` cross** → **negative** points (problems, blockers, limitations). Slide
  149. Do not use ✓ for problems or ✗ for wins.
- **neutral `●` dot / `→` arrow** → a plain **unordered / mixed** list with no
  per-item polarity. Slides 65, 81 ship the ● dot; the → arrow below is the other
  neutral option.

## Arrow bullet

The deck's neutral bullet marker over theme bullets (for unordered, no-polarity
lists — see "List markers" above).

- Character: `→` (U+2192), prefixing the text with a hanging indent so wrapped
  lines align under the text, not the arrow.
- Size matches body; color ink. The builder uses `marL≈0.5, indent≈−0.3`.

## Comparison table

- Header row: ink `#1E1C1C` fill, white text, Inter ~7.5 bold.
- Body rows: cream `#FAF4DF` banding alternating with white, Inter ~7, ink.
- White cell separators (borders authored **before** fill — see formatting
  rules). Respect per-column width.

## Logo / wordmark

- Dark "attentive" wordmark top-right on light canvases (`x≈8.62, y≈0.22`).
- Yellow wordmark on ink/yellow canvases.
- Omit on full-bleed image slides where the image reaches the top-right corner.

---

## What NOT to draw

Drop shadows · gradients (yellow is solid) · decorative stripes/patterns · heavy
outlines · glow/blur · hand-drawn underlines under titles · icons inside title
text · star/burst/cloud shapes. The system is flat and geometric.
