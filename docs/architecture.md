# Architecture

## Overview

Four modules around the `js-yaml` parser and `node:fs` walking.

## Modules

- [`config.ts`](https://github.com/johanneslatzel/check-mkdocs/blob/main/src/config.ts): defines `DocsCheckConfig` and `DEFAULTS`; loads the optional `check-mkdocs.json` with `readFileSync` and merges partial configs over the defaults; missing or malformed files yield the defaults.
- [`walker.ts`](https://github.com/johanneslatzel/check-mkdocs/blob/main/src/walker.ts): parses the `mkdocs.yml` nav tree through `js-yaml`, collecting every local nav target from string entries, titled mappings, and nested sections while skipping external URLs; walks the docs directory recursively with `readdirSync` and applies the configured skip patterns.
- [`check-mkdocs.ts`](https://github.com/johanneslatzel/check-mkdocs/blob/main/src/check-mkdocs.ts): orchestrates the check. Each nav target is resolved under the docs directory and flagged when missing; files not reachable from the nav are reported as orphans; every markdown file is scanned for inline links and reference definitions, which are resolved relative to the linking file and flagged when the target does not exist.
- [`cli.ts`](https://github.com/johanneslatzel/check-mkdocs/blob/main/src/cli.ts): parses `--config` and `--json`; writes findings to stderr and success messages to stdout; exits `1` when any finding exists.

[`index.ts`](https://github.com/johanneslatzel/check-mkdocs/blob/main/src/index.ts) re-exports the public API: `checkMkdocs`, `loadConfig`, and the result and config types. The CLI is a separate entry point.

## Data Flow

```
CLI args -> loadConfig -> parseNav (js-yaml) -> walkDocs -> link scan -> findings -> output -> exit code
```

## Design Decisions

- One runtime dependency (`js-yaml`); walking, matching, and IO use `node:fs` and `node:path` only.
- Filesystem operations are synchronous.
- The nav is authoritative for orphans: a page linked only from another body page still counts as an orphan unless it is reachable from the nav.
- External URLs in the nav and in links are skipped, not flagged. Liveness of external links and site compilation are left to the mkdocs build.
- Anchor-only links (`#section`), absolute site paths (`/assets/...`), and images are not treated as file links.
- Fenced code blocks, inline code spans, and HTML comments are stripped before link scanning so examples do not produce false positives.
- A missing nav (or an empty one) disables orphan detection, matching mkdocs' auto-generated nav behavior.
