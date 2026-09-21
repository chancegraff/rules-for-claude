---
name: attentive-brand-artifacts
description: Use when creating or editing Attentive-branded artifacts, React components, HTML pages, Sandpack themes, decks, docs, charts, dashboards, product mockups, images, social posts, or customer-facing copy that needs Attentive colors, logo handling, typography, data visualization, visual style, or brand voice.
user-invocable: true
disable-model-invocation: false
---

# Attentive Brand Artifacts

Use this skill whenever the user asks for something that should look or sound like Attentive.

This skill is built from the 2026 Attentive brand guide, the Attentive Brand Voice Master Doc (May 2026), and the Brand and Product Synthesized Messaging Framework (March 2026). It is meant for making artifacts, not for generic brand summaries. The goal is to produce usable branded work: layouts, code, copy, charts, mockups, themes, and design specs that an internal team can actually use.

## Start Here

Before creating anything visual, read `references/visual-system.md`.

Before writing or editing copy, read `references/voice-and-writing.md`. This file now contains the full brand voice operating system, messaging framework, platform pillar guidance, approved boilerplate, AI tool instructions, QA checklists, and the brand-to-platform attribute bridge—all sourced from the May 2026 Brand Voice Master Doc and March 2026 Messaging Framework.

When generating code, use `assets/attentive-tokens.json` for exact values and `assets/attentive-theme.css` for reusable CSS tokens.

When a logo is needed, use the bundled PNGs in `assets/`. Prefer the wordmark over the symbol unless Attentive has already been established in the artifact.

## Core Brand Direction

Attentive should feel editorial, human, deliberate, and restrained.

Use Meringue or Latte surfaces, Poppyseed text, Yuzu as the primary action color, large serif headlines, and a small number of supporting colors.

Do not turn the brand into generic SaaS. Avoid blue/purple gradients, fake glassmorphism, loud rainbow dashboards, staged stock-office imagery, glossy AI graphics, and decorative UI that does not help the work.

## Required Visual Rules

- Lead with Poppyseed `#1E1C1C`, Yuzu `#FFD60B`, Meringue `#FCFAEE`, and Latte `#FAF4DF`.
- Use Yuzu for primary CTAs, key underlines, highlights, and brand moments.
- Use Poppyseed for default text and dark surfaces.
- Do not use colorful body text.
- Do not recolor the logo. Logo colors are only Poppyseed, Yuzu, or Meringue.
- Keep layouts spacious and editorial. Use one strong idea per frame, section, slide, chart, or hero.
- Use large serif headlines. Use sans for body, labels, UI, and captions.
- Use restrained secondary colors only when they clarify comparison, hierarchy, status, or data grouping.
- Product snippets should be cropped, specific, and credible. Do not paste dense UI unless the task requires it.
- Charts should lead with the takeaway metric and use rounded, circular, radial, segmented, or spacious forms where appropriate.

## Type

Brand fonts:

- Serif: Academica Book and Academica Italic.
- Sans: ABC Diatype Regular and Bold.

Fallbacks for generated artifacts:

- Serif: Libre Baskerville, Georgia, serif.
- Sans: Inter, Arial, sans-serif.
- Mono/code: SFMono-Regular, Menlo, Consolas, monospace.

Use serif for headlines and expressive brand statements. Use italic for one short emphasis, roughly 15-20% of a headline. Do not italicize several phrases in the same headline.

Use sentence case for most headlines, subheads, labels, website headlines, CTA buttons, webinar names, and email subject lines. Skip periods in headlines, subheads, and CTA buttons.

## Color Tokens

Core:

- Poppyseed `#1E1C1C`
- Yuzu `#FFD60B`
- Meringue `#FCFAEE`
- Latte `#FAF4DF`

Neutrals and support:

- Garlic `#F4F2E6`
- Salt `#F0EFEA`
- Oyster `#E5E5DD`
- Sardine `#E9E9EB`
- Truffle `#757575`
- Nori `#303D00`

Secondary:

- Ginger `#F6DA71`
- Pistachio `#D6DF22`
- Matcha `#6E8A09`
- Dijon `#D29C00`
- Taffy `#A3C3F1`
- Blue Corn `#6079DC`
- Juniper `#2D36B0`
- Papaya `#F0B368`
- Lox `#DF6A30`
- Jam `#720C07`

## Artifact Rules

For React or HTML artifacts:

- Set the page background to Meringue or Latte.
- Use Poppyseed for text.
- Use Yuzu for the primary CTA.
- Use a serif headline and a sans body.
- Use 8-14px radii for UI controls and product snippets. Avoid over-rounded pill-heavy layouts unless the element is actually a button, tag, or message bubble.
- Keep sections unframed where possible. Use cards only for repeated items, modals, product snippets, or framed tools.
- Show the actual object: product UI, message snippet, chart, form, or campaign surface. Do not build a landing page full of generic claims unless the user asked for one.

For slides:

- Use oversized serif headlines, short supporting copy, and one strong visual per slide.
- Use Yuzu for section breaks, highlight lines, data emphasis, or action moments.
- Do not overload slides with body text or multiple competing charts.

For docs and reports:

- Use a quiet editorial layout.
- Use serif for title/opening statements, sans for body.
- Keep tables clean and high-contrast.
- Cut filler. Use concrete claims and direct language.

For charts and dashboards:

- Lead with the takeaway metric.
- Use Poppyseed/Meringue/Yuzu first.
- Add one secondary color only when comparison needs it.
- Avoid rainbow palettes.
- Labels should be readable and sparse. Do not make people decode decoration.

For images:

- Ask for candid human moments, natural light, real settings, close/mid crops, and subtle product or message overlays.
- Avoid staged office scenes, generic laptop photos, glossy futuristic AI visuals, or forced excitement.

## Sandpack Theme Recipe

When creating a Sandpack theme, make the editor readable first. The theme styles the Sandpack UI and editor chrome; it does not automatically style the preview iframe app. Provide matching preview CSS separately when needed.

Use this as the default Sandpack theme:

```ts
import type { SandpackTheme } from "@codesandbox/sandpack-react";

export const attentiveSandpackTheme: Partial<SandpackTheme> = {
  colors: {
    surface1: "#FCFAEE",
    surface2: "#FAF4DF",
    surface3: "#F4F2E6",
    disabled: "#757575",
    base: "#1E1C1C",
    clickable: "#1E1C1C",
    hover: "#303D00",
    accent: "#FFD60B",
    error: "#720C07",
    errorSurface: "#FAF4DF",
    warning: "#D29C00",
    warningSurface: "#F6DA71",
  },
  syntax: {
    plain: "#1E1C1C",
    comment: { color: "#757575", fontStyle: "italic" },
    keyword: "#2D36B0",
    definition: "#6079DC",
    punctuation: "#1E1C1C",
    property: "#6E8A09",
    tag: "#720C07",
    static: "#D29C00",
    string: "#6E8A09",
  },
  font: {
    body: "Inter, Arial, sans-serif",
    mono: '"SFMono-Regular", Menlo, Consolas, monospace',
    size: "14px",
    lineHeight: "1.5",
  },
};
```

Use it like this:

```tsx
<Sandpack template="react" theme={attentiveSandpackTheme} />
```

## Voice Rules

Attentive sounds perceptive, deliberate, agile, and human.

Write like a sharp operator, not a strategy deck. Prefer short, concrete sentences. Cut abstract nouns and filler. Use active voice. Say what people do and what changes.

Non-negotiables (from Brand Voice Master Doc, May 2026):

- Use `Attentive`, never `Attentive Mobile` or `AttentiveMobile`, outside legal contexts.
- Lead with customer value and outcomes, not product features alone.
- Stay positive and supportive. Never use fear-based framing like "you'll fall behind."
- Do not invent claims, statistics, customer names, or product details.
- Make the customer the hero, not Attentive.

Useful language:

- Marketing made personal
- The right message at the right moment
- Messages that arrive, not interrupt
- Every message earns its moment
- Marketing that listens before it speaks
- Relevance builds trust, and trust drives growth

Platform copy hierarchy (from Messaging Framework, March 2026):

- Brand idea → Marketing made personal.
- Platform statement → We identify, personalize, and act across every channel so teams can turn messages into moments that drive revenue and loyalty.
- Three pillars: Omnichannel (harmony across SMS, email, RCS, push), Agentic AI (always-on AI acting on the marketer's behalf), Identity (recognition that enables everything else).
- How it works: Identify → Personalize → Deliver.

Full messaging framework, pillar guidance, brand-to-platform attribute bridge, approved boilerplate, AI prompts, and QA checklists are in `references/voice-and-writing.md`. Read it before writing any copy.

Avoid:

- Generic omnichannel orchestration language
- Hype about AI without human judgment
- Claims that sound like surveillance
- Over-personalization language
- Corporate filler: unlock, leverage, robust, seamless, future-proof, next-gen, transform, optimize, supercharge

## Final Check

Before returning work, check:

- Does it look recognizably Attentive without forcing the logo everywhere?
- Is Yuzu used as an action/highlight color rather than wallpaper?
- Is the typography editorial, readable, and not cramped?
- Is the copy concrete and short?
- Are charts and UI elements clear before they are decorative?
- Did you avoid generic SaaS visual language?
