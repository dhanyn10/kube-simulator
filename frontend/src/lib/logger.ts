import { useFlowStore } from '../store';

/**
 * Centralized logger that sends logs to the internal application log store.
 * These logs are displayed in the Log Modal and persistent in sessionStorage.
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
