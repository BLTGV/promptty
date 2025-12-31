import type { OutputEvent, ContentBlock, TextBlock } from './types.js';

export function parseStreamLine(line: string): OutputEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as OutputEvent;
  } catch {
    // Not valid JSON, ignore
    return null;
  }
}

export function extractTextFromContent(content: ContentBlock[]): string {
  return content
    .filter((block): block is TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function extractFinalResult(events: OutputEvent[]): {
  output: string;
  sessionId?: string;
  isError: boolean;
} {
  // Look for result event first
  const resultEvent = events.find((e) => e.type === 'result');
  if (resultEvent && resultEvent.type === 'result') {
    return {
      output: resultEvent.result,
      sessionId: resultEvent.session_id,
      isError: resultEvent.is_error,
    };
  }

  // Fall back to collecting assistant text blocks
  const textParts: string[] = [];
  let sessionId: string | undefined;

  for (const event of events) {
    if (event.type === 'init') {
      sessionId = event.session_id;
    } else if (event.type === 'assistant') {
      const text = extractTextFromContent(event.message.message.content);
      if (text) textParts.push(text);
      sessionId = event.message.session_id;
    } else if (event.type === 'error') {
      return {
        output: `Error: ${event.error.message}`,
        sessionId,
        isError: true,
      };
    }
  }

  return {
    output: textParts.join('\n'),
    sessionId,
    isError: false,
  };
}
