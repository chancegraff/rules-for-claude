# Manual Test and Demo Steps

Chance, 2026-10-01: "I also need you to start giving me sequenced instructions for how to manually test and how to do demo. Literally down to, click this link here to get to this page, select this item from this dropdown, type this into this input, click this button, take a screenshot of this thing, etc."

Every PR report to Chance carries two numbered step lists (plain prose, never code), one for manual testing and one for the Demo section. Each step is one action a person performs: open this exact URL, sign in, pick this company, click this nav item, click this row, select this item from this dropdown, type this text into this input, click this button, take a screenshot of this element. Each step names what the screen must show after the action. A step never says "verify the feature works"; it names the pixels.

- Links are exact: the sneak-preview URL for the PR's head commit (`https://ui-devel.attentivemobile.com/sneak-preview/<sha7>/` for client-ui, `https://ui-docs.attentivemobile.com/storybooks?commit=<sha7>` for storybooks), the app route, the Storybook sidebar path and story name.
- Name the feature flags the company needs, and the kind of data the profile or record needs (for example "a profile whose email has a contact subscription and no marketing subscription").
- Say which screenshots the Demo needs and what each must show, with a before (flag off) shot where the PR changes an existing surface. Give each screenshot the one-line title it carries in the Demo, naming its state ("email channel, subscribed"), per [pr-descriptions](pr-descriptions.md).
- When the preview is not live yet, say which PR check must be green first.
- A PR with no visible change says so in one line and skips the step lists.
