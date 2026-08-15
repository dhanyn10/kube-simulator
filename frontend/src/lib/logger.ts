import { useFlowStore } from '../store';

/**
 * Centralized logger that sends logs to the internal application log store.
 * These logs are displayed in the Log Modal and are kept in-memory for the current session.
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    const formatted = formatMessage(message, args);
    useFlowStore.getState().addLog('info', formatted);
  },
  warn: (message: string, ...args: any[]) => {
    const formatted = formatMessage(message, args);
    useFlowStore.getState().addLog('warn', formatted);
  },
  error: (message: string, ...args: any[]) => {
    const formatted = formatMessage(message, args);
    useFlowStore.getState().addLog('error', formatted);
  },
  withScope: (scope: string) => ({
    info: (message: string, ...args: any[]) => {
      const formatted = formatMessage(message, args);
      useFlowStore.getState().addLog('info', formatted, scope);
    },
    warn: (message: string, ...args: any[]) => {
      const formatted = formatMessage(message, args);
      useFlowStore.getState().addLog('warn', formatted, scope);
    },
    error: (message: string, ...args: any[]) => {
      const formatted = formatMessage(message, args);
      useFlowStore.getState().addLog('error', formatted, scope);
    },
  }),
};

const formatMessage = (message: string, args: any[]) => {
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
