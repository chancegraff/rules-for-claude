# Fix Known Issues

A defect flagged in code the current work touches (by cross-review, own analysis, or a teammate) gets fixed in the same round. If the fix seems genuinely wrong or too risky, surface it to the user for an explicit decision; never silently ship around it, and never state an accept-it position publicly in a review thread. Knowingly shipping around a flagged defect converts an internal note into an external review finding and an extra round trip. Scope discipline applies to new feature work, not to defects discovered in code the ticket owns. Companion: "pre-existing issue" is never an excuse (global coding standards).

Boundary: this covers defects (wrong behavior, reachable bugs, broken contracts), not style modernization. Pre-existing style-rule deviations are not known issues to sweep; rewriting them is churn.
