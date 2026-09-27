import { EventsOn } from '@wailsjs/runtime';
import { useFlowStore } from '@/store';

/** Module-scoped storage for original console methods prior to interception. */
let storedOriginalLog: any = null;
let storedOriginalWarn: any = null;
let storedOriginalError: any = null;

/**
 * Safely resolves original console method references from window or globalThis context.
 *
 * @param key The global property name holding original console methods ('_originalConsoleLog', '_originalConsoleWarn', '_originalConsoleError').
 * @returns The original console function if captured, or undefined.
 */
const getOriginalConsoleMethod = (key: '_originalConsoleLog' | '_originalConsoleWarn' | '_originalConsoleError') => {
  if (typeof window !== 'undefined' && (window as any)[key]) {
    return (window as any)[key];
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
    return (globalThis as any)[key];
  }
  return undefined;
};

/**
 * Formats arbitrary console logging arguments into a unified string.
 * Automatically serializes Error instances with name, message, and stack trace,
 * and stringifies standard objects with error fallbacks for circular structures.
 *
 * @param args Array of log arguments passed to console methods.
 * @returns Formatted log string joining processed arguments with spaces.
 */
export const formatLogMessage = (args: any[]): string => {
  const originalError = getOriginalConsoleMethod('_originalConsoleError') || storedOriginalError;
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          if (originalError && originalError !== console.error) {
            originalError('Log serialization failed:', e);
          }
          return '[Unserializable Object]';
        }
      }
      return String(arg);
    })
    .join(' ');
};

/**
 * Registers Wails event listener for backend runtime log events.
 * Subscribes to 'backend-log' events emitted by Go backend and dispatches them
 * to the Zustand flow store under the 'Backend' category.
 */
export const setupBackendLogListener = (): void => {
  EventsOn('backend-log', (data: { level: string; message: string }) => {
    const { level, message } = data;
    const store = useFlowStore.getState();
    const logType = level === 'fatal' ? 'error' : (level as any);
    store.addLog(logType, message, 'Backend');
  });
};

/**
 * Overrides global console logging methods (console.error, console.warn, console.log).
 * Intercepts calls to capture formatted log entries into the Zustand flow store
 * while preserving native console logging via stored original console function references.
 */
export const setupConsoleOverrides = (): void => {
  storedOriginalLog = getOriginalConsoleMethod('_originalConsoleLog') || storedOriginalLog || console.log;
  storedOriginalWarn = getOriginalConsoleMethod('_originalConsoleWarn') || storedOriginalWarn || console.warn;
  storedOriginalError = getOriginalConsoleMethod('_originalConsoleError') || storedOriginalError || console.error;

  console.error = (...args: any[]) => {
    const originalError = getOriginalConsoleMethod('_originalConsoleError') || storedOriginalError;
    try {
      const message = formatLogMessage(args);
      useFlowStore.getState().addLog('error', message);
    } catch (e) {
      if (originalError && originalError !== console.error) originalError('Failed to capture error log:', e);
    }
    if (originalError && originalError !== console.error) originalError(...args);
  };

  console.warn = (...args: any[]) => {
    const originalError = getOriginalConsoleMethod('_originalConsoleError') || storedOriginalError;
    const originalWarn = getOriginalConsoleMethod('_originalConsoleWarn') || storedOriginalWarn;
    try {
      const message = formatLogMessage(args);
      useFlowStore.getState().addLog('warn', message);
    } catch (e) {
      if (originalError && originalError !== console.error) originalError('Failed to capture warn log:', e);
    }
    if (originalWarn && originalWarn !== console.warn) originalWarn(...args);
  };

  console.log = (...args: any[]) => {
    const originalError = getOriginalConsoleMethod('_originalConsoleError') || storedOriginalError;
    const originalLog = getOriginalConsoleMethod('_originalConsoleLog') || storedOriginalLog;
    try {
      const message = formatLogMessage(args);
      useFlowStore.getState().addLog('info', message);
    } catch (e) {
      if (originalError && originalError !== console.error) originalError('Failed to capture info log:', e);
    }
    if (originalLog && originalLog !== console.log) originalLog(...args);
  };
};

/**
 * Main initialization entry point for logging activity.
 * Sets up backend Wails log event listeners and applies frontend console overrides.
 */
export const initMainLogger = (): void => {
  setupBackendLogListener();
  setupConsoleOverrides();
};
