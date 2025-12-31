export interface ExecuteOptions {
  workingDirectory: string;
  sessionId?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  skipPermissions?: boolean;
  timeout?: number;
  onUpdate?: (event: OutputEvent) => void;
}

export interface ExecuteResult {
  success: boolean;
  output: string;
  claudeSessionId?: string;
  error?: string;
  duration: number;
}

// Claude Code stream-json event types
export type OutputEvent =
  | InitEvent
  | SystemEvent
  | AssistantEvent
  | UserEvent
  | ResultEvent
  | ErrorEvent;

export interface InitEvent {
  type: 'init';
  session_id: string;
  cwd: string;
  model: string;
}

export interface SystemEvent {
  type: 'system';
  message: string;
  level?: 'info' | 'warning' | 'error';
}

export interface AssistantEvent {
  type: 'assistant';
  message: AssistantMessage;
}

export interface AssistantMessage {
  type: 'assistant';
  message: MessageContent;
  session_id: string;
}

export interface MessageContent {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface UserEvent {
  type: 'user';
  message: UserMessage;
}

export interface UserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
}

export interface ResultEvent {
  type: 'result';
  result: string;
  session_id: string;
  cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  is_error: boolean;
  num_turns: number;
}

export interface ErrorEvent {
  type: 'error';
  error: {
    message: string;
    code?: string;
  };
}
