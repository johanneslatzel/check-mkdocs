import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const CLI_PATH = join(import.meta.dirname, '../../dist/cli.js');

let tmpDir: string;

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
    tmpDir = join(tmpdir(), `check-mkdocs-cli-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
    const result = spawnSync('node', [CLI_PATH, ...args], {
        cwd: tmpDir,
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        exitCode: result.status ?? 1,
    };
}

function writeFile(relPath: string, content: string): void {
    const fullPath = join(tmpDir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
}

describe('CLI', () => {
    it('exits 0 when the docs are intact', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        const { exitCode, stdout } = runCli([]);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Docs OK');
    });

    it('exits 1 and prints a broken nav entry', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Missing: gone.md\n');
        writeFile('docs/index.md', '# Home');
        const { exitCode, stderr } = runCli([]);
        expect(exitCode).toBe(1);
        expect(stderr).toContain('Broken nav entry');
        expect(stderr).toContain('gone.md');
    });

    it('exits 1 and prints an orphan file', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/extra.md', '# Extra');
        const { exitCode, stderr } = runCli([]);
        expect(exitCode).toBe(1);
        expect(stderr).toContain('Orphan file');
        expect(stderr).toContain('docs/extra.md');
    });

    it('exits 1 and prints a broken link', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home\n\n[Gone](missing.md)\n');
        const { exitCode, stderr } = runCli([]);
        expect(exitCode).toBe(1);
        expect(stderr).toContain('broken link');
        expect(stderr).toContain('missing.md');
    });

    it('exits 1 when mkdocs.yml is missing', () => {
        writeFile('docs/index.md', '# Home');
        const { exitCode, stderr } = runCli([]);
        expect(exitCode).toBe(1);
        expect(stderr).toContain('mkdocs.yml not found');
    });

    it('outputs JSON with --json flag', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        const { exitCode, stdout } = runCli(['--json']);
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(stdout);
        expect(parsed).toHaveProperty('navErrors');
        expect(parsed).toHaveProperty('orphans');
        expect(parsed).toHaveProperty('linkErrors');
        expect(parsed).toHaveProperty('hasErrors', false);
        expect(parsed).toHaveProperty('navCount', 1);
    });

    it('outputs findings in JSON with --json flag', () => {
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Missing: gone.md\n');
        writeFile('docs/index.md', '# Home');
        const { exitCode, stdout } = runCli(['--json']);
        expect(exitCode).toBe(1);
        const parsed = JSON.parse(stdout);
        expect(parsed.hasErrors).toBe(true);
        expect(parsed.navErrors).toHaveLength(1);
        expect(parsed.navErrors[0]?.target).toBe('gone.md');
    });

    it('uses --config to point at a non-default mkdocs.yml', () => {
        writeFile('config/mkdocs.custom.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        const { exitCode } = runCli(['--config', 'config/mkdocs.custom.yml']);
        expect(exitCode).toBe(0);
    });

    it('reports a broken nav entry from a custom mkdocs.yml', () => {
        writeFile('config/mkdocs.custom.yml', 'site_name: test\nnav:\n  - Missing: gone.md\n');
        writeFile('docs/index.md', '# Home');
        const { exitCode, stderr } = runCli(['--config', 'config/mkdocs.custom.yml']);
        expect(exitCode).toBe(1);
        expect(stderr).toContain('gone.md');
    });

    it('reads skip patterns from check-mkdocs.json', () => {
        writeFile('check-mkdocs.json', JSON.stringify({ skip: ['drafts/**'] }));
        writeFile('mkdocs.yml', 'site_name: test\nnav:\n  - Home: index.md\n');
        writeFile('docs/index.md', '# Home');
        writeFile('docs/drafts/note.md', '# Draft');
        const { exitCode, stdout } = runCli([]);
        expect(exitCode).toBe(0);
        expect(stdout).toContain('Docs OK');
    });
});
