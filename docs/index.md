# Overview

`@johannes.latzel/check-mkdocs` is a CLI tool and library for statically validating a repository's documentation without running mkdocs or docker. It checks three things:

- every `mkdocs.yml` nav entry resolves to an existing file under `docs/`
- every file under `docs/` is reachable from the nav (no orphans)
- every internal markdown link, inline `[text](file.md)` and reference style `[name]: file.md`, resolves relative to its linking page

External URLs are skipped, not flagged. Verifying that external links are live and that the site compiles is left to the mkdocs build.

## Navigation

- [Quickstart](quickstart.md): install, configure, and run the first check
- [API Reference](api-reference.md): `checkMkdocs`, `loadConfig`, types, and CLI options
- [Architecture](architecture.md): modules, data flow, and design decisions

## License

MIT. See [`LICENSE`](https://github.com/johanneslatzel/check-mkdocs/blob/main/LICENSE).
