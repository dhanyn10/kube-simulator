import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem, parseAndHydrateProject } from '@/hooks/useFileSystem';
import { useFlowStore } from '@/store';
import { setBackendGateway, resetBackendGateway, MockBackendGateway } from '@/gateway';

describe('useFileSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBackendGateway();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      currentProject: null,
      logs: [],
      isLogModalOpen: false,
    });

    // Reset Wails globals
    (globalThis as any).go = {
      main: {
        App: {
          ExportProjectFile: vi.fn().mockResolvedValue(true),
          ImportProjectFile: vi.fn().mockResolvedValue(''),
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
    expect(useFlowStore.getState().logs.some(l => l.level === 'info' && l.message.includes('unnamed-project'))).toBe(true);

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
    expect(useFlowStore.getState().logs.some(l => l.level === 'info' && l.message.includes('Alpha Project'))).toBe(true);
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
    expect(state.logs.some(l => l.level === 'info' && l.message.includes('Imported Project'))).toBe(true);
    expect(state.isLogModalOpen).toBe(false);

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
    expect(useFlowStore.getState().isLogModalOpen).toBe(false);

    // Test invalid JSON syntax: must log error and open LogModal (modal alert)
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue('{ invalid json }');

    await act(async () => {
      await result.current.handleImportFile();
    });

    expect(useFlowStore.getState().nodes).toHaveLength(0);
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.level === 'error' && l.message.includes('Failed to import architecture'))).toBe(true);
  });

  it('validates project payload structure and opens LogModal on invalid schema', async () => {
    const { result } = renderHook(() => useFileSystem([], []));

    // 1. Non-object root
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue('123');
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('root object expected'))).toBe(true);

    // 2. Missing canvas data
    useFlowStore.setState({ isLogModalOpen: false });
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(JSON.stringify({ name: 'NoCanvas' }));
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('Missing canvas data'))).toBe(true);

    // 3. Canvas nodes is not an array
    useFlowStore.setState({ isLogModalOpen: false });
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(
      JSON.stringify({ name: 'BadNodes', canvas: JSON.stringify({ nodes: 'not-array' }) })
    );
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('nodes must be an array'))).toBe(true);

    // 4. Canvas edges is not an array
    useFlowStore.setState({ isLogModalOpen: false });
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(
      JSON.stringify({ name: 'BadEdges', canvas: JSON.stringify({ edges: 999 }) })
    );
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('edges must be an array'))).toBe(true);

    // 5. Canvas node is null / non-object
    useFlowStore.setState({ isLogModalOpen: false });
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(
      JSON.stringify({ name: 'NullNode', canvas: JSON.stringify({ nodes: [null] }) })
    );
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('node must be an object'))).toBe(true);

    // 6. Canvas edge is null / non-object
    useFlowStore.setState({ isLogModalOpen: false });
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(
      JSON.stringify({ name: 'NullEdge', canvas: JSON.stringify({ edges: [null] }) })
    );
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('edge must be an object'))).toBe(true);
  });

  it('handles backend exceptions in handleImportFile and handleExportFile', async () => {
    const { result } = renderHook(() => useFileSystem([], []));

    // Import failure
    (globalThis as any).go.main.App.ImportProjectFile.mockRejectedValue(new Error('Disk read failure'));
    await act(async () => {
      await result.current.handleImportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('Disk read failure'))).toBe(true);

    // Export failure
    useFlowStore.setState({ isLogModalOpen: false });
    (globalThis as any).go.main.App.ExportProjectFile.mockRejectedValue(new Error('Permission denied'));
    await act(async () => {
      await result.current.handleExportFile();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().logs.some(l => l.message.includes('Permission denied'))).toBe(true);
  });

  it('tests parseAndHydrateProject directly with various formats', () => {
    // Empty json returns false
    expect(parseAndHydrateProject('')).toBe(false);

    // Object canvas field
    const projectWithObjectCanvas = {
      name: 'Direct Project',
      canvas: {
        nodes: [{ id: 1, type: 'Pod', data: { label: 'Direct Pod' }, position: { x: 0, y: 0 } }],
        edges: [{ id: 2, source: 1, target: 1 }],
      },
    };
    expect(parseAndHydrateProject(JSON.stringify(projectWithObjectCanvas))).toBe(true);
    expect(useFlowStore.getState().nodes).toHaveLength(1);
    expect(useFlowStore.getState().currentProject?.name).toBe('Direct Project');

    // Invalid canvas payload (number instead of string or object)
    const invalidCanvasType = {
      name: 'Invalid Type',
      canvas: 12345,
    };
    expect(parseAndHydrateProject(JSON.stringify(invalidCanvasType))).toBe(false);
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
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

  it('works with decoupled MockBackendGateway directly', async () => {
    const mockGw = new MockBackendGateway();
    const spyExport = vi.spyOn(mockGw, 'exportProjectFile');
    const spyImport = vi.spyOn(mockGw, 'importProjectFile');
    setBackendGateway(mockGw);

    const { result, unmount } = renderHook(() => useFileSystem([], []));
    await act(async () => {
      await result.current.handleExportFile();
      await result.current.handleImportFile();
    });

    expect(spyExport).toHaveBeenCalled();
    expect(spyImport).toHaveBeenCalled();
    unmount();
  });
});
