# QA checklist — Attentive pixel-perfect slides

Run this before declaring any deck done. The first check is the gate; the rest
are the standard pixel-perfect checks.

## ⛔ Gate check (NON-NEGOTIABLE): every slide is a duplicated canonical template

For **every** slide in the output deck, verify it **originated from a duplicated
canonical template slide** — selected by slide number and category, then filled.

- [ ] Each slide traces to a specific canonical template slide (record which one).
- [ ] Only placeholder content was replaced — text, images, charts, tables, data.
- [ ] All original geometry, spacing, font sizes, colors, dividers, backgrounds,
      image frames, tables, icons, shapes, and z-order are preserved.
- [ ] No new text boxes, cards, dividers, icons, chart areas, or decorative
      elements were added that the template didn't already contain.
- [ ] No template element was silently resized, shrunk, repositioned, or
      redesigned to force content to fit. Overflow was handled by choosing a
      different existing template, compressing the copy, or splitting across
      multiple duplicated template slides. **The one sanctioned exception** is
      the content-header one-line auto-fit (`fit_titles.py`): the builder may
      **widen** a content-header title box into the free space beside it so a
      short title/subtitle sits on one line. It only grows the box, never crosses
      another shape, and never touches x/y/height/font/colour/z-order or any
      display title. Nothing else may be resized.

**If any slide was manually generated from scratch, flag it as a FAILURE** unless
the user explicitly approved a custom slide for that case. A from-scratch slide
without explicit approval blocks ship.

For each slide, the build should be able to answer:
1. Which canonical template slide was duplicated?
2. Why does that template fit the content?
3. Which placeholders were replaced?
4. Did the content fit without changing template geometry?
5. If not — was it compressed, split, or rerouted to another template (not
   redesigned)?

## Standard pixel-perfect checks

- [ ] Slide size matches the canonical deck (Google Slides 16:9).
- [ ] No fit score / overflow left unaddressed; nothing silently truncated; no
      dropped bullet or row.
- [ ] No stray or empty bullets, checkmarks, cards, or placeholders.
- [ ] **Titles are short and sweet, on ONE line.** Every content-header
      title (and its subtitle, if any) fits on a single line and does not wrap
      into or overlap the row of cards / stats / icons / body beneath it. If a
      header still wraps after the auto-fit, its copy is too long for the space —
      shorten it (headline, not a sentence) rather than letting it wrap. Display
      titles (covers, section breakers, statements) keep their intended
      multi-line styling.
- [ ] **KPI/trend-arrow cards (slide 92):** every number is short (≤4 glyphs,
      abbreviated) and sits fully inside its card at 24pt; each up-arrow sits a
      small, even gap to the **left** of its number (not overlapping, not drifted
      away). If a value's width changed, confirm the arrow was moved to match. See
      [slot-contracts.md → "dataviz — three KPI cards + trend arrows"](../slide-formatting/slot-contracts.md).
- [ ] **List markers match the content's meaning.** Numbers (`1. 2. 3.`) appear
      **only** on genuinely ordered sequences; green `✓` **only** on positive
      points; red `✗` **only** on negative points; a neutral `●` dot / `→` arrow
      on plain unordered lists. Flag any list whose marker contradicts its content
      (e.g. numbers on a non-sequence, ✓ on problems, ✗ on wins) — reroute to the
      right-marker template, or re-mark to the deck-native ● dot. See
      [archetypes.md → "List markers"](../slide-design/archetypes.md).
- [ ] Colors are exact hex from the palette; fonts are the canonical families
      only (no off-system substitutions).
- [ ] One canvas mood per slide; no newly added shadow/gradient; arrow bullets; logo
      placed/omitted per the rules; image frames rounded.
- [ ] Verified in the **rendered output** (rasterize and eyeball), not just the
      code. A Linux box without the brand fonts substitutes a fallback — that is
      a render artifact, not a deck defect.
