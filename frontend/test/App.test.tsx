import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { useFlowStore } from '../src/store';
import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';

// Mock Wails bindings and runtime
vi.mock('../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
}));

vi.mock('../wailsjs/go/main/App.js', () => ({
  GetSystemResources: vi.fn().mockResolvedValue({}),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      colorMode: 'dark',
      systemResources: { cpuCores: 8, totalMemoryGB: 32, freeMemoryGB: 16, cpuUsage: 10 },
    });
  });

  it('renders without crashing', async () => {
    render(
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    );

    // Check if some key elements are present
    expect(screen.getByText('File')).toBeDefined();
    expect(screen.getByText('Help')).toBeDefined();
  });

  it('renders monitoring mode if URL param is set', () => {
    // Mock window.location.search
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    window.location = { ...originalLocation, search: '?mode=monitoring' };

    render(
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    );

    // Real-time Monitoring should be visible in detached mode
    expect(screen.getByText('Real-time Monitoring')).toBeDefined();

    window.location = originalLocation;
  });
});
