import { truncateWithEllipsis, formatDuration, type FormattedResponse } from './common.js';

const SLACK_MAX_LENGTH = 4000;

export function formatAcknowledgement(): FormattedResponse {
  return {
    text: ':hourglass_flowing_sand: Processing your request...',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':hourglass_flowing_sand: *Processing your request...*',
        },
      },
    ],
  };
}

export function formatResponse(output: string, duration?: number): FormattedResponse {
  const truncated = truncateWithEllipsis(convertMarkdownToMrkdwn(output), SLACK_MAX_LENGTH - 100);

  let text = truncated;
  if (duration) {
    text += `\n\n_Completed in ${formatDuration(duration)}_`;
  }

  return {
    text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: truncated,
        },
      },
      ...(duration
        ? [
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `:stopwatch: ${formatDuration(duration)}`,
                },
              ],
            },
          ]
        : []),
    ],
  };
}

export function formatError(error: string): FormattedResponse {
  return {
    text: `:x: Error: ${error}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:x: *Error*\n${truncateWithEllipsis(error, 500)}`,
        },
      },
    ],
  };
}

export function formatProgress(message: string): FormattedResponse {
  return {
    text: `:gear: ${message}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:gear: ${message}`,
        },
      },
    ],
  };
}

function convertMarkdownToMrkdwn(markdown: string): string {
  let result = markdown;

  // Convert **bold** to *bold* (Slack uses single asterisks)
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // Convert __bold__ to *bold*
  result = result.replace(/__([^_]+)__/g, '*$1*');

  // Convert headers to bold
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // Keep code blocks as-is (Slack supports triple backticks)
  // Keep inline code as-is (Slack supports single backticks)

  // Convert [text](url) to <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  return result;
}

export function formatIntermediateUpdate(message: string, type: 'progress' | 'warning' | 'success' | 'error' = 'progress'): FormattedResponse {
  const emoji = {
    progress: ':hourglass:',
    warning: ':warning:',
    success: ':white_check_mark:',
    error: ':x:',
  }[type];

  return {
    text: `${emoji} ${message}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} ${message}`,
        },
      },
    ],
  };
}
