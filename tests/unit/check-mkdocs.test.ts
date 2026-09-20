import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkMkdocs, collectLinks, stripNonLinkContent } from '../../src/check-mkdocs.js';
import type { DocsCheckConfig } from '../../src/config.js';

let tmpDir: string;

beforeEach(() => {
    tmpDir = join(tmpdir(), `check-mkdocs-check-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

function makeConfig(overrides: Partial<DocsCheckConfig> = {}): DocsCheckConfig {
    return {
        mkdocsPath: 'mkdocs.yml',
        docsDir: 'docs',
        skip: [],
        ...overrides,
    };
}

function writeFile(relPath: string, content: string): void {
    const fullPath = join(tmpDir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
}

function mkdocsNav(content: string): void {
    writeFile('mkdocs.yml', `site_name: test\nnav:\n${content}`);
}

describe('stripNonLinkContent', () => {
    it('removes fenced code blocks', () => {
        const input = 'Text\n```md\n[broken](missing.md)\n```\nMore\n';
        expect(stripNonLinkContent(input)).toBe('Text\nMore\n');
    });

    it('removes HTML comments', () => {
        const input = 'Text\n<!-- [broken](missing.md) -->\nMore\n';
        expect(stripNonLinkContent(input)).toBe('Text\n\nMore\n');
    });

    it('removes inline code spans', () => {
        const input = 'Text `[text](missing.md)` and `[ref]: missing.md` more\n';
        expect(stripNonLinkContent(input)).toBe('Text  and  more\n');
    });
});

describe('collectLinks', () => {
    it('collects inline and reference links', () => {
        const links = collectLinks('[A](a.md)\n[ref]: b.md\n');
        expect(links).toEqual(['a.md', 'b.md']);
    });
});

describe('checkMkdocs', () => {
    it('reports a missing mkdocs.yml', () => {
        writeFile('docs/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('mkdocs.yml not found');
        expect(result.hasErrors).toBe(true);
        expect(result.fileCount).toBe(0);
    });

    it('reports a missing docs directory', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav: []\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('docs directory not found');
        expect(result.hasErrors).toBe(true);
    });

    it('reports both missing inputs at once', () => {
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors).toHaveLength(2);
        expect(result.hasErrors).toBe(true);
    });

    it('reports an mkdocs.yml path that is a directory', () => {
        mkdirSync(join(tmpDir, 'mkdocs.yml'));
        writeFile('docs/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors[0]).toContain('mkdocs.yml not found');
        expect(result.hasErrors).toBe(true);
    });

    it('reports a docs path that is a file', () => {
        writeFile('mkdocs.yml', 'site_name: test\n');
        writeFile('docs', '# not a directory');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors[0]).toContain('docs directory not found');
        expect(result.hasErrors).toBe(true);
    });

    it('reports an unparseable mkdocs.yml', () => {
        writeFile('mkdocs.yml', 'nav: [\n');
        writeFile('docs/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('could not be parsed');
        expect(result.hasErrors).toBe(true);
    });

    it('passes when nav resolves and links are intact', () => {
        mkdocsNav('  - Home: index.md\n  - Guide: guide.md\n');
        writeFile('docs/index.md', '# Home\n\n[Guide](guide.md)\n\n[ref]: guide.md\n');
        writeFile('docs/guide.md', '# Guide\n\n[Home](index.md)\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.errors).toEqual([]);
        expect(result.navErrors).toEqual([]);
        expect(result.orphans).toEqual([]);
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
        expect(result.navCount).toBe(2);
        expect(result.fileCount).toBe(2);
        expect(result.linkCount).toBe(3);
    });

    it('passes when the nav is absent', () => {
        writeFile('mkdocs.yml', 'site_name: test\n');
        writeFile('docs/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.hasErrors).toBe(false);
        expect(result.orphans).toEqual([]);
        expect(result.navCount).toBe(0);
    });

    it('flags a broken nav entry', () => {
        mkdocsNav('  - Home: index.md\n  - Missing: gone.md\n');
        writeFile('docs/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.navErrors).toEqual([{ title: 'Missing', target: 'gone.md' }]);
        expect(result.hasErrors).toBe(true);
    });

    it('flags an orphan file not in the nav', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/extra.md', '# Extra');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.orphans).toEqual([{ path: 'docs/extra.md' }]);
        expect(result.hasErrors).toBe(true);
    });

    it('counts a page linked from a body but not in nav as an orphan', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Extra](extra.md)\n');
        writeFile('docs/extra.md', '# Extra');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.orphans).toEqual([{ path: 'docs/extra.md' }]);
        expect(result.hasErrors).toBe(true);
    });

    it('flags a broken inline link', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Gone](missing.md)\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toHaveLength(1);
        expect(result.linkErrors[0]).toEqual({
            from: 'docs/index.md',
            link: 'missing.md',
            target: 'docs/missing.md',
        });
        expect(result.hasErrors).toBe(true);
    });

    it('flags a broken reference link', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[ref]: missing.md\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toHaveLength(1);
        expect(result.linkErrors[0]?.link).toBe('missing.md');
        expect(result.hasErrors).toBe(true);
    });

    it('ignores external URL links', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Site](https://example.com)\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
        expect(result.linkCount).toBe(0);
    });

    it('ignores anchor-only links', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Top](#top)\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('ignores absolute site paths', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Asset](/assets/logo.png)\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('strips fragments and query strings from link targets', () => {
        mkdocsNav('  - Home: index.md\n  - Guide: guide.md\n');
        writeFile('docs/index.md', '# Home\n\n[Guide](guide.md#setup)\n[Raw](guide.md?raw=1)\n');
        writeFile('docs/guide.md', '# Guide');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
        expect(result.linkCount).toBe(2);
    });

    it('strips fragments from nav targets', () => {
        mkdocsNav('  - Home: index.md#intro\n');
        writeFile('docs/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.navErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('resolves parent-directory links', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Root](../README.md)\n');
        writeFile('README.md', '# Project');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('ignores links inside fenced code blocks', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile(
            'docs/index.md',
            '# Home\n\n```md\n[broken](missing.md)\n```\n\n[ok](index.md)\n',
        );
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
        expect(result.linkCount).toBe(1);
    });

    it('ignores links inside HTML comments', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n<!-- [broken](missing.md) -->\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('ignores images', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n![Logo](missing.png)\n');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('allows non-markdown files reachable via the nav', () => {
        mkdocsNav('  - Home: index.md\n  - Logo: logo.png\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/logo.png', 'png');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.orphans).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('does not scan non-markdown files for links', () => {
        mkdocsNav('  - Home: index.md\n  - Logo: logo.png\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/logo.png', 'png');
        const result = checkMkdocs(tmpDir, makeConfig());
        expect(result.linkCount).toBe(0);
    });

    it('respects skip patterns for orphans and links', () => {
        mkdocsNav('  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/drafts/note.md', '# Draft\n\n[broken](missing.md)\n');
        const config = makeConfig({ skip: ['drafts/**'] });
        const result = checkMkdocs(tmpDir, config);
        expect(result.orphans).toEqual([]);
        expect(result.linkErrors).toEqual([]);
        expect(result.hasErrors).toBe(false);
    });

    it('supports a custom docs directory', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('guide/index.md', '# Home');
        const result = checkMkdocs(tmpDir, makeConfig({ docsDir: 'guide' }));
        expect(result.hasErrors).toBe(false);
        expect(result.fileCount).toBe(1);
    });

    it('skips markdown files that cannot be read', () => {
        mkdocsNav('  - Home: index.md\n  - Locked: locked.md\n');
        writeFile('docs/index.md', '# Home');
        const lockedPath = join(tmpDir, 'docs/locked.md');
        writeFileSync(lockedPath, '# Locked\n\n[broken](missing.md)\n');
        chmodSync(lockedPath, 0o000);
        try {
            const result = checkMkdocs(tmpDir, makeConfig());
            expect(result.linkErrors).toEqual([]);
        } finally {
            chmodSync(lockedPath, 0o644);
        }
    });
});
