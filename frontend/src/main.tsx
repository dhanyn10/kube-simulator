import './init-console'; // Must be first
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App.tsx';
import './index.css';
import { initWailsMocks } from './lib/mocks.ts';
import { useFlowStore } from './store';
import { EventsOn } from '../wailsjs/runtime';

const originalLog = (globalThis as any)._originalConsoleLog;
const originalWarn = (globalThis as any)._originalConsoleWarn;
const originalError = (globalThis as any)._originalConsoleError;

const formatLogMessage = (args: any[]) => {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        // Handle serialization error by logging to original console and returning placeholder
        if (originalError) {
          originalError('Log serialization failed:', e);
        }
        return '[Unserializable Object]';
      }
    }
    return String(arg);
  }).join(' ');
};

// Initialize mocks for browser/test environments after original console methods are captured
initWailsMocks();

// Listen for backend logs
EventsOn('backend-log', (data: { level: string, message: string }) => {
  const { level, message } = data;
  const store = useFlowStore.getState();
  // Map backend levels to frontend levels if necessary
  const logType = level === 'fatal' ? 'error' : (level as any);
  store.addLog(logType, message, 'Backend');
});

console.error = (...args: any[]) => {
  try {
    const message = formatLogMessage(args);
    useFlowStore.getState().addLog('error', message);
  } catch (e) {
    if (originalError) originalError('Failed to capture error log:', e);
  }
  if (originalError) originalError(...args);
};

console.warn = (...args: any[]) => {
  try {
    const message = formatLogMessage(args);
    useFlowStore.getState().addLog('warn', message);
  } catch (e) {
    if (originalError) originalError('Failed to capture warn log:', e);
  }
  if (originalWarn) originalWarn(...args);
};

console.log = (...args: any[]) => {
  try {
    const message = formatLogMessage(args);
    useFlowStore.getState().addLog('info', message);
  } catch (e) {
    if (originalError) originalError('Failed to capture info log:', e);
  }
  if (originalLog) originalLog(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
);
