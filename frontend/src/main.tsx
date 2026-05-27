import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App.tsx';
import './index.css';
import { initWailsMocks } from './lib/mocks.ts';
import { useFlowStore } from './store';

// Initialize mocks for browser/test environments
initWailsMocks();

// Intercept console errors and warnings
const originalError = console.error;
const originalWarn = console.warn;

// Expose original error for internal use to avoid recursion
(globalThis as any)._originalConsoleError = originalError;

const formatLogMessage = (args: any[]) => {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return '[Circular Object]';
      }
    }
    return String(arg);
  }).join(' ');
};

console.error = (...args: any[]) => {
  const message = formatLogMessage(args);
  useFlowStore.getState().addLog('error', message);
  originalError.apply(console, args);
};

console.warn = (...args: any[]) => {
  const message = formatLogMessage(args);
  useFlowStore.getState().addLog('warn', message);
  originalWarn.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
);
