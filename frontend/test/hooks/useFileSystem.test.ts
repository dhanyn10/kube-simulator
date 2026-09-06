import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useFlowStore } from '@/store';

describe('useFileSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ nodes: [], edges: [], currentProject: null });

    // Reset Wails globals
    (globalThis as any).go = {
      main: {
        App: {
          ExportProjectFile: vi.fn(),
          ImportProjectFile: vi.fn(),
        }
      }
    };

    (globalThis as any).runtime = {
      EventsOn: vi.fn()
    };
  });

  it('handles export file with named project vs unnamed project fallback', async () => {
    const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }] as any;
    const edges = [] as any;

    // Test with unnamed project
    const { result, unmount } = renderHook(() => useFileSystem(nodes, edges));

    await act(async () => {
      await result.current.handleExportFile();
    });

    expect((globalThis as any).go.main.App.ExportProjectFile).toHaveBeenCalledWith(
      'unnamed-project',
      expect.any(String),
      expect.any(String)
    );

    unmount();

    // Test with named project
    useFlowStore.setState({ currentProject: { id: 5, name: 'Alpha Project' } });
    const { result: result2 } = renderHook(() => useFileSystem(nodes, edges));

    await act(async () => {
      await result2.current.handleExportFile();
    });

    expect((globalThis as any).go.main.App.ExportProjectFile).toHaveBeenCalledWith(
      'Alpha Project',
      expect.any(String),
      expect.any(String)
    );
  });

  it('handles export and import when Wails App API methods are undefined', async () => {
    (globalThis as any).go = {};

    const { result } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result.current.handleExportFile();
      await result.current.handleImportFile();
    });

    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });

  it('handles import file with parentId, edges, and nullish nodes/edges fallbacks', async () => {
    const mockProject = {
      name: 'Imported Project',
      canvas: JSON.stringify({
        nodes: [
          { id: 10, type: 'Pod', parentId: 20, data: { label: 'Child Pod' }, position: { x: 0, y: 0 } },
          { id: 20, type: 'Namespace', data: { label: 'ns-1' }, position: { x: 0, y: 0 } }
        ],
        edges: [
          { id: 100, source: 10, target: 20 }
        ]
      })
    };
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(JSON.stringify(mockProject));

    const { result, unmount } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result.current.handleImportFile();
    });

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0].parentId).toBe('20');
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0].id).toBe('100');

    unmount();

    // Test import with missing canvas nodes and edges
    const emptyCanvasProject = {
      name: 'Empty Canvas Project',
      canvas: JSON.stringify({})
    };
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(JSON.stringify(emptyCanvasProject));

    const { result: result2 } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result2.current.handleImportFile();
    });

    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });

  it('handles import error and empty json string gracefully', async () => {
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue('');
    const { result } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result.current.handleImportFile();
    });

    expect(useFlowStore.getState().nodes).toHaveLength(0);

    // Test invalid JSON syntax
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue('{ invalid json }');

    await act(async () => {
      await result.current.handleImportFile();
    });

    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });

  it('listens for open-infra-file events and handles cleanup when runtime is missing or returns non-function', async () => {
    // When runtime is undefined
    (globalThis as any).runtime = undefined;
    const { unmount: unmount1 } = renderHook(() => useFileSystem([], []));
    unmount1();

    // When runtime.EventsOn returns undefined or cleanup function
    let eventCallback: any;
    const cleanupFn = vi.fn();
    (globalThis as any).runtime = {
      EventsOn: vi.fn((event: string, cb: any) => {
        if (event === 'open-infra-file') {
          eventCallback = cb;
        }
        return cleanupFn;
      })
    };

    const { unmount: unmount2 } = renderHook(() => useFileSystem([], []));
    expect((globalThis as any).runtime.EventsOn).toHaveBeenCalledWith('open-infra-file', expect.any(Function));

    const mockProject = {
      name: 'External Project',
      canvas: JSON.stringify({
        nodes: [{ id: 2, type: 'Pod', data: { label: 'External Pod' }, position: { x: 10, y: 10 } }],
      })
    };

    act(() => {
      eventCallback(JSON.stringify(mockProject));
    });

    expect(useFlowStore.getState().nodes).toHaveLength(1);

    unmount2();
    expect(cleanupFn).toHaveBeenCalled();
  });
});
