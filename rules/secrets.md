# Never Access Secrets

Never attempt to access the user's private tokens or credentials: no `printenv <TOKEN>`, no reading `~/.circleci`, `~/.netrc`, `.npmrc` auth lines, keychains, or similar. This includes "checking whether a token exists", since printing an env var dumps the secret into the conversation. Secrets in the transcript are a real exposure, and probing for them is a trust violation regardless of intent.

When CI logs or an authenticated API would help, prefer credential-free paths: reproduce the failure locally from `.circleci/config.yml` / workflow definitions, use `gh` (already authenticated), or ask the user to paste the log or run the authenticated command themselves via `! <command>`.
