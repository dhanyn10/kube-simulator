import { EventsOn } from '@wailsjs/runtime';
import { useFlowStore } from '@/store';

let storedOriginalLog: any = null;
let storedOriginalWarn: any = null;
let storedOriginalError: any = null;

const getOriginalConsoleMethod = (key: '_originalConsoleLog' | '_originalConsoleWarn' | '_originalConsoleError') => {
  if (typeof window !== 'undefined' && (window as any)[key]) {
    return (window as any)[key];
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
    return (globalThis as any)[key];
  }
  return undefined;
};

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

export const setupBackendLogListener = (): void => {
  EventsOn('backend-log', (data: { level: string; message: string }) => {
    const { level, message } = data;
    const store = useFlowStore.getState();
    const logType = level === 'fatal' ? 'error' : (level as any);
    store.addLog(logType, message, 'Backend');
  });
};

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

export const initMainLogger = (): void => {
  setupBackendLogListener();
  setupConsoleOverrides();
};
