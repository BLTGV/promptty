import { env } from '../config/env.js';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const currentLevel = LOG_LEVELS[env.LOG_LEVEL] ?? LOG_LEVELS.info;

function formatMessage(level: LogLevel, module: string | null, msg: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const prefix = module ? `[${module}]` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp} ${level.toUpperCase().padEnd(5)} ${prefix} ${msg}${dataStr}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

class Logger {
  constructor(private module: string | null = null) {}

  trace(data: Record<string, unknown>, msg: string): void;
  trace(msg: string): void;
  trace(dataOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!shouldLog('trace')) return;
    const [message, data] = typeof dataOrMsg === 'string' ? [dataOrMsg, undefined] : [msg!, dataOrMsg];
    console.debug(formatMessage('trace', this.module, message, data));
  }

  debug(data: Record<string, unknown>, msg: string): void;
  debug(msg: string): void;
  debug(dataOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!shouldLog('debug')) return;
    const [message, data] = typeof dataOrMsg === 'string' ? [dataOrMsg, undefined] : [msg!, dataOrMsg];
    console.debug(formatMessage('debug', this.module, message, data));
  }

  info(data: Record<string, unknown>, msg: string): void;
  info(msg: string): void;
  info(dataOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!shouldLog('info')) return;
    const [message, data] = typeof dataOrMsg === 'string' ? [dataOrMsg, undefined] : [msg!, dataOrMsg];
    console.info(formatMessage('info', this.module, message, data));
  }

  warn(data: Record<string, unknown>, msg: string): void;
  warn(msg: string): void;
  warn(dataOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!shouldLog('warn')) return;
    const [message, data] = typeof dataOrMsg === 'string' ? [dataOrMsg, undefined] : [msg!, dataOrMsg];
    console.warn(formatMessage('warn', this.module, message, data));
  }

  error(data: Record<string, unknown>, msg: string): void;
  error(msg: string): void;
  error(dataOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!shouldLog('error')) return;
    const [message, data] = typeof dataOrMsg === 'string' ? [dataOrMsg, undefined] : [msg!, dataOrMsg];
    console.error(formatMessage('error', this.module, message, data));
  }

  fatal(data: Record<string, unknown>, msg: string): void;
  fatal(msg: string): void;
  fatal(dataOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (!shouldLog('fatal')) return;
    const [message, data] = typeof dataOrMsg === 'string' ? [dataOrMsg, undefined] : [msg!, dataOrMsg];
    console.error(formatMessage('fatal', this.module, message, data));
  }

  child(bindings: { module: string }): Logger {
    return new Logger(bindings.module);
  }
}

export const logger = new Logger();

export function createChildLogger(name: string): Logger {
  return new Logger(name);
}
