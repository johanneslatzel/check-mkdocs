import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isExcluded, isExternalUrl, parseNav, walkDocs } from '../../src/walker.js';

let tmpDir: string;

beforeEach(() => {
    tmpDir = join(tmpdir(), `check-mkdocs-walker-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

describe('isExternalUrl', () => {
    it('recognizes http and https URLs', () => {
        expect(isExternalUrl('https://example.com')).toBe(true);
        expect(isExternalUrl('http://example.com')).toBe(true);
    });

    it('recognizes other URI schemes', () => {
        expect(isExternalUrl('mailto:info@example.com')).toBe(true);
        expect(isExternalUrl('ftp://example.com')).toBe(true);
    });

    it('treats local paths as internal', () => {
        expect(isExternalUrl('index.md')).toBe(false);
        expect(isExternalUrl('sub/page.md')).toBe(false);
        expect(isExternalUrl('../README.md')).toBe(false);
    });
});

describe('isExcluded', () => {
    it('matches suffix glob patterns', () => {
        expect(isExcluded('drafts/note.md', ['*.md'])).toBe(true);
        expect(isExcluded('index.md', ['*.md'])).toBe(true);
    });

    it('matches star-star suffix glob patterns', () => {
        expect(isExcluded('index.md', ['**/*.md'])).toBe(true);
        expect(isExcluded('drafts/note.md', ['**/*.md'])).toBe(true);
    });

    it('matches dot-prefixed suffix glob patterns', () => {
        expect(isExcluded('index.md', ['**.md'])).toBe(true);
    });

    it('does not match a different suffix', () => {
        expect(isExcluded('index.md', ['*.ts'])).toBe(false);
    });

    it('matches infix glob patterns', () => {
        expect(isExcluded('readme.generated.md', ['*.generated.*'])).toBe(true);
        expect(isExcluded('generated/readme.md', ['*.generated.*'])).toBe(false);
    });

    it('matches directory glob patterns', () => {
        expect(isExcluded('assets/img.png', ['assets/**'])).toBe(true);
    });

    it('matches directory prefixes without glob', () => {
        expect(isExcluded('assets/img.png', ['assets'])).toBe(true);
    });

    it('does not match unrelated files', () => {
        expect(isExcluded('index.md', ['assets/**'])).toBe(false);
    });

    it('matches exact paths', () => {
        expect(isExcluded('extra.md', ['extra.md'])).toBe(true);
        expect(isExcluded('sub/extra.md', ['extra.md'])).toBe(false);
    });

    it('matches nothing for empty patterns', () => {
        expect(isExcluded('index.md', [])).toBe(false);
    });
});

describe('parseNav', () => {
    function writeMkdocs(content: string): string {
        const path = join(tmpDir, 'mkdocs.yml');
        writeFileSync(path, content);
        return path;
    }

    it('collects string nav entries', () => {
        const path = writeMkdocs('nav:\n  - index.md\n  - quickstart.md\n');
        const nav = parseNav(path);
        expect(nav.hasExplicitNav).toBe(true);
        expect(nav.entries).toHaveLength(2);
        expect(nav.entries[0]).toEqual({ title: 'index.md', target: 'index.md' });
    });

    it('collects mapping nav entries with titles', () => {
        const path = writeMkdocs('nav:\n  - Overview: index.md\n  - Quickstart: quickstart.md\n');
        const nav = parseNav(path);
        expect(nav.entries).toEqual([
            { title: 'Overview', target: 'index.md' },
            { title: 'Quickstart', target: 'quickstart.md' },
        ]);
    });

    it('collects nested section entries', () => {
        const content =
            'nav:\n' +
            '  - Home: index.md\n' +
            '  - Guides:\n' +
            '      - Install: install.md\n' +
            '      - Usage: usage.md\n';
        const nav = parseNav(writeMkdocs(content));
        expect(nav.hasExplicitNav).toBe(true);
        expect(nav.entries).toEqual([
            { title: 'Home', target: 'index.md' },
            { title: 'Install', target: 'install.md' },
            { title: 'Usage', target: 'usage.md' },
        ]);
    });

    it('skips external URL entries', () => {
        const content = 'nav:\n  - index.md\n  - Blog: https://example.com\n';
        const nav = parseNav(writeMkdocs(content));
        expect(nav.entries).toEqual([{ title: 'index.md', target: 'index.md' }]);
    });

    it('skips string-form external URL entries', () => {
        const content = 'nav:\n  - https://example.com\n  - index.md\n';
        const nav = parseNav(writeMkdocs(content));
        expect(nav.entries).toEqual([{ title: 'index.md', target: 'index.md' }]);
    });

    it('ignores non-string non-object nav items', () => {
        const content = 'nav:\n  - index.md\n  - 42\n  - null\n';
        const nav = parseNav(writeMkdocs(content));
        expect(nav.entries).toEqual([{ title: 'index.md', target: 'index.md' }]);
    });

    it('ignores mapping values that are not strings', () => {
        const content = 'nav:\n  - Home: index.md\n  - Page: 42\n';
        const nav = parseNav(writeMkdocs(content));
        expect(nav.entries).toEqual([{ title: 'Home', target: 'index.md' }]);
    });

    it('reports no explicit nav when nav is absent', () => {
        const nav = parseNav(writeMkdocs('site_name: test\n'));
        expect(nav.hasExplicitNav).toBe(false);
        expect(nav.entries).toEqual([]);
    });

    it('reports no explicit nav when nav is empty', () => {
        const nav = parseNav(writeMkdocs('nav: []\n'));
        expect(nav.hasExplicitNav).toBe(false);
        expect(nav.entries).toEqual([]);
    });

    it('handles a root-level list document', () => {
        const nav = parseNav(writeMkdocs('- index.md\n- quickstart.md\n'));
        expect(nav.hasExplicitNav).toBe(false);
        expect(nav.entries).toEqual([]);
    });
});

describe('walkDocs', () => {
    it('finds files recursively with relative paths', () => {
        mkdirSync(join(tmpDir, 'docs/sub'), { recursive: true });
        writeFileSync(join(tmpDir, 'docs/index.md'), '# Home');
        writeFileSync(join(tmpDir, 'docs/sub/guide.md'), '# Guide');
        writeFileSync(join(tmpDir, 'docs/logo.png'), 'png');
        const files = walkDocs(join(tmpDir, 'docs'), tmpDir, 'docs', []);
        expect(files).toHaveLength(3);
        expect(files[0]?.relPath).toBe('docs/index.md');
        expect(files[0]?.relDocsPath).toBe('index.md');
        expect(files[0]?.ext).toBe('.md');
    });

    it('applies skip patterns to docs-relative paths', () => {
        mkdirSync(join(tmpDir, 'docs/drafts'), { recursive: true });
        writeFileSync(join(tmpDir, 'docs/index.md'), '# Home');
        writeFileSync(join(tmpDir, 'docs/drafts/note.md'), '# Draft');
        const files = walkDocs(join(tmpDir, 'docs'), tmpDir, 'docs', ['drafts/**']);
        expect(files).toHaveLength(1);
        expect(files[0]?.relDocsPath).toBe('index.md');
    });

    it('returns empty for a nonexistent directory', () => {
        const files = walkDocs(join(tmpDir, 'nonexistent'), tmpDir, 'docs', []);
        expect(files).toHaveLength(0);
    });

    it('skips symlinks', () => {
        mkdirSync(join(tmpDir, 'docs'), { recursive: true });
        writeFileSync(join(tmpDir, 'docs/real.md'), '# Real');
        writeFileSync(join(tmpDir, 'target.txt'), 'x');
        symlinkSync(join(tmpDir, 'target.txt'), join(tmpDir, 'docs/link.md'));
        const files = walkDocs(join(tmpDir, 'docs'), tmpDir, 'docs', []);
        expect(files).toHaveLength(1);
        expect(files[0]?.relDocsPath).toBe('real.md');
    });
});
