import { z } from 'zod';

export const channelConfigSchema = z.object({
  workingDirectory: z.string(),
  command: z.string().default('claude'),
  systemPrompt: z.string().optional(),
  sessionTTL: z.number().default(14400000), // 4 hours
  allowedTools: z.array(z.string()).optional(),
  skipPermissions: z.boolean().default(false), // Use --dangerously-skip-permissions
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

export type ChannelConfig = z.infer<typeof channelConfigSchema>;
export type Config = z.infer<typeof configSchema>;

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
