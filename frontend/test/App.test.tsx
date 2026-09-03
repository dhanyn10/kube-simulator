import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
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

let capturedEventsOnCallback: any = null;
vi.mock('../src/wailsjs/runtime', () => ({
  EventsOn: vi.fn((event, callback) => {
    if (event === 'openAboutDialog') {
      capturedEventsOnCallback = callback;
    }
    return () => {};
  }),
}));

let capturedMiniMapNodeColor: any = null;
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => ({
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      setCenter: vi.fn(),
      fitBounds: vi.fn(),
      getNodes: () => [],
      screenToFlowPosition: (p: any) => p,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    }),
    ReactFlow: ({ children, onNodeClick, onPaneClick, onEdgeClick, onNodeContextMenu, onPaneContextMenu }: any) => (
      <div data-testid="mock-flow">
        <div data-testid="pane" onClick={onPaneClick} onContextMenu={onPaneContextMenu} />
        <div data-testid="node-n1"
             onClick={(e) => onNodeClick(e, { id: 'n1', type: 'Pod', data: { label: 'pod-1' } })}
             onContextMenu={(e) => onNodeContextMenu(e, { id: 'n1', type: 'Pod', data: { label: 'pod-1' } })}
        />
        <div data-testid="edge-e1" onClick={(e) => onEdgeClick(e, { id: 'e1', source: 'n1', target: 'n2' })} />
        {children}
      </div>
    ),
    Panel: ({ children }: any) => <div>{children}</div>,
    MiniMap: ({ nodeColor }: any) => {
      capturedMiniMapNodeColor = nodeColor;
      return <div>MiniMap</div>;
    },
    Background: () => <div>Background</div>,
    ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  };
});

let capturedKeyboardOptions: any = null;
vi.mock('../src/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn((options) => {
    capturedKeyboardOptions = options;
  }),
}));

vi.mock('../src/wailsjs/go/main/App.js', () => ({
  GetSystemResources: vi.fn().mockResolvedValue({ cpuCores: 4, totalMemoryGB: 16 }),
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
    capturedEventsOnCallback = null;
    capturedMiniMapNodeColor = null;

    useFlowStore.setState({
      nodes: [],
      edges: [],
      colorMode: 'dark',
      isAutofocusEnabled: false,
      canvasBgColor: 'default',
      canvasBgVariant: 'lines',
      canvasBgOpacity: 0.8,
      systemResources: { cpuCores: 8, totalMemoryGB: 32, freeMemoryGB: 16, cpuUsage: 10 },
      roleModalTargetNode: null,
    });

    (globalThis as any).go = {
      main: {
        App: {
          GetSetting: vi.fn().mockImplementation((key: string) => {
            if (key === 'globalEdgeColor') return Promise.resolve('#ff0000');
            if (key === 'globalEdgeErrorColor') return Promise.resolve('#00ff00');
            return Promise.resolve('');
          }),
          GetSystemResources: vi.fn().mockResolvedValue({ cpuCores: 4 }),
          GetSystemInfo: vi.fn().mockResolvedValue({ version: '1.0.0' }),
          CheckForUpdates: vi.fn().mockResolvedValue({ updateAvailable: false }),
        },
      },
    };
  });

  it('renders without crashing and initializes settings and system resources', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('File')).toBeDefined();
    expect((globalThis as any).go.main.App.GetSetting).toHaveBeenCalledWith('globalEdgeColor');
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

  it('handles pane context menu and node clicks/context menu', async () => {
    const node = { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
    useFlowStore.setState({
      nodes: [node],
      isAutofocusEnabled: true,
    });

    await act(async () => {
      render(<App />);
    });

    const nodeElement = screen.getByTestId('node-n1');

    await act(async () => {
      fireEvent.click(nodeElement);
    });

    fireEvent.contextMenu(nodeElement);
    expect(screen.getByText('Delete')).toBeDefined();

    // Test pane context menu
    fireEvent.contextMenu(screen.getByTestId('pane'));
    expect(screen.getByText('Delete')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

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

  it('handles zoom, fit view, and autofocus control panel buttons', async () => {
    await act(async () => {
      render(<App />);
    });

    const zoomInBtn = screen.getByTitle('Zoom In');
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    const fitViewBtn = screen.getByTitle('Fit View');
    const autofocusBtn = screen.getByTitle('Enable Autofocus');

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(fitViewBtn);
    fireEvent.click(autofocusBtn);

    expect(useFlowStore.getState().isAutofocusEnabled).toBe(true);
  });

  it('handles openAboutDialog Wails event listener', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(capturedEventsOnCallback).not.toBeNull();

    await act(async () => {
      capturedEventsOnCallback();
    });

    expect(await screen.findByText('Kube Simulator')).toBeInTheDocument();
  });

  it('handles role save callback from RoleModal', async () => {
    const targetNode = { id: 'n1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'my-dep', roles: [] } };
    useFlowStore.setState({
      nodes: [targetNode],
      roleModalTargetNode: { id: 'n1', label: 'my-dep' },
    });

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('Attach RBAC Role')).toBeInTheDocument();

    const saveRoleBtn = screen.getByText('Attach Role');
    await act(async () => {
      fireEvent.click(saveRoleBtn);
    });

    expect(useFlowStore.getState().roleModalTargetNode).toBeNull();
  });

  it('tests MiniMap nodeColor helper function for various node types in dark and light modes', async () => {
    const { rerender } = render(<App />);

    expect(capturedMiniMapNodeColor).not.toBeNull();

    expect(capturedMiniMapNodeColor({ type: 'Deployment' })).toBe('#8b5cf6');
    expect(capturedMiniMapNodeColor({ type: 'Pod' })).toBe('#22d3ee');
    expect(capturedMiniMapNodeColor({ type: 'Service' })).toBe('#f59e0b');
    expect(capturedMiniMapNodeColor({ type: 'Namespace' })).toBe('#475569');

    useFlowStore.setState({ colorMode: 'light' });
    await act(async () => {
      rerender(<App />);
    });

    expect(capturedMiniMapNodeColor({ type: 'Namespace' })).toBe('#94A3B8');
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

    capturedKeyboardOptions.onGroup();
    expect(groupSpy).toHaveBeenCalledWith(['n1', 'n2']);

    capturedKeyboardOptions.onUngroup();
    expect(ungroupSpy).toHaveBeenCalledWith(['n1', 'n2']);
  });
});
