import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../src/config.js';

let tmpDir: string;

beforeEach(() => {
    tmpDir = join(tmpdir(), `check-mkdocs-config-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
    it('returns defaults when config file is missing', () => {
        const config = loadConfig(join(tmpDir, 'nonexistent.json'));
        expect(config.mkdocsPath).toBe('mkdocs.yml');
        expect(config.docsDir).toBe('docs');
        expect(config.skip).toEqual([]);
    });

    it('loads full config from file', () => {
        const configPath = join(tmpDir, 'check-mkdocs.json');
        writeFileSync(
            configPath,
            JSON.stringify({
                mkdocsPath: 'mkdocs.dev.yml',
                docsDir: 'documentation',
                skip: ['drafts/**'],
            }),
        );
        const config = loadConfig(configPath);
        expect(config.mkdocsPath).toBe('mkdocs.dev.yml');
        expect(config.docsDir).toBe('documentation');
        expect(config.skip).toEqual(['drafts/**']);
    });

    it('merges partial config with defaults', () => {
        const configPath = join(tmpDir, 'check-mkdocs.json');
        writeFileSync(configPath, JSON.stringify({ docsDir: 'guide' }));
        const config = loadConfig(configPath);
        expect(config.docsDir).toBe('guide');
        expect(config.mkdocsPath).toBe('mkdocs.yml');
        expect(config.skip).toEqual([]);
    });

    it('handles malformed JSON gracefully', () => {
        const configPath = join(tmpDir, 'bad.json');
        writeFileSync(configPath, 'not json{{{');
        const config = loadConfig(configPath);
        expect(config.mkdocsPath).toBe('mkdocs.yml');
        expect(config.docsDir).toBe('docs');
        expect(config.skip).toEqual([]);
    });
});
