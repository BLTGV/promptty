import { describe, test, expect } from 'bun:test';
import {
  configSchema,
  channelConfigSchema,
  responseFilterSchema,
  shouldRespondToMessage,
  makeChannelKey,
  parseChannelKey,
  type MessageFilterContext,
  type ResponseFilter,
} from './types.js';

describe('responseFilterSchema', () => {
  test('defaults to mentions mode', () => {
    const result = responseFilterSchema.parse({});
    expect(result.mode).toBe('mentions');
  });

  test('defaults allowDMs to true', () => {
    const result = responseFilterSchema.parse({});
    expect(result.allowDMs).toBe(true);
  });

  test('accepts all valid modes', () => {
    const modes = ['all', 'mentions', 'keywords', 'regex', 'threads', 'none'];
    for (const mode of modes) {
      const result = responseFilterSchema.parse({ mode });
      expect(result.mode).toBe(mode);
    }
  });

  test('accepts keywords array', () => {
    const result = responseFilterSchema.parse({
      mode: 'keywords',
      keywords: ['help', 'deploy'],
    });
    expect(result.keywords).toEqual(['help', 'deploy']);
  });

  test('accepts regex patterns array', () => {
    const result = responseFilterSchema.parse({
      mode: 'regex',
      patterns: ['^hello', 'world$'],
    });
    expect(result.patterns).toEqual(['^hello', 'world$']);
  });
});

describe('channelConfigSchema', () => {
  test('requires workingDirectory', () => {
    expect(() => channelConfigSchema.parse({})).toThrow();
  });

  test('applies default command', () => {
    const result = channelConfigSchema.parse({ workingDirectory: '/tmp' });
    expect(result.command).toBe('claude');
  });

  test('applies default sessionTTL', () => {
    const result = channelConfigSchema.parse({ workingDirectory: '/tmp' });
    expect(result.sessionTTL).toBe(14400000); // 4 hours
  });

  test('applies default skipPermissions', () => {
    const result = channelConfigSchema.parse({ workingDirectory: '/tmp' });
    expect(result.skipPermissions).toBe(false);
  });

  test('accepts all optional fields', () => {
    const result = channelConfigSchema.parse({
      workingDirectory: '/tmp',
      command: 'custom-claude',
      systemPrompt: 'You are helpful',
      sessionTTL: 3600000,
      allowedTools: ['Read', 'Write'],
      skipPermissions: true,
      responseFilter: { mode: 'all' },
    });
    expect(result.command).toBe('custom-claude');
    expect(result.systemPrompt).toBe('You are helpful');
    expect(result.allowedTools).toEqual(['Read', 'Write']);
    expect(result.skipPermissions).toBe(true);
    expect(result.responseFilter?.mode).toBe('all');
  });
});

describe('configSchema', () => {
  test('validates minimal config', () => {
    const config = { channels: {} };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test('validates config with channel', () => {
    const config = {
      channels: {
        'slack:T123/C456': {
          workingDirectory: '/home/user/project',
        },
      },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test('rejects channel without workingDirectory', () => {
    const config = {
      channels: {
        'slack:T123/C456': {},
      },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  test('validates slack credentials', () => {
    const config = {
      slack: {
        appToken: 'xapp-test',
        botToken: 'xoxb-test',
      },
      channels: {},
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test('validates teams credentials', () => {
    const config = {
      teams: {
        appId: 'app-id',
        appPassword: 'app-password',
      },
      channels: {},
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test('validates defaults', () => {
    const config = {
      defaults: {
        workingDirectory: '/home/user/default',
        command: 'claude',
        responseFilter: { mode: 'mentions', allowDMs: true },
      },
      channels: {},
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe('shouldRespondToMessage', () => {
  const baseContext: MessageFilterContext = {
    text: 'hello world',
    isMention: false,
    isDM: false,
    isThread: false,
  };

  describe('default behavior (no filter)', () => {
    test('responds to DMs by default', () => {
      const result = shouldRespondToMessage(undefined, { ...baseContext, isDM: true });
      expect(result).toBe(true);
    });

    test('responds to mentions with no filter', () => {
      const result = shouldRespondToMessage(undefined, { ...baseContext, isMention: true });
      expect(result).toBe(true);
    });

    test('does not respond to regular messages with no filter', () => {
      const result = shouldRespondToMessage(undefined, baseContext);
      expect(result).toBe(false);
    });
  });

  describe('mode: all', () => {
    test('responds to everything', () => {
      const filter: ResponseFilter = { mode: 'all', allowDMs: true };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(true);
    });

    test('responds to non-mention, non-DM messages', () => {
      const filter: ResponseFilter = { mode: 'all', allowDMs: false };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(true);
    });
  });

  describe('mode: none', () => {
    test('responds to DMs when allowDMs is true', () => {
      const filter: ResponseFilter = { mode: 'none', allowDMs: true };
      expect(shouldRespondToMessage(filter, { ...baseContext, isDM: true })).toBe(true);
    });

    test('blocks DMs when allowDMs is false', () => {
      const filter: ResponseFilter = { mode: 'none', allowDMs: false };
      expect(shouldRespondToMessage(filter, { ...baseContext, isDM: true })).toBe(false);
    });

    test('does not respond to regular messages', () => {
      const filter: ResponseFilter = { mode: 'none', allowDMs: true };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });

    test('does not respond to mentions', () => {
      const filter: ResponseFilter = { mode: 'none', allowDMs: false };
      expect(shouldRespondToMessage(filter, { ...baseContext, isMention: true })).toBe(false);
    });
  });

  describe('mode: mentions', () => {
    test('responds to mentions', () => {
      const filter: ResponseFilter = { mode: 'mentions', allowDMs: true };
      expect(shouldRespondToMessage(filter, { ...baseContext, isMention: true })).toBe(true);
    });

    test('does not respond to non-mentions', () => {
      const filter: ResponseFilter = { mode: 'mentions', allowDMs: false };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });

    test('still responds to DMs if allowDMs is true', () => {
      const filter: ResponseFilter = { mode: 'mentions', allowDMs: true };
      expect(shouldRespondToMessage(filter, { ...baseContext, isDM: true })).toBe(true);
    });
  });

  describe('mode: threads', () => {
    test('responds to thread messages', () => {
      const filter: ResponseFilter = { mode: 'threads', allowDMs: false };
      expect(shouldRespondToMessage(filter, { ...baseContext, isThread: true })).toBe(true);
    });

    test('does not respond to non-thread messages', () => {
      const filter: ResponseFilter = { mode: 'threads', allowDMs: false };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });
  });

  describe('mode: keywords', () => {
    test('matches keyword case-insensitively', () => {
      const filter: ResponseFilter = {
        mode: 'keywords',
        keywords: ['help'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, { ...baseContext, text: 'I need HELP' })).toBe(true);
    });

    test('matches partial word containing keyword', () => {
      const filter: ResponseFilter = {
        mode: 'keywords',
        keywords: ['help'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, { ...baseContext, text: 'helpful tips' })).toBe(true);
    });

    test('does not match when keyword absent', () => {
      const filter: ResponseFilter = {
        mode: 'keywords',
        keywords: ['help'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, { ...baseContext, text: 'hello' })).toBe(false);
    });

    test('matches any keyword from the list', () => {
      const filter: ResponseFilter = {
        mode: 'keywords',
        keywords: ['help', 'deploy', 'status'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, { ...baseContext, text: 'check deploy' })).toBe(true);
    });

    test('returns false when keywords array is empty', () => {
      const filter: ResponseFilter = {
        mode: 'keywords',
        keywords: [],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });

    test('returns false when keywords is undefined', () => {
      const filter: ResponseFilter = {
        mode: 'keywords',
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });
  });

  describe('mode: regex', () => {
    test('matches regex pattern', () => {
      const filter: ResponseFilter = {
        mode: 'regex',
        patterns: ['^hello'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(true);
    });

    test('matches pattern case-insensitively', () => {
      const filter: ResponseFilter = {
        mode: 'regex',
        patterns: ['HELLO'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(true);
    });

    test('does not match when pattern fails', () => {
      const filter: ResponseFilter = {
        mode: 'regex',
        patterns: ['^goodbye'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });

    test('handles invalid regex gracefully', () => {
      const filter: ResponseFilter = {
        mode: 'regex',
        patterns: ['[invalid'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });

    test('matches any pattern from the list', () => {
      const filter: ResponseFilter = {
        mode: 'regex',
        patterns: ['^goodbye', 'world$'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(true);
    });

    test('returns false when patterns array is empty', () => {
      const filter: ResponseFilter = {
        mode: 'regex',
        patterns: [],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });
  });

  describe('combineModes', () => {
    test('matches if any combined mode matches (OR logic)', () => {
      const filter: ResponseFilter = {
        mode: 'none',
        combineModes: ['mentions', 'keywords'],
        keywords: ['help'],
        allowDMs: false,
      };
      // Should match because of mention
      expect(shouldRespondToMessage(filter, { ...baseContext, isMention: true })).toBe(true);
    });

    test('matches keywords in combined mode', () => {
      const filter: ResponseFilter = {
        mode: 'none',
        combineModes: ['mentions', 'keywords'],
        keywords: ['hello'],
        allowDMs: false,
      };
      // Should match because of keyword
      expect(shouldRespondToMessage(filter, baseContext)).toBe(true);
    });

    test('does not match if no combined mode matches', () => {
      const filter: ResponseFilter = {
        mode: 'none',
        combineModes: ['mentions', 'threads'],
        allowDMs: false,
      };
      expect(shouldRespondToMessage(filter, baseContext)).toBe(false);
    });
  });
});

describe('makeChannelKey', () => {
  test('creates correct key format for slack', () => {
    const key = makeChannelKey({
      platform: 'slack',
      workspaceId: 'T123',
      channelId: 'C456',
    });
    expect(key).toBe('slack:T123/C456');
  });

  test('creates correct key format for teams', () => {
    const key = makeChannelKey({
      platform: 'teams',
      workspaceId: 'tenant-id',
      channelId: 'channel-id',
    });
    expect(key).toBe('teams:tenant-id/channel-id');
  });

  test('handles complex IDs', () => {
    const key = makeChannelKey({
      platform: 'slack',
      workspaceId: 'T0AN32YJH',
      channelId: 'C0123456789',
    });
    expect(key).toBe('slack:T0AN32YJH/C0123456789');
  });
});

describe('parseChannelKey', () => {
  test('parses valid slack key', () => {
    const result = parseChannelKey('slack:T123/C456');
    expect(result).toEqual({
      platform: 'slack',
      workspaceId: 'T123',
      channelId: 'C456',
    });
  });

  test('parses valid teams key', () => {
    const result = parseChannelKey('teams:tenant-id/channel-id');
    expect(result).toEqual({
      platform: 'teams',
      workspaceId: 'tenant-id',
      channelId: 'channel-id',
    });
  });

  test('returns null for invalid format - missing platform', () => {
    expect(parseChannelKey('T123/C456')).toBeNull();
  });

  test('returns null for invalid format - wrong platform', () => {
    expect(parseChannelKey('other:T123/C456')).toBeNull();
  });

  test('returns null for invalid format - missing slash', () => {
    expect(parseChannelKey('slack:T123-C456')).toBeNull();
  });

  test('returns null for invalid format - missing parts', () => {
    expect(parseChannelKey('slack:')).toBeNull();
    expect(parseChannelKey('slack:T123')).toBeNull();
    expect(parseChannelKey('slack:T123/')).toBeNull();
  });

  test('round-trip: make then parse', () => {
    const original = {
      platform: 'slack' as const,
      workspaceId: 'T0AN32YJH',
      channelId: 'C0123456789',
    };
    const key = makeChannelKey(original);
    const parsed = parseChannelKey(key);
    expect(parsed).toEqual(original);
  });
});
