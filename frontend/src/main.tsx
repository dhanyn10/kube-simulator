import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App.tsx';
import './index.css';
import { initWailsMocks } from './lib/mocks.ts';
import { useFlowStore } from './store';

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
        if ((globalThis as any)._originalConsoleError) {
          (globalThis as any)._originalConsoleError('Log serialization failed:', e);
        }
        return '[Unserializable Object]';
      }
    }
    return String(arg);
  }).join(' ');
};

// Global interception to capture third-party logs or unhandled errors
const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

// Attach to globalThis so other modules can use them before/after this file runs
(globalThis as any)._originalConsoleLog = originalLog;
(globalThis as any)._originalConsoleWarn = originalWarn;
(globalThis as any)._originalConsoleError = originalError;

// Initialize mocks for browser/test environments after original console methods are captured
initWailsMocks();

console.error = (...args: any[]) => {
  try {
    const message = formatLogMessage(args);
    useFlowStore.getState().addLog('error', message);
  } catch (e) {
    originalError('Failed to capture error log:', e);
  }
  originalError(...args);
};

console.warn = (...args: any[]) => {
  try {
    const message = formatLogMessage(args);
    useFlowStore.getState().addLog('warn', message);
  } catch (e) {
    originalError('Failed to capture warn log:', e);
  }
  originalWarn(...args);
};

console.log = (...args: any[]) => {
  try {
    const message = formatLogMessage(args);
    useFlowStore.getState().addLog('info', message);
  } catch (e) {
    originalError('Failed to capture info log:', e);
  }
  originalLog(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
);
