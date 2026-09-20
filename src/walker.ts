import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { load } from 'js-yaml';

/** A single nav entry pointing at a local file. */
export interface NavEntry {
    /** Page title as written in mkdocs.yml (the target itself for string entries). */
    title: string;
    /** Nav target as written in mkdocs.yml, relative to the docs directory. */
    target: string;
}

/** The outcome of parsing an mkdocs.yml nav tree. */
export interface ParsedNav {
    /** All local nav targets collected from the nav tree. */
    entries: NavEntry[];
    /** Whether the mkdocs.yml defines a non-empty nav. */
    hasExplicitNav: boolean;
}

/** A file discovered under the docs directory. */
export interface DocFile {
    /** Path relative to the project root (e.g. "docs/index.md"). */
    relPath: string;
    /** Path relative to the docs directory (e.g. "index.md"). */
    relDocsPath: string;
    /** File extension (e.g. ".md"). */
    ext: string;
}

const EXTERNAL_URL = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Check whether a string is an external URL (for example "https://...").
 *
 * @param value - The string to test.
 * @returns `true` when the string carries a URI scheme.
 */
export function isExternalUrl(value: string): boolean {
    return EXTERNAL_URL.test(value);
}

/**
 * Strip leading glob directory prefixes and trailing glob directory
 * suffixes from a pattern so it can be matched against a concrete path.
 *
 * @param pattern - The glob-like pattern.
 * @returns The pattern without glob directory prefixes.
 */
function stripGlobDirs(pattern: string): string {
    let cleaned = pattern;
    if (cleaned.startsWith('**/')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('/**')) {
        cleaned = cleaned.slice(0, -3);
    }
    return cleaned;
}

/**
 * Check whether a docs-relative path matches any of the skip patterns.
 *
 * @param relPath  - Path relative to the docs directory.
 * @param patterns - Glob-like patterns such as suffix globs, directory globs, and exact paths.
 * @returns `true` when the path matches at least one pattern.
 */
export function isExcluded(relPath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
        const cleaned = stripGlobDirs(pattern);
        if (cleaned.startsWith('**.') || cleaned.startsWith('*.')) {
            const inner = cleaned.replace(/^\*+/, '');
            if (inner.endsWith('*')) {
                const infix = inner.slice(0, -1);
                return relPath.includes(infix);
            }
            return relPath.endsWith(inner);
        }
        return relPath === cleaned || relPath.startsWith(cleaned + '/');
    });
}

/**
 * Collect nav targets from a nav value, recursively. Section headings
 * (values that are lists or objects) recurse into their children, and
 * external URL targets are skipped.
 *
 * @param value   - The nav value to walk.
 * @param entries - The array to append collected entries to.
 */
function collectNavEntries(value: unknown, entries: NavEntry[]): void {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectNavEntries(item, entries);
        }
        return;
    }
    if (typeof value === 'string') {
        if (!isExternalUrl(value)) {
            entries.push({ title: value, target: value });
        }
        return;
    }
    if (value !== null && typeof value === 'object') {
        for (const [title, target] of Object.entries(value)) {
            if (Array.isArray(target) || (target !== null && typeof target === 'object')) {
                collectNavEntries(target, entries);
            } else if (typeof target === 'string') {
                if (!isExternalUrl(target)) {
                    entries.push({ title, target });
                }
            }
        }
    }
}

/**
 * Parse an mkdocs.yml file and collect every local nav target.
 *
 * @param mkdocsPath - Path to the mkdocs.yml file.
 * @returns The collected nav entries and whether a non-empty nav exists.
 */
export function parseNav(mkdocsPath: string): ParsedNav {
    const content = readFileSync(mkdocsPath, 'utf8');
    const parsed: unknown = load(content);
    const entries: NavEntry[] = [];
    let hasExplicitNav = false;
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // load returns unknown; the guard above narrows it to a record-like object.
        const nav = (parsed as Record<string, unknown>).nav;
        if (Array.isArray(nav)) {
            hasExplicitNav = nav.length > 0;
            collectNavEntries(nav, entries);
        }
    }
    return { entries, hasExplicitNav };
}

/**
 * Walk a directory recursively and return all files below it.
 *
 * @param dir          - Directory to walk.
 * @param root         - Project root, used to compute paths relative to it.
 * @param docsRelPath  - Docs directory path relative to the project root.
 * @param skip         - Skip patterns matched against docs-relative paths.
 * @returns The discovered files.
 */
export function walkDocs(
    dir: string,
    root: string,
    docsRelPath: string,
    skip: string[],
): DocFile[] {
    const results: DocFile[] = [];
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDocs(fullPath, root, docsRelPath, skip));
        } else if (entry.isFile()) {
            const relPath = relative(root, fullPath);
            const relDocsPath = relative(join(root, docsRelPath), fullPath);
            if (isExcluded(relDocsPath, skip)) {
                continue;
            }
            results.push({ relPath, relDocsPath, ext: extname(entry.name) });
        }
    }
    return results;
}
