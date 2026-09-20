# @johannes.latzel/check-mkdocs

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM](https://nodei.co/npm/@johannes.latzel/check-mkdocs.svg?style=shields&data=n,v,u,d,s)](https://www.npmjs.com/package/@johannes.latzel/check-mkdocs)
[![version](https://img.shields.io/github/package-json/v/johanneslatzel/check-mkdocs)](https://github.com/johanneslatzel/check-mkdocs/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/johanneslatzel/check-mkdocs/pulls)
[![Feedback Welcome](https://img.shields.io/badge/feedback-welcome-brightgreen)](https://github.com/johanneslatzel/check-mkdocs/discussions)
[![codecov](https://codecov.io/gh/johanneslatzel/check-mkdocs/graph/badge.svg)](https://codecov.io/gh/johanneslatzel/check-mkdocs)
[![CI](https://github.com/johanneslatzel/check-mkdocs/actions/workflows/ci.yml/badge.svg)](https://github.com/johanneslatzel/check-mkdocs/actions/workflows/ci.yml)
[![Socket Badge](https://badge.socket.dev/npm/package/@johannes.latzel/check-mkdocs/latest)](https://badge.socket.dev/npm/package/@johannes.latzel/check-mkdocs/latest)
[![AI Assisted Yes](https://img.shields.io/badge/AI%20Assisted-Yes-green)](https://github.com/mefengl/made-by-ai)

CLI tool and library for statically validating `mkdocs` repository documentation. Checks that every `mkdocs.yml` nav entry resolves, that no docs file is orphaned, and that internal markdown links resolve.

> **Disclaimer**: This package was written entirely by AI. Use at your own risk.

## Features

- nav resolution: every nav entry must point at an existing file under the docs directory
- orphan detection: every docs file must be reachable from the nav
- internal link checking: inline and reference style links resolve relative to their linking page
- configurable docs directory and skip patterns

## Prerequisites

- Node.js >= 20.9

## Installation

```bash
npm install --save-dev @johannes.latzel/check-mkdocs
```

## Documentation

Full documentation at **[johanneslatzel.github.io/check-mkdocs/](https://johanneslatzel.github.io/check-mkdocs/)**

## License

MIT. See [`LICENSE`](https://github.com/johanneslatzel/check-mkdocs/blob/main/LICENSE).

## Contributing

Issues and PRs welcome at [github.com/johanneslatzel/check-mkdocs](https://github.com/johanneslatzel/check-mkdocs).