import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative, resolve } from 'node:path';
import type { DocsCheckConfig } from './config.js';
import { parseNav, walkDocs, isExternalUrl, type ParsedNav } from './walker.js';

/** A nav entry whose target file does not exist. */
export interface NavError {
    /** Page title as written in mkdocs.yml. */
    title: string;
    /** Nav target as written in mkdocs.yml. */
    target: string;
}

/** A file in the docs directory that is not reachable from the nav. */
export interface OrphanFile {
    /** Path relative to the project root (e.g. "docs/extra.md"). */
    path: string;
}

/** A markdown link whose target file does not exist. */
export interface LinkError {
    /** Path of the linking file, relative to the project root. */
    from: string;
    /** Raw link target as written in the markdown. */
    link: string;
    /** Resolved target path relative to the project root. */
    target: string;
}

/** Outcome of a docs check. */
export interface DocsCheckResult {
    /** Fatal errors such as a missing mkdocs.yml, missing docs directory, or unparseable YAML. */
    errors: string[];
    /** Nav entries whose target file does not exist. */
    navErrors: NavError[];
    /** Files in the docs directory not reachable from the nav. */
    orphans: OrphanFile[];
    /** Internal links that point at a missing file. */
    linkErrors: LinkError[];
    /** Whether any error, broken nav entry, orphan, or broken link exists. */
    hasErrors: boolean;
    /** Number of nav entries collected. */
    navCount: number;
    /** Number of files discovered under the docs directory. */
    fileCount: number;
    /** Number of internal links checked. */
    linkCount: number;
}

const LINK_SCAN_EXT = '.md';
const INLINE_LINK = /(?<!!)\[[^\]]*\]\(\s*<?([^>\s)]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const REFERENCE_DEF = /^\s{0,3}\[([^\]]+)\]:\s*<?([^>\s]+)>?/gm;
const FENCED_BLOCK = /^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1[^\n]*\n?/gm;
const INLINE_CODE = /`[^`]*`/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Strip fenced code blocks, inline code spans, and HTML comments so their
 * content is not mistaken for markdown links.
 *
 * @param content - Raw markdown content.
 * @returns The content without code blocks, code spans, and comments.
 */
export function stripNonLinkContent(content: string): string {
    return content.replace(FENCED_BLOCK, '').replace(INLINE_CODE, '').replace(HTML_COMMENT, '');
}

/**
 * Collect every internal link target from markdown content, covering
 * inline links `[text](target)` and reference definitions `[name]: target`.
 *
 * @param content - Markdown content without code blocks and comments.
 * @returns The raw link targets in order of appearance.
 */
export function collectLinks(content: string): string[] {
    const links: string[] = [];
    for (const match of content.matchAll(INLINE_LINK)) {
        // The inline pattern's first group always participates when it matches.
        links.push(match[1] as string);
    }
    for (const match of content.matchAll(REFERENCE_DEF)) {
        // The reference pattern's second group always participates when it matches.
        links.push(match[2] as string);
    }
    return links;
}

/**
 * Check whether a link target is a local file path worth resolving.
 * Anchor-only links (`#section`), absolute site paths (`/assets/...`),
 * and external URLs are skipped.
 *
 * @param target - Clean link target without fragment or query.
 * @returns `true` when the target should not be resolved.
 */
function isSkippedTarget(target: string): boolean {
    return target === '' || target.startsWith('/') || isExternalUrl(target);
}

/**
 * Statically validate a repository's documentation: every mkdocs.yml nav
 * entry must resolve to an existing file under the docs directory, every
 * docs file must be reachable from the nav, and every internal markdown
 * link must resolve relative to its linking page.
 *
 * @param root   - Absolute path to the project root.
 * @param config - Docs-check configuration.
 * @returns The nav, orphan, and link findings.
 */
export function checkMkdocs(root: string, config: DocsCheckConfig): DocsCheckResult {
    const result: DocsCheckResult = {
        errors: [],
        navErrors: [],
        orphans: [],
        linkErrors: [],
        hasErrors: false,
        navCount: 0,
        fileCount: 0,
        linkCount: 0,
    };

    const mkdocsPath = join(root, config.mkdocsPath);
    const docsDirPath = join(root, config.docsDir);

    if (!existsSync(mkdocsPath) || !statSync(mkdocsPath).isFile()) {
        result.errors.push(`mkdocs.yml not found at ${config.mkdocsPath}`);
    }
    if (!existsSync(docsDirPath) || !statSync(docsDirPath).isDirectory()) {
        result.errors.push(`docs directory not found at ${config.docsDir}`);
    }
    if (result.errors.length > 0) {
        result.hasErrors = true;
        return result;
    }

    let nav: ParsedNav;
    try {
        nav = parseNav(mkdocsPath);
    } catch (err) {
        result.errors.push(`mkdocs.yml could not be parsed: ${String(err)}`);
        result.hasErrors = true;
        return result;
    }
    result.navCount = nav.entries.length;

    const files = walkDocs(docsDirPath, root, config.docsDir, config.skip);
    result.fileCount = files.length;

    if (nav.hasExplicitNav) {
        const navPaths = new Set<string>();
        for (const entry of nav.entries) {
            const cleanTarget = entry.target.replace(/[?#].*/, '');
            const relPath = normalize(join(config.docsDir, cleanTarget));
            if (!existsSync(join(root, relPath))) {
                result.navErrors.push({ title: entry.title, target: entry.target });
            } else {
                navPaths.add(relPath);
            }
        }
        for (const file of files) {
            if (!navPaths.has(file.relPath)) {
                result.orphans.push({ path: file.relPath });
            }
        }
    }

    for (const file of files) {
        if (file.ext !== LINK_SCAN_EXT) {
            continue;
        }
        let content: string;
        try {
            content = readFileSync(join(root, file.relPath), 'utf8');
        } catch {
            continue;
        }
        for (const link of collectLinks(stripNonLinkContent(content))) {
            const cleanTarget = link.replace(/[?#].*/, '');
            if (isSkippedTarget(cleanTarget)) {
                continue;
            }
            const resolved = resolve(dirname(join(root, file.relPath)), cleanTarget);
            if (!existsSync(resolved)) {
                result.linkErrors.push({
                    from: file.relPath,
                    link,
                    target: relative(root, resolved),
                });
            }
            result.linkCount++;
        }
    }

    result.hasErrors =
        result.navErrors.length > 0 || result.orphans.length > 0 || result.linkErrors.length > 0;

    return result;
}
