import './init-console'; // Must be first
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App.tsx';
import './index.css';
import { initWailsMocks } from './lib/mocks.ts';
import { initMainLogger } from './activities/ui';

// Initialize mocks for browser/test environments after original console methods are captured
initWailsMocks();

// Initialize console overrides and backend log listener
initMainLogger();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
);
