# Image rules — selection, cropping, framing

How images are chosen, cropped, and framed in the Attentive 2026 system. The
deck's front matter points to an internal **photography library** ("View and
utilize our library of photography here") — prefer those assets over stock.

## Framing

- **Every image sits in a `roundRect` frame** with the same corner radius as
  cards (~0.04–0.06 of the short side). No square-cornered photos, no circles
  except logo holders.
- **No outline, no shadow, no border.** The rounded crop is the only treatment.
- The standard right-hand image slot is `4.4916, 0.25, 5.2585, 5.128`
  (full-height split). The card-sized image slot is `5.05, 1.6125, 4.7, 3.43`.
- When you have no real image yet, use the **yellow placeholder** motif so the
  slide still reads as finished and the slot is obvious.

## Cropping

- **Fill the frame, never letterbox.** Crop the image to the frame's aspect
  ratio using `srcRect`/python-pptx crop fractions rather than shrinking the
  image to fit (which leaves dead canvas).
- Crop to the subject: faces and products near the optical center; keep ~10%
  breathing room around the focal point.
- Do not distort aspect ratio to fit. Crop, don't stretch.

## Selection

- **Photography:** warm, real, human. People using phones, in-store moments,
  product-in-context. Matches the cream canvas — avoid cold blue-gray stock.
- **Product / UI screenshots:** place on a `#EEEEEE`/white card so the UI chrome
  reads cleanly; do not float a raw screenshot on the cream canvas.
- **Customer logos:** inside an `ellipse` holder (ink or accent fill) on quote
  cards, scaled to ~70% of the circle, centered.
- **Charts:** duplicate a supported canonical chart slide and replace only the
  labels or data shapes the builder can safely address. Do not paste a foreign
  chart style or redraw chart geometry without explicit approval.

## One image per idea

A content slide carries **one** hero image, not a collage. If you have several
images, use a card grid or successive slides. The exception is a deliberate logo
wall (many small customer logos), which is its own layout.

## Accessibility & legibility

- Never put ink body text directly over a busy photo. Text goes on the cream
  canvas or a solid card beside the image, not on top of it.
- If text must overlap an image, place it over the solid-color region or add a
  flat panel behind it — no gradient scrims.

## What to avoid

Hard rectangular corners · drop shadows or borders on photos · letterboxed
(non-filling) images · stretched/distorted aspect ratios · cold stock
photography · raw screenshots floating without a card · text over busy imagery ·
more than one hero image per content slide.
