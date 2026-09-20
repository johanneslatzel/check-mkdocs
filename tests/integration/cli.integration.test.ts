import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir: string;
let cliPath: string;

beforeAll(() => {
    const build = spawnSync('npm', ['run', 'build'], {
        cwd: join(import.meta.dirname, '../..'),
        encoding: 'utf8',
    });
    if (build.status !== 0) {
        throw new Error(`Build failed: ${build.stderr}`);
    }
});

beforeEach(() => {
    tmpDir = join(tmpdir(), `check-mkdocs-integration-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    cliPath = join(process.cwd(), 'dist', 'cli.js');
});

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
    const fullPath = join(tmpDir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
}

function runCli(args: string[]): { stdout: string; stderr: string; status: number | null } {
    return spawnSync('node', [cliPath, ...args], {
        cwd: tmpDir,
        encoding: 'utf8',
    });
}

describe('CLI integration', () => {
    it('exits 0 when every nav entry resolves and links are intact', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n  - Guide: guide.md\n');
        writeFile('docs/index.md', '# Home\n\n[Guide](guide.md)\n');
        writeFile('docs/guide.md', '# Guide\n\n[Home](index.md)\n');

        const result = runCli([]);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('✓');
        expect(result.stdout).toContain('Docs OK');
    });

    it('exits 1 and prints each broken nav entry', () => {
        writeFile(
            'mkdocs.yml',
            'site_name: test\nnav:\n  - Home: index.md\n  - Missing: gone.md\n',
        );
        writeFile('docs/index.md', '# Home');

        const result = runCli([]);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Broken nav entry');
        expect(result.stderr).toContain('gone.md');
    });

    it('exits 1 and prints orphan files', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/extra.md', '# Extra');

        const result = runCli([]);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Orphan file');
        expect(result.stderr).toContain('docs/extra.md');
    });

    it('exits 1 and prints a broken internal link', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Gone](missing.md)\n');

        const result = runCli([]);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('broken link');
        expect(result.stderr).toContain('missing.md');
    });

    it('passes external URL links without flagging them', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile(
            'docs/index.md',
            '# Home\n\n[Site](https://example.com)\n\n[Blog](https://blog.example.com/post)\n',
        );

        const result = runCli([]);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Docs OK');
    });

    it('supports nested nav sections', () => {
        writeFile(
            'mkdocs.yml',
            'site_name: test\nnav:\n  - Home: index.md\n  - Guides:\n      - Install: install.md\n      - Usage: usage.md\n',
        );
        writeFile('docs/index.md', '# Home\n\n[Install](install.md)\n');
        writeFile('docs/install.md', '# Install\n\n[Usage](usage.md)\n');
        writeFile('docs/usage.md', '# Usage\n\n[Home](index.md)\n');

        const result = runCli([]);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('3 nav entries');
    });

    it('respects a custom mkdocs.yml via --config', () => {
        writeFile('config/mkdocs.custom.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');

        const result = runCli(['--config', 'config/mkdocs.custom.yml']);

        expect(result.status).toBe(0);
    });

    it('outputs machine-readable JSON with --json', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');

        const result = runCli(['--json']);

        expect(result.status).toBe(0);
        const output = JSON.parse(result.stdout);
        expect(output).toHaveProperty('navErrors');
        expect(output).toHaveProperty('orphans');
        expect(output).toHaveProperty('linkErrors');
        expect(output).toHaveProperty('hasErrors', false);
    });

    it('passes against the package own docs', () => {
        const repoRoot = join(import.meta.dirname, '../..');
        const result = spawnSync('node', [cliPath], {
            cwd: repoRoot,
            encoding: 'utf8',
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Docs OK');
    });
});
