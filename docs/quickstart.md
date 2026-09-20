# Quickstart

## Install

Requires Node.js >= 20.9.

```bash
npm install --save-dev @johannes.latzel/check-mkdocs
```

## Run

From the project root that holds `mkdocs.yml` and `docs/`:

```bash
npx check-mkdocs
```

Or add a script to `package.json`:

```json
{
    "scripts": {
        "check:mkdocs": "check-mkdocs"
    }
}
```

Output when the docs are intact:

```
✓  Docs OK: 4 nav entries, 4 files, 5 links checked.
```

Output when problems exist (written to stderr, exit code 1):

```
✗  Broken nav entry "Missing": gone.md
✗  Orphan file not in nav: docs/extra.md
✗  docs/index.md: broken link "gone.md" (docs/gone.md)

3 docs error(s) found.
```

## Full API

See [API Reference](api-reference.md) for the configuration file, CLI flags, and JSON output.
