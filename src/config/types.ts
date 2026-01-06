import { z } from 'zod';

// Response filter configuration - determines which messages promptty responds to
export const responseFilterSchema = z.object({
  // 'all' - respond to all messages (current behavior)
  // 'mentions' - only respond when @mentioned
  // 'keywords' - respond when message contains certain keywords
  // 'regex' - respond when message matches regex patterns
  // 'threads' - only respond in threads (not top-level channel messages)
  // 'none' - don't respond to anything (channel disabled)
  mode: z.enum(['all', 'mentions', 'keywords', 'regex', 'threads', 'none']).default('mentions'),
  // Keywords to trigger response (for 'keywords' mode)
  keywords: z.array(z.string()).optional(),
  // Regex patterns to trigger response (for 'regex' mode)
  patterns: z.array(z.string()).optional(),
  // Whether to respond to direct messages (DMs always respond by default)
  allowDMs: z.boolean().default(true),
  // Combine multiple filter modes with 'or' logic
  // e.g., respond if mentioned OR if keywords match
  combineModes: z.array(z.enum(['mentions', 'keywords', 'regex', 'threads'])).optional(),
}).default({ mode: 'mentions' });

export const channelConfigSchema = z.object({
  workingDirectory: z.string(),
  command: z.string().default('claude'),
  systemPrompt: z.string().optional(),
  sessionTTL: z.number().default(14400000), // 4 hours
  allowedTools: z.array(z.string()).optional(),
  skipPermissions: z.boolean().default(false), // Use --dangerously-skip-permissions
  // Response filtering - controls what messages promptty responds to
  responseFilter: responseFilterSchema.optional(),
});

export const configSchema = z.object({
  slack: z.object({
    appToken: z.string().optional(),
    botToken: z.string().optional(),
    signingSecret: z.string().optional(),
  }).optional(),

  teams: z.object({
    appId: z.string().optional(),
    appPassword: z.string().optional(),
  }).optional(),

  channels: z.record(z.string(), channelConfigSchema),

  defaults: channelConfigSchema.partial().optional(),
});

export type ResponseFilter = z.infer<typeof responseFilterSchema>;
export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type Config = z.infer<typeof configSchema>;

// Message context for filtering decisions
export interface MessageFilterContext {
  text: string;
  isMention: boolean;   // Was the bot @mentioned
  isDM: boolean;        // Is this a direct message
  isThread: boolean;    // Is this in a thread
  botUserId?: string;   // Bot's user ID for mention detection
}

// Check if a message should be responded to based on the filter config
export function shouldRespondToMessage(
  filter: ResponseFilter | undefined,
  context: MessageFilterContext
): boolean {
  // Default behavior (no filter configured): only respond to mentions
  if (!filter) {
    return context.isMention || context.isDM;
  }

  // DMs always allowed unless explicitly disabled
  if (context.isDM && filter.allowDMs) {
    return true;
  }

  // Check combined modes first (OR logic)
  if (filter.combineModes && filter.combineModes.length > 0) {
    return filter.combineModes.some(mode =>
      checkSingleMode(mode, filter, context)
    );
  }

  // Single mode check
  return checkSingleMode(filter.mode, filter, context);
}

function checkSingleMode(
  mode: string,
  filter: ResponseFilter,
  context: MessageFilterContext
): boolean {
  switch (mode) {
    case 'all':
      return true;

    case 'none':
      return false;

    case 'mentions':
      return context.isMention;

    case 'threads':
      return context.isThread;

    case 'keywords':
      if (!filter.keywords || filter.keywords.length === 0) {
        return false;
      }
      const lowerText = context.text.toLowerCase();
      return filter.keywords.some(kw => lowerText.includes(kw.toLowerCase()));

    case 'regex':
      if (!filter.patterns || filter.patterns.length === 0) {
        return false;
      }
      return filter.patterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(context.text);
        } catch {
          return false; // Invalid regex, skip
        }
      });

    default:
      return context.isMention; // Fallback to mentions-only
  }
}

export interface ChannelKey {
  platform: 'slack' | 'teams';
  workspaceId: string;
  channelId: string;
}

export function makeChannelKey(key: ChannelKey): string {
  return `${key.platform}:${key.workspaceId}/${key.channelId}`;
}

export function parseChannelKey(key: string): ChannelKey | null {
  const match = key.match(/^(slack|teams):([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    platform: match[1] as 'slack' | 'teams',
    workspaceId: match[2],
    channelId: match[3],
  };
}
