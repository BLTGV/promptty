import { truncateWithEllipsis, formatDuration } from './common.js';

const TEAMS_MAX_LENGTH = 28000; // Adaptive Cards have a higher limit

export interface AdaptiveCard {
  type: 'AdaptiveCard';
  $schema: string;
  version: string;
  body: unknown[];
  actions?: unknown[];
}

export function createAdaptiveCard(body: unknown[], actions?: unknown[]): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
    ...(actions && { actions }),
  };
}

export function formatAcknowledgement(): AdaptiveCard {
  return createAdaptiveCard([
    {
      type: 'TextBlock',
      text: '⏳ Processing your request...',
      weight: 'bolder',
      size: 'medium',
    },
  ]);
}

export function formatResponse(output: string, duration?: number): AdaptiveCard {
  const truncated = truncateWithEllipsis(output, TEAMS_MAX_LENGTH);

  const body: unknown[] = [];

  // Split by code blocks and format appropriately
  const parts = splitCodeBlocks(truncated);

  for (const part of parts) {
    if (part.isCode) {
      body.push({
        type: 'Container',
        style: 'emphasis',
        items: [
          {
            type: 'TextBlock',
            text: part.content,
            fontType: 'monospace',
            wrap: true,
            maxLines: 50,
          },
        ],
      });
    } else if (part.content.trim()) {
      body.push({
        type: 'TextBlock',
        text: convertMarkdownToTeams(part.content),
        wrap: true,
      });
    }
  }

  if (duration) {
    body.push({
      type: 'TextBlock',
      text: `⏱️ Completed in ${formatDuration(duration)}`,
      size: 'small',
      isSubtle: true,
    });
  }

  return createAdaptiveCard(body);
}

export function formatError(error: string): AdaptiveCard {
  return createAdaptiveCard([
    {
      type: 'TextBlock',
      text: '❌ Error',
      weight: 'bolder',
      color: 'attention',
    },
    {
      type: 'TextBlock',
      text: truncateWithEllipsis(error, 500),
      wrap: true,
    },
  ]);
}

export function formatProgress(message: string, type: 'progress' | 'warning' | 'success' | 'error' = 'progress'): AdaptiveCard {
  const emoji = {
    progress: '⏳',
    warning: '⚠️',
    success: '✅',
    error: '❌',
  }[type];

  const color = {
    progress: 'default',
    warning: 'warning',
    success: 'good',
    error: 'attention',
  }[type];

  return createAdaptiveCard([
    {
      type: 'TextBlock',
      text: `${emoji} ${message}`,
      color,
      wrap: true,
    },
  ]);
}

interface TextPart {
  content: string;
  isCode: boolean;
}

function splitCodeBlocks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const regex = /```[\s\S]*?```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        content: text.substring(lastIndex, match.index),
        isCode: false,
      });
    }

    // Add code block (strip the backticks)
    const code = match[0].replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    parts.push({
      content: code,
      isCode: true,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      content: text.substring(lastIndex),
      isCode: false,
    });
  }

  return parts;
}

function convertMarkdownToTeams(markdown: string): string {
  let result = markdown;

  // Teams Adaptive Cards support a subset of markdown
  // Bold: **text** stays as is
  // Italic: *text* stays as is
  // Links: [text](url) stays as is

  // Convert headers to bold
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  return result;
}
