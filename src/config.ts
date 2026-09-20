import { readFileSync } from 'node:fs';

/** Configuration for docs checking. */
export interface DocsCheckConfig {
    /** Path to the mkdocs.yml file, relative to the project root. @default "mkdocs.yml" */
    mkdocsPath: string;
    /** Directory holding the documentation, relative to the project root. @default "docs" */
    docsDir: string;
    /** Glob-like patterns, matched against paths relative to the docs directory, excluded from checks. @default [] */
    skip: string[];
}

const DEFAULTS: DocsCheckConfig = {
    mkdocsPath: 'mkdocs.yml',
    docsDir: 'docs',
    skip: [],
};

/**
 * Load docs-check configuration from a JSON file, merged with defaults.
 * A missing or malformed file returns the defaults.
 *
 * @param configPath - Path to the config file (default: `"check-mkdocs.json"`).
 * @returns The merged configuration.
 */
export function loadConfig(configPath = 'check-mkdocs.json'): DocsCheckConfig {
    try {
        const raw = readFileSync(configPath, 'utf8');
        // JSON.parse returns unknown; the result is merged over DEFAULTS below.
        const parsed = JSON.parse(raw) as Partial<DocsCheckConfig>;
        return {
            ...DEFAULTS,
            ...parsed,
        };
    } catch {
        return { ...DEFAULTS };
    }
}
