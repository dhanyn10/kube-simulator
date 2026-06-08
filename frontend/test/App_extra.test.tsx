import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import App from '../src/App';
import { useFlowStore } from '../src/store';
import '@testing-library/jest-dom';

// Mock utils
vi.mock('../src/lib/utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/lib/utils')>();
    return {
      ...actual,
      generateYaml: vi.fn().mockResolvedValue('mock yaml content'),
    };
  });

// Mock ReactFlow
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
        <div data-testid="mock-flow" onContextMenu={onPaneContextMenu}>
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
const mockUnsubscribe = vi.fn();
vi.mock('../wailsjs/runtime', () => ({
  EventsOn: vi.fn((event, callback) => {
      if (event === 'openAboutDialog') {
          (globalThis as any).triggerAboutDialog = callback;
      }
      return mockUnsubscribe;
  }),
}));

let capturedKeyboardOptions: any = null;
vi.mock('../src/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn((options) => {
    capturedKeyboardOptions = options;
  }),
}));

vi.mock('../wailsjs/go/main/App.js', () => ({
  GetSystemResources: vi.fn().mockResolvedValue({ cpuCores: 4, totalMemoryGB: 16 }),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('App Component Extra Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    globalThis.go = {
        main: {
            App: {
                GetSetting: vi.fn().mockResolvedValue("true"),
                Undo: vi.fn(),
                Redo: vi.fn(),
                GetHistoryLogs: vi.fn().mockResolvedValue([]),
                JumpToHistory: vi.fn(),
                GetProjects: vi.fn().mockResolvedValue([]),
            }
        }
    };
    useFlowStore.setState({
      nodes: [],
      edges: [],
      colorMode: 'dark',
      isAutofocusEnabled: false,
      systemResources: { cpuCores: 8, totalMemoryGB: 32, freeMemoryGB: 16, cpuUsage: 10 },
      isRightSidebarVisible: false,
    });
  });

  it('triggers about dialog from Wails event and cleans up', async () => {
    const { unmount } = render(<App />);

    expect((globalThis as any).triggerAboutDialog).toBeDefined();

    await act(async () => {
        (globalThis as any).triggerAboutDialog();
    });

    expect(screen.getByText('Kube Simulator')).toBeInTheDocument();

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('loads settings on mount including edge colors', async () => {
    const getSettingMock = vi.fn().mockImplementation((key) => {
        if (key === 'isSidebarVisible') return Promise.resolve('false');
        if (key === 'isRightSidebarVisible') return Promise.resolve('true');
        if (key === 'globalEdgeColor') return Promise.resolve('blue');
        if (key === 'globalEdgeErrorColor') return Promise.resolve('red');
        return Promise.resolve('');
    });
    // @ts-ignore
    globalThis.go.main.App.GetSetting = getSettingMock;

    await act(async () => {
        render(<App />);
    });

    await waitFor(() => {
        expect(getSettingMock).toHaveBeenCalledWith('globalEdgeColor');
    });
  });

  it('handles pane context menu', async () => {
    await act(async () => {
        render(<App />);
    });

    const flow = screen.getByTestId('mock-flow');
    fireEvent.contextMenu(flow);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('handles node selection in context menu if not already selected', async () => {
    const node = { id: 'n1', type: 'Pod', selected: false, data: { label: 'pod-1' } } as any;
    useFlowStore.setState({ nodes: [node] });

    await act(async () => {
        render(<App />);
    });

    const nodeEl = screen.getByTestId('node-n1');
    fireEvent.contextMenu(nodeEl);

    expect(useFlowStore.getState().nodes[0].selected).toBe(true);

    // Test Delete from context menu
    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);
    expect(useFlowStore.getState().nodes.length).toBe(0);
  });

  it('handles keyboard shortcuts for Copy/Paste/Undo/Redo/Group/Ungroup', async () => {
      const copyNodesSpy = vi.spyOn(useFlowStore.getState(), 'copyNodes');
      const pasteNodesSpy = vi.spyOn(useFlowStore.getState(), 'pasteNodes');
      const groupNodesSpy = vi.spyOn(useFlowStore.getState(), 'groupNodes');
      const ungroupNodesSpy = vi.spyOn(useFlowStore.getState(), 'ungroupNodes');

      useFlowStore.setState({
          nodes: [
              { id: 'n1', selected: true, type: 'Pod', data: {} } as any,
              { id: 'n2', selected: true, type: 'Pod', data: {} } as any
          ]
      });

      await act(async () => {
          render(<App />);
      });

      act(() => {
          capturedKeyboardOptions.onCopy();
          capturedKeyboardOptions.onPaste();
          capturedKeyboardOptions.onUndo();
          capturedKeyboardOptions.onRedo();
          capturedKeyboardOptions.onGroup();
          capturedKeyboardOptions.onUngroup();
      });

      expect(copyNodesSpy).toHaveBeenCalled();
      expect(pasteNodesSpy).toHaveBeenCalled();
      expect(groupNodesSpy).toHaveBeenCalled();
      expect(ungroupNodesSpy).toHaveBeenCalled();
  });

  it('handles edge clicks and autofocus', async () => {
      const nodes = [
          { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'Pod', position: { x: 500, y: 500 }, data: {} }
      ] as any;
      const edges = [{ id: 'e1', source: 'n1', target: 'n2' }] as any;
      useFlowStore.setState({ nodes, edges, isAutofocusEnabled: true, isRightSidebarVisible: false });

      await act(async () => {
          render(<App />);
      });

      const edgeEl = screen.getByTestId('edge-e1');
      await act(async () => {
          fireEvent.click(edgeEl);
      });

      expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);
      expect(useFlowStore.getState().configuringEdgeId).toBe('e1');
  });

  it('opens resource manager from MenuBar', async () => {
      await act(async () => {
          render(<App />);
      });

      fireEvent.click(screen.getByText('Resource'));
      fireEvent.click(screen.getByText('Resource Manager'));

      expect(screen.getByText('Resource Manager')).toBeInTheDocument();
  });

  it('covers fitView in Controls panel', async () => {
      await act(async () => {
          render(<App />);
      });

      const fitViewBtn = screen.getByTitle('Fit View');
      fireEvent.click(fitViewBtn);
  });

  it('toggles autofocus from Controls panel', async () => {
      await act(async () => {
          render(<App />);
      });

      const toggleBtn = screen.getByTitle('Enable Autofocus');
      fireEvent.click(toggleBtn);
      expect(useFlowStore.getState().isAutofocusEnabled).toBe(true);
  });
});
