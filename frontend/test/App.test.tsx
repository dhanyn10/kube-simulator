import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

// Mock ReactFlow to avoid layout issues and easily trigger handlers
vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
      ...actual,
      useReactFlow: () => ({
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        setCenter: vi.fn(),
        fitBounds: vi.fn(),
        screenToFlowPosition: (p: any) => p,
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      }),
      ReactFlow: ({ children, onNodeClick, onPaneClick, onEdgeClick, onNodeContextMenu }: any) => (
        <div data-testid="mock-flow">
          <div data-testid="pane" onClick={onPaneClick} />
          <div data-testid="node-n1"
               onClick={(e) => onNodeClick(e, { id: 'n1', type: 'Pod', data: { label: 'pod-1' } })}
               onContextMenu={(e) => onNodeContextMenu(e, { id: 'n1', type: 'Pod', data: { label: 'pod-1' } })}
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

// Mock Wails bindings and runtime
vi.mock('../wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => () => {}),
}));

let capturedKeyboardOptions: any = null;
vi.mock('../src/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn((options) => {
    capturedKeyboardOptions = options;
  }),
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
      isAutofocusEnabled: false,
      systemResources: { cpuCores: 8, totalMemoryGB: 32, freeMemoryGB: 16, cpuUsage: 10 },
    });
  });

  it('renders without crashing', async () => {
    await act(async () => {
        render(<App />);
    });

    expect(screen.getByText('File')).toBeDefined();
  });

  it('renders monitoring mode if URL param is set', async () => {
    const originalLocation = window.location;
    // @ts-ignore
    delete window.location;
    window.location = ({ ...originalLocation, search: '?mode=monitoring' } as any);

    await act(async () => {
        render(<App />);
    });

    expect(screen.getByText('Real-time Monitoring')).toBeDefined();
    window.location = (originalLocation as any);
  });

  it('handles node clicks and context menu', async () => {
    const node = { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
    useFlowStore.setState({
      nodes: [node],
      isAutofocusEnabled: true,
    });

    await act(async () => {
        render(<App />);
    });

    const nodeElement = screen.getByTestId('node-n1');

    // Use act for events that trigger state updates in the store
    await act(async () => {
        fireEvent.click(nodeElement);
    });
    expect(useFlowStore.getState().configuringNodeId).toBe('n1');

    fireEvent.contextMenu(nodeElement);
    expect(screen.getByText('Delete')).toBeDefined();

    await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
    });

    // Context menu should close
    await waitFor(() => {
        expect(screen.queryByText('Delete')).toBeNull();
    });
  });

  it('handles edge clicks with autofocus', async () => {
    const nodes = [
        { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'n1' } },
        { id: 'n2', type: 'Service', position: { x: 200, y: 0 }, data: { label: 'n2' } }
    ];
    const edges = [{ id: 'e1', source: 'n1', target: 'n2', type: 'custom', data: {} }];
    useFlowStore.setState({ nodes, edges, isRightSidebarVisible: false, isAutofocusEnabled: true });

    await act(async () => {
        render(<App />);
    });

    await act(async () => {
        fireEvent.click(screen.getByTestId('edge-e1'));
    });

    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);
    expect(useFlowStore.getState().configuringEdgeId).toBe('e1');
  });

  it('handles pane clicks', async () => {
    useFlowStore.setState({ configuringNodeId: 'n1' });
    await act(async () => {
        render(<App />);
    });

    await act(async () => {
        fireEvent.click(screen.getByTestId('pane'));
    });
    expect(useFlowStore.getState().configuringNodeId).toBeNull();
  });

  it('handles MenuBar toggle actions', async () => {
    await act(async () => {
        render(<App />);
    });

    // Open View menu
    fireEvent.click(screen.getByText('View'));

    // Just find by text and click
    const autofocusItem = await screen.findByText('Autofocus');

    fireEvent.click(autofocusItem);

    await waitFor(() => {
        expect(useFlowStore.getState().isAutofocusEnabled).toBe(true);
    });
  });

  it('handles MenuBar actions', async () => {
    await act(async () => {
        render(<App />);
    });

    // Test About
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('About'));
    expect(await screen.findByText('Kube Simulator')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Close About'));

    // Test opening Logs
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Logs'));
    expect(await screen.findByText('Console Logs')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Close'));

    // Test opening Scenarios
    fireEvent.click(screen.getByText('Resource'));
    fireEvent.click(await screen.findByText('Scenarios'));
    expect(await screen.findByText('Learning Scenarios')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Close'));

    // Test Resource Manager
    fireEvent.click(screen.getByText('Resource'));
    fireEvent.click(screen.getByText('Resource Manager'));
    expect(await screen.findByText('Resource Manager')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Close'));

    // Test Export
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Export'));
    expect(await screen.findByText('Kubernetes Manifest Output')).toBeDefined();
  });

  it('handles keyboard shortcut callbacks', async () => {
    const groupSpy = vi.spyOn(useFlowStore.getState(), 'groupNodes');
    const ungroupSpy = vi.spyOn(useFlowStore.getState(), 'ungroupNodes');

    useFlowStore.setState({
      nodes: [
        { id: 'n1', selected: true, type: 'Pod', data: {} } as any,
        { id: 'n2', selected: true, type: 'Pod', data: {} } as any
      ]
    });

    await act(async () => {
        render(<App />);
    });

    expect(capturedKeyboardOptions).not.toBeNull();

    // Test Group
    capturedKeyboardOptions.onGroup();
    expect(groupSpy).toHaveBeenCalledWith(['n1', 'n2']);

    // Test Ungroup
    capturedKeyboardOptions.onUngroup();
    expect(ungroupSpy).toHaveBeenCalledWith(['n1', 'n2']);
  });
});
