export type LogLevel = 'info' | 'warn' | 'error';
export type LogConsumer = (level: LogLevel, message: string, scope?: string) => void;

let activeConsumer: LogConsumer | null = null;

/**
 * Registers an active log consumer (e.g. application log store or external monitoring sink).
 *
 * @param consumer - A callback receiving log level, formatted message, and optional scope.
 */
export const setLogConsumer = (consumer: LogConsumer | null): void => {
  activeConsumer = consumer;
};

/**
 * Retrieves the currently active log consumer, if registered.
 */
export const getLogConsumer = (): LogConsumer | null => activeConsumer;

const dispatchLog = (level: LogLevel, formatted: string, scope?: string): void => {
  if (activeConsumer) {
    if (scope !== undefined) {
      activeConsumer(level, formatted, scope);
    } else {
      activeConsumer(level, formatted);
    }
    return;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).useFlowStore?.getState) {
    const store = (globalThis as any).useFlowStore.getState();
    if (scope !== undefined) {
      store?.addLog?.(level, formatted, scope);
    } else {
      store?.addLog?.(level, formatted);
    }
  }
};

/**
 * Centralized logger that sends logs to the registered log consumer.
 * Operates as a decoupled library facade without hard-coding application state dependencies.
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    const formatted = formatMessage(message, args);
    dispatchLog('info', formatted);
  },
  warn: (message: string, ...args: any[]) => {
    const formatted = formatMessage(message, args);
    dispatchLog('warn', formatted);
  },
  error: (message: string, ...args: any[]) => {
    const formatted = formatMessage(message, args);
    dispatchLog('error', formatted);
  },
  withScope: (scope: string) => ({
    info: (message: string, ...args: any[]) => {
      const formatted = formatMessage(message, args);
      dispatchLog('info', formatted, scope);
    },
    warn: (message: string, ...args: any[]) => {
      const formatted = formatMessage(message, args);
      dispatchLog('warn', formatted, scope);
    },
    error: (message: string, ...args: any[]) => {
      const formatted = formatMessage(message, args);
      dispatchLog('error', formatted, scope);
    },
  }),
};

const formatMessage = (message: string, args: any[]): string => {
  if (args.length === 0) return message;

  const formattedArgs = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return '[Circular Object]';
      }
    }
    return String(arg);
  }).join(' ');

  return `${message} ${formattedArgs}`;
};
