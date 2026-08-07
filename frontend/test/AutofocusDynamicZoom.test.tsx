import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/App';
import { useFlowStore } from '../src/store';

// Mock utils
vi.mock('../src/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/utils')>();
  return {
    ...actual,
    generateYaml: vi.fn().mockResolvedValue('mock yaml content'),
  };
});

// Capture useReactFlow setCenter calls
const mockSetCenter = vi.fn();

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => ({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      setCenter: mockSetCenter,
      fitBounds: vi.fn(),
      screenToFlowPosition: (p: any) => p,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
    ReactFlow: ({ children, onNodeClick, onPaneClick, onEdgeClick, onNodeContextMenu }: any) => (
      <div data-testid="mock-flow">
        <div data-testid="pane" onClick={onPaneClick} />
        <div
          data-testid="node-n1"
          onClick={(e) => onNodeClick(e, { id: 'n1', type: 'Pod', width: 100, height: 100, data: { label: 'pod-1' } })}
          onContextMenu={(e) => onNodeContextMenu(e, { id: 'n1', type: 'Pod', data: { label: 'pod-1' } })}
        />
        <div
          data-testid="node-namespace"
          onClick={(e) => onNodeClick(e, { id: 'ns1', type: 'Namespace', width: 800, height: 600, data: { label: 'ns-1' } })}
        />
        <div data-testid="edge-e1" onClick={(e) => onEdgeClick(e, { id: 'e1', source: 'n1', target: 'n2' })} />
        {children}
      </div>
    ),
    Panel: ({ children }: any) => <div>{children}</div>,
    MiniMap: () => <div>MiniMap</div>,
    Background: () => <div>Background</div>,
    ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock('../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
}));

vi.mock('../src/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../wailsjs/go/main/App.js', () => ({
  GetSystemResources: vi.fn().mockResolvedValue({}),
}));

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App Dynamic Zoom Autofocus tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', position: { x: 10, y: 20 }, width: 100, height: 100, data: { label: 'pod-1' } } as any,
        { id: 'ns1', type: 'Namespace', position: { x: 50, y: 50 }, width: 800, height: 600, data: { label: 'ns-1' } } as any,
      ],
      edges: [],
      colorMode: 'dark',
      isAutofocusEnabled: true,
      systemResources: { cpuCores: 8, totalMemoryGB: 32, freeMemoryGB: 16, cpuUsage: 10 },
    });
  });

  it('calculates proper zoom level and centers viewport on normal pod click', async () => {
    const mockBoundingRect = vi.fn().mockReturnValue({ width: 1000, height: 800 });
    const originalQuerySelector = document.querySelector;
    document.querySelector = vi.fn().mockImplementation((selector) => {
      if (selector === '.react-flow__renderer') {
        return { getBoundingClientRect: mockBoundingRect };
      }
      return originalQuerySelector(selector);
    });

    await act(async () => {
      render(<App />);
    });

    const podNode = screen.getByTestId('node-n1');
    await act(async () => {
      fireEvent.click(podNode);
    });

    // The pod has width/height 100.
    // Container width = 1000, padding = 0.2, availableWidth = 1000 * 0.6 = 600.
    // Container height = 800, padding = 0.2, availableHeight = 800 * 0.6 = 480.
    // scaleX = 600 / 100 = 6. scaleY = 480 / 100 = 4.8.
    // Minimum scale is 4.8, clamped to max 1.4.
    expect(mockSetCenter).toHaveBeenCalledWith(60, 70, { zoom: 1.4, duration: 800 });

    document.querySelector = originalQuerySelector;
  });

  it('calculates dynamic zoom level for a large namespace card', async () => {
    const mockBoundingRect = vi.fn().mockReturnValue({ width: 1000, height: 800 });
    const originalQuerySelector = document.querySelector;
    document.querySelector = vi.fn().mockImplementation((selector) => {
      if (selector === '.react-flow__renderer') {
        return { getBoundingClientRect: mockBoundingRect };
      }
      return originalQuerySelector(selector);
    });

    await act(async () => {
      render(<App />);
    });

    const namespaceNode = screen.getByTestId('node-namespace');
    await act(async () => {
      fireEvent.click(namespaceNode);
    });

    // Namespace has width 800, height 600.
    // AvailableWidth = 600, AvailableHeight = 480.
    // scaleX = 600 / 800 = 0.75.
    // scaleY = 480 / 600 = 0.8.
    // Minimum scale is 0.75, which is inside clamped bounds [0.5, 1.4].
    expect(mockSetCenter).toHaveBeenCalledWith(450, 350, { zoom: 0.75, duration: 800 });

    document.querySelector = originalQuerySelector;
  });
});
