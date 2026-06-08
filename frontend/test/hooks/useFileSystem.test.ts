import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem } from '../../src/hooks/useFileSystem';
import { useFlowStore } from '../../src/store';

// Mock Wails globals
(globalThis as any).go = {
  main: {
    App: {
      ExportProjectFile: vi.fn(),
      ImportProjectFile: vi.fn(),
    }
  }
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

    expect((globalThis as any).go.main.App.ExportProjectFile).toHaveBeenCalled();
  });

  it('handles import file', async () => {
    const mockProject = {
      name: 'Imported Project',
      canvas: JSON.stringify({
        nodes: [{ id: '1', type: 'Pod', data: { label: 'Imported Pod' }, position: { x: 0, y: 0 } }],
        edges: []
      })
    };
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue(JSON.stringify(mockProject));

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
    (globalThis as any).go.main.App.ImportProjectFile.mockResolvedValue('invalid json');
    const { result } = renderHook(() => useFileSystem([], []));

    await act(async () => {
      await result.current.handleImportFile();
    });

    // Should not crash, nodes should remain empty
    expect(useFlowStore.getState().nodes.length).toBe(0);
  });
});
