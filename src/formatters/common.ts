const MAX_LENGTH = 4000;

export function truncateWithEllipsis(text: string, maxLength: number = MAX_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[*_~`]/g, '\\$&');
}

export function formatCodeBlock(code: string, language?: string): string {
  const lang = language || '';
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export interface FormattedResponse {
  text: string;
  blocks?: unknown[];
}
