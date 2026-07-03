import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useFlowStore } from '@/store';

// Mock Wails globals
(window as any).go = {
  main: {
    App: {
      ExportProjectFile: vi.fn(),
      ImportProjectFile: vi.fn(),
    }
  }
};

(window as any).runtime = {
    EventsOn: vi.fn()
};

describe('useFileSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ nodes: [], edges: [], currentProject: null });
  });

  it('handles export file', async () => {
    const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }] as any;
    const edges = [] as any;
    const { result } = renderHook(() => useFileSystem(nodes, edges));

    await act(async () => {
      await result.current.handleExportFile();
    });

    expect((window as any).go.main.App.ExportProjectFile).toHaveBeenCalled();
  });

  it('handles import file', async () => {
    const mockProject = {
      name: 'Imported Project',
      canvas: JSON.stringify({
        nodes: [{ id: '1', type: 'Pod', data: { label: 'Imported Pod' }, position: { x: 0, y: 0 } }],
        edges: []
      })
    };
    (window as any).go.main.App.ImportProjectFile.mockResolvedValue(JSON.stringify(mockProject));

    const { result } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result.current.handleImportFile();
    });

    const state = useFlowStore.getState();
    expect(state.nodes.length).toBe(1);
    expect(state.nodes[0].data.label).toBe('Imported Pod');
    expect(state.currentProject?.name).toBe('Imported Project');
  });

  it('handles import error gracefully', async () => {
    (window as any).go.main.App.ImportProjectFile.mockResolvedValue('invalid json');
    const { result } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result.current.handleImportFile();
    });

    // Should not crash, nodes should remain empty
    expect(useFlowStore.getState().nodes.length).toBe(0);
  });

  it('listens for open-infra-file events', async () => {
    let eventCallback: any;
    (window as any).runtime.EventsOn.mockImplementation((event: string, cb: any) => {
        if (event === 'open-infra-file') {
            eventCallback = cb;
        }
        return vi.fn(); // off function
    });

    renderHook(() => useFileSystem([], []));
    expect((window as any).runtime.EventsOn).toHaveBeenCalledWith('open-infra-file', expect.any(Function));

    const mockProject = {
      name: 'External Project',
      canvas: JSON.stringify({
        nodes: [{ id: '2', type: 'Pod', data: { label: 'External Pod' }, position: { x: 10, y: 10 } }],
        edges: []
      })
    };

    act(() => {
        eventCallback(JSON.stringify(mockProject));
    });

    const state = useFlowStore.getState();
    expect(state.nodes.length).toBe(1);
    expect(state.nodes[0].data.label).toBe('External Pod');
    expect(state.currentProject?.name).toBe('External Project');
  });

  it('handles external file open error gracefully', async () => {
    let eventCallback: any;
    (window as any).runtime.EventsOn.mockImplementation((event: string, cb: any) => {
        if (event === 'open-infra-file') {
            eventCallback = cb;
        }
        return vi.fn();
    });

    renderHook(() => useFileSystem([], []));

    act(() => {
        eventCallback('invalid json');
    });

    expect(useFlowStore.getState().nodes.length).toBe(0);
  });
});
