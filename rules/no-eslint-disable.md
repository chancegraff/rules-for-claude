# No eslint-disable

eslint-disable comments are BANNED: never write `// eslint-disable`, `// eslint-disable-next-line`, `/* eslint-disable */`, or any other rule-suppression comment. Suppressing lint hides real signal. When a rule fires, fix the cause so the rule passes honestly: for a key warning on a list, use a value the data already makes unique (`key={entry.label}` where labels are unique in that list) instead of the array index.

Sits with the other hard bans: [no ternaries](no-ternaries.md), no `any`/`unknown`/casts (global standards).
