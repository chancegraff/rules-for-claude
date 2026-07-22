# Type Surface Before Design

Verify an API type-checks in THIS repo before designing on it: check the pinned type versions and look for existing usage. Zero usage across the codebase is the not-available signal; find the repo's established alternative. When a design hits a type wall, change the design to repo idioms, never the dependency surface (no package.json surgery).
