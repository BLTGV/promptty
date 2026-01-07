import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createTempDir, cleanupTempDir } from '../../tests/helpers.js';
import {
  loadConfig,
  getChannelConfig,
  resetConfigCache,
} from './loader.js';

describe('loadConfig', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTempDir();
    resetConfigCache();
  });

  afterEach(async () => {
    resetConfigCache();
    await cleanupTempDir(testDir);
  });

  test('loads valid config file', () => {
    const configPath = join(testDir, 'config.json');
    const config = {
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/tmp/project',
        },
      },
    };
    writeFileSync(configPath, JSON.stringify(config));

    const loaded = loadConfig(configPath);
    expect(loaded.channels['slack:T123/C456']).toBeDefined();
    expect(loaded.channels['slack:T123/C456'].workingDirectory).toBe('/tmp/project');
  });

  test('returns default config when file not found', () => {
    const configPath = join(testDir, 'nonexistent.json');

    const loaded = loadConfig(configPath);
    expect(loaded.channels).toEqual({});
    expect(loaded.defaults?.command).toBe('claude');
  });

  test('throws on invalid JSON', () => {
    const configPath = join(testDir, 'invalid.json');
    writeFileSync(configPath, 'not valid json {{{');

    expect(() => loadConfig(configPath)).toThrow();
  });

  test('throws on schema validation failure', () => {
    const configPath = join(testDir, 'bad-schema.json');
    writeFileSync(configPath, JSON.stringify({
      channels: {
        'slack:T123/C456': {
          // Missing required workingDirectory
        },
      },
    }));

    expect(() => loadConfig(configPath)).toThrow();
  });

  test('caches config on subsequent calls', () => {
    const configPath = join(testDir, 'config.json');
    const config = {
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/tmp/original',
        },
      },
    };
    writeFileSync(configPath, JSON.stringify(config));

    const loaded1 = loadConfig(configPath);
    expect(loaded1.channels['slack:T123/C456'].workingDirectory).toBe('/tmp/original');

    // Modify the file
    writeFileSync(configPath, JSON.stringify({
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/tmp/modified',
        },
      },
    }));

    // Should still return cached version
    const loaded2 = loadConfig(configPath);
    expect(loaded2.channels['slack:T123/C456'].workingDirectory).toBe('/tmp/original');
  });

  test('resetConfigCache allows fresh load', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/tmp/original',
        },
      },
    }));

    loadConfig(configPath);

    // Modify the file
    writeFileSync(configPath, JSON.stringify({
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/tmp/modified',
        },
      },
    }));

    // Reset and reload
    resetConfigCache();
    const loaded = loadConfig(configPath);
    expect(loaded.channels['slack:T123/C456'].workingDirectory).toBe('/tmp/modified');
  });

  test('loads config with slack credentials', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      slack: {
        appToken: 'xapp-test',
        botToken: 'xoxb-test',
      },
      channels: {},
    }));

    const loaded = loadConfig(configPath);
    expect(loaded.slack?.appToken).toBe('xapp-test');
    expect(loaded.slack?.botToken).toBe('xoxb-test');
  });

  test('loads config with defaults', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      defaults: {
        workingDirectory: '/default/path',
        command: 'custom-claude',
        sessionTTL: 3600000,
      },
      channels: {},
    }));

    const loaded = loadConfig(configPath);
    expect(loaded.defaults?.workingDirectory).toBe('/default/path');
    expect(loaded.defaults?.command).toBe('custom-claude');
    expect(loaded.defaults?.sessionTTL).toBe(3600000);
  });

  test('loads config with response filter', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      defaults: {
        workingDirectory: '/tmp',
        responseFilter: {
          mode: 'keywords',
          keywords: ['help', 'deploy'],
          allowDMs: false,
        },
      },
      channels: {},
    }));

    const loaded = loadConfig(configPath);
    expect(loaded.defaults?.responseFilter?.mode).toBe('keywords');
    expect(loaded.defaults?.responseFilter?.keywords).toEqual(['help', 'deploy']);
    expect(loaded.defaults?.responseFilter?.allowDMs).toBe(false);
  });
});

describe('getChannelConfig', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTempDir();
    resetConfigCache();
  });

  afterEach(async () => {
    resetConfigCache();
    await cleanupTempDir(testDir);
  });

  test('returns channel config when found', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/project',
          command: 'claude-custom',
        },
      },
    }));

    // Pre-load config to set the cache
    loadConfig(configPath);

    const config = getChannelConfig({
      platform: 'slack',
      workspaceId: 'T123',
      channelId: 'C456',
    });

    expect(config).not.toBeNull();
    expect(config?.workingDirectory).toBe('/project');
    expect(config?.command).toBe('claude-custom');
  });

  test('merges channel config with defaults', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      defaults: {
        systemPrompt: 'You are helpful',
        sessionTTL: 7200000,
      },
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/project',
          // systemPrompt not specified, should use default
        },
      },
    }));

    loadConfig(configPath);

    const config = getChannelConfig({
      platform: 'slack',
      workspaceId: 'T123',
      channelId: 'C456',
    });

    expect(config?.workingDirectory).toBe('/project');
    // systemPrompt comes from defaults (not set by schema default)
    expect(config?.systemPrompt).toBe('You are helpful');
    // sessionTTL: channel schema default (14400000) overrides config defaults (7200000)
    // because zod applies defaults during schema parsing
    expect(config?.sessionTTL).toBe(14400000);
  });

  test('returns defaults when channel not found but defaults have workingDirectory', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      defaults: {
        workingDirectory: '/default/project',
        command: 'default-claude',
      },
      channels: {},
    }));

    loadConfig(configPath);

    const config = getChannelConfig({
      platform: 'slack',
      workspaceId: 'T999',
      channelId: 'C999',
    });

    expect(config).not.toBeNull();
    expect(config?.workingDirectory).toBe('/default/project');
    expect(config?.command).toBe('default-claude');
  });

  test('returns null when channel not found and no defaults workingDirectory', () => {
    const configPath = join(testDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({
      channels: {},
    }));

    loadConfig(configPath);

    const config = getChannelConfig({
      platform: 'slack',
      workspaceId: 'T999',
      channelId: 'C999',
    });

    expect(config).toBeNull();
  });
});
