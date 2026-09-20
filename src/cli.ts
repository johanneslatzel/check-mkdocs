#!/usr/bin/env node

/**
 * CLI entry point for check-mkdocs.
 *
 * Usage:
 *   check-mkdocs [options]
 *
 * Options:
 *   --config <path>  Path to the mkdocs.yml to check (default: config value or mkdocs.yml)
 *   --json           Output machine-readable JSON
 */

import { loadConfig } from './config.js';
import { checkMkdocs } from './check-mkdocs.js';

const args = process.argv.slice(2);

function flag(name: string): boolean {
    return args.includes(`--${name}`);
}

function option(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const JSON_OUTPUT = flag('json');
const config = loadConfig();
const mkdocsOverride = option('config');
const mkdocsPath = mkdocsOverride ?? config.mkdocsPath;

const result = checkMkdocs(process.cwd(), { ...config, mkdocsPath });

if (JSON_OUTPUT) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
    for (const error of result.errors) {
        console.error(`✗  ${error}`);
    }
    for (const nav of result.navErrors) {
        console.error(`✗  Broken nav entry "${nav.title}": ${nav.target}`);
    }
    for (const orphan of result.orphans) {
        console.error(`✗  Orphan file not in nav: ${orphan.path}`);
    }
    for (const link of result.linkErrors) {
        console.error(`✗  ${link.from}: broken link "${link.link}" (${link.target})`);
    }
    if (result.hasErrors) {
        const total =
            result.errors.length +
            result.navErrors.length +
            result.orphans.length +
            result.linkErrors.length;
        console.error(`\n${total} docs error(s) found.`);
    } else {
        console.log(
            `✓  Docs OK: ${result.navCount} nav entries, ${result.fileCount} files, ${result.linkCount} links checked.`,
        );
    }
}

process.exit(result.hasErrors ? 1 : 0);
