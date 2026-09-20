# API Reference

## `loadConfig(configPath?)`

Load configuration from a JSON file, merged with defaults. A missing or malformed file returns the defaults. Returns `DocsCheckConfig`.

| Param        | Type     | Default               | Description             |
| ------------ | -------- | --------------------- | ----------------------- |
| `configPath` | `string` | `"check-mkdocs.json"` | Path to the config file |

## `checkMkdocs(root, config)`

Statically validate a repository's documentation: nav resolution, orphan detection, and internal link resolution. Returns `DocsCheckResult`.

| Param    | Type              | Description                       |
| -------- | ----------------- | --------------------------------- |
| `root`   | `string`          | Absolute path to the project root |
| `config` | `DocsCheckConfig` | Configuration                     |

```ts
const result = checkMkdocs(process.cwd(), loadConfig());
if (result.hasErrors) {
    process.exit(1);
}
```

## Types

### `DocsCheckConfig`

| Option       | Type       | Default        | Description                                                                   |
| ------------ | ---------- | -------------- | ----------------------------------------------------------------------------- |
| `mkdocsPath` | `string`   | `"mkdocs.yml"` | Path to the mkdocs.yml file, relative to the project root                     |
| `docsDir`    | `string`   | `"docs"`       | Directory holding the documentation, relative to the project root             |
| `skip`       | `string[]` | `[]`           | Glob-like patterns, matched against docs-relative paths, excluded from checks |

Example `check-mkdocs.json` in the project root:

```json
{
    "mkdocsPath": "mkdocs.yml",
    "docsDir": "docs",
    "skip": []
}
```

All keys are optional; the sample matches the built-in defaults.

### `DocsCheckResult`

| Field        | Type           | Description                                                        |
| ------------ | -------------- | ------------------------------------------------------------------ |
| `errors`     | `string[]`     | Fatal errors such as a missing mkdocs.yml or an unparseable file   |
| `navErrors`  | `NavError[]`   | Nav entries whose target file does not exist                       |
| `orphans`    | `OrphanFile[]` | Files under the docs directory not reachable from the nav          |
| `linkErrors` | `LinkError[]`  | Internal links that point at a missing file                        |
| `hasErrors`  | `boolean`      | Whether any error, broken nav entry, orphan, or broken link exists |
| `navCount`   | `number`       | Number of nav entries collected                                    |
| `fileCount`  | `number`       | Number of files discovered under the docs directory                |
| `linkCount`  | `number`       | Number of internal links checked                                   |

### `NavError`

| Field    | Type     | Description                         |
| -------- | -------- | ----------------------------------- |
| `title`  | `string` | Page title as written in mkdocs.yml |
| `target` | `string` | Nav target as written in mkdocs.yml |

### `OrphanFile`

| Field  | Type     | Description                                              |
| ------ | -------- | -------------------------------------------------------- |
| `path` | `string` | Path relative to the project root (e.g. `docs/extra.md`) |

### `LinkError`

| Field    | Type     | Description                                |
| -------- | -------- | ------------------------------------------ |
| `from`   | `string` | Path of the linking file, relative to root |
| `link`   | `string` | Raw link target as written in the markdown |
| `target` | `string` | Resolved target path relative to the root  |

## CLI

Binary name: `check-mkdocs`.

| Option            | Description                     | Default                |
| ----------------- | ------------------------------- | ---------------------- |
| `--config <path>` | Path to the mkdocs.yml to check | config or `mkdocs.yml` |
| `--json`          | Print JSON instead of text      | off                    |

Exit codes: `0` when the docs are intact, `1` when any error, broken nav entry, orphan, or broken link exists.

JSON output:

```json
{
    "errors": [],
    "navErrors": [],
    "orphans": [],
    "linkErrors": [],
    "hasErrors": false,
    "navCount": 4,
    "fileCount": 4,
    "linkCount": 5
}
```
