import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeRename, useNodeResize } from '@/hooks/useNodeEditor';
import { useFlowStore } from '@/store';

describe('useNodeRename', () => {
  it('initializes correctly', () => {
    const { result } = renderHook(() => useNodeRename('initial'));
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editValue).toBe('initial');
  });

  it('handles rename on Enter key', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useNodeRename('initial', onRename));

    act(() => {
      result.current.setIsEditing(true);
      result.current.setEditValue('new name');
    });

    act(() => {
      result.current.onKeyDown({ key: 'Enter' } as any);
    });

    expect(onRename).toHaveBeenCalledWith('new-name');
    expect(result.current.isEditing).toBe(false);
  });

  it('resets on Escape key', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useNodeRename('initial', onRename));

    act(() => {
      result.current.setIsEditing(true);
      result.current.setEditValue('changed');
    });

    act(() => {
      result.current.onKeyDown({ key: 'Escape' } as any);
    });

    expect(onRename).not.toHaveBeenCalled();
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editValue).toBe('initial');
  });

  it('resets if name is empty', () => {
    const onRename = vi.fn();
    const { result } = renderHook(() => useNodeRename('initial', onRename));

    act(() => {
      result.current.setIsEditing(true);
      result.current.setEditValue('   ');
    });

    act(() => {
      result.current.handleRename();
    });

    expect(onRename).not.toHaveBeenCalled();
    expect(result.current.editValue).toBe('initial');
  });

  it('handles rename without onRename callback and ignores keydown for other keys', () => {
    const { result } = renderHook(() => useNodeRename('initial'));

    act(() => {
      result.current.setIsEditing(true);
      result.current.setEditValue('valid-name');
    });

    act(() => {
      result.current.onKeyDown({ key: 'Tab' } as any);
    });

    expect(result.current.isEditing).toBe(true);

    act(() => {
      result.current.handleRename();
    });

    expect(result.current.isEditing).toBe(false);
  });

  describe('duplicate name validation in useNodeRename', () => {
    beforeEach(() => {
      useFlowStore.setState({
        nodes: [
          { id: 'ns-1', type: 'Namespace', position: { x: 0, y: 0 }, data: { label: 'default' } },
          { id: 'ns-2', type: 'Namespace', position: { x: 0, y: 0 }, data: { label: 'kube-system' } },
          { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', position: { x: 0, y: 0 }, data: { label: 'web' } },
          { id: 'dep-2', type: 'Deployment', parentId: 'ns-1', position: { x: 0, y: 0 }, data: { label: 'api' } },
          { id: 'pod-1', type: 'Pod', parentId: 'ns-1', position: { x: 0, y: 0 }, data: { label: 'redis', baseName: 'redis' } },
        ] as any,
      });
    });

    it('detects duplicate name for resources and shows "Name already exists"', () => {
      const onRename = vi.fn();
      const { result } = renderHook(() =>
        useNodeRename('web', onRename, { nodeId: 'dep-1', type: 'Deployment', parentId: 'ns-1' })
      );

      act(() => {
        result.current.setIsEditing(true);
        result.current.setEditValue('api');
      });

      expect(result.current.isDuplicate).toBe(true);
      expect(result.current.errorMessage).toBe('Name already exists');

      act(() => {
        result.current.handleRename();
      });

      expect(onRename).not.toHaveBeenCalled();
      expect(result.current.isEditing).toBe(true);
    });

    it('detects duplicate namespace and shows "Namespace already exists"', () => {
      const onRename = vi.fn();
      const { result } = renderHook(() =>
        useNodeRename('default', onRename, { nodeId: 'ns-1', type: 'Namespace' })
      );

      act(() => {
        result.current.setIsEditing(true);
        result.current.setEditValue('kube-system');
      });

      expect(result.current.isDuplicate).toBe(true);
      expect(result.current.errorMessage).toBe('Namespace already exists');

      act(() => {
        result.current.onKeyDown({ key: 'Enter' } as any);
      });

      expect(onRename).not.toHaveBeenCalled();
      expect(result.current.isEditing).toBe(true);
    });

    it('clears error when typing a unique name and allows rename', () => {
      const onRename = vi.fn();
      const { result } = renderHook(() =>
        useNodeRename('web', onRename, { nodeId: 'dep-1', type: 'Deployment', parentId: 'ns-1' })
      );

      act(() => {
        result.current.setIsEditing(true);
        result.current.setEditValue('web-unique');
      });

      expect(result.current.isDuplicate).toBe(false);
      expect(result.current.errorMessage).toBe('');

      act(() => {
        result.current.onKeyDown({ key: 'Enter' } as any);
      });

      expect(onRename).toHaveBeenCalledWith('web-unique');
      expect(result.current.isEditing).toBe(false);
    });

    it('allows typing its own existing label without error', () => {
      const onRename = vi.fn();
      const { result } = renderHook(() =>
        useNodeRename('web', onRename, { nodeId: 'dep-1', type: 'Deployment', parentId: 'ns-1' })
      );

      act(() => {
        result.current.setIsEditing(true);
        result.current.setEditValue('web');
      });

      expect(result.current.isDuplicate).toBe(false);
      expect(result.current.errorMessage).toBe('');
    });
  });
});

describe('useNodeResize', () => {
  beforeEach(() => {
    useFlowStore.setState({
      onNodeResize: vi.fn(),
      onNodeResizeStop: vi.fn()
    });
  });

  it('calls store onNodeResize', () => {
    const onNodeResize = vi.fn();
    useFlowStore.setState({ onNodeResize });

    const { result } = renderHook(() => useNodeResize('id1', 'Namespace'));

    act(() => {
      result.current.handleNodeResize({}, { width: 100, height: 100 });
    });

    expect(onNodeResize).toHaveBeenCalledWith({}, { id: 'id1', type: 'Namespace', width: 100, height: 100 });
  });

  it('calls store onNodeResizeStop', () => {
    const onNodeResizeStop = vi.fn();
    useFlowStore.setState({ onNodeResizeStop });

    const { result } = renderHook(() => useNodeResize('id1', 'Namespace'));

    act(() => {
      result.current.handleNodeResizeStop({}, { width: 100, height: 100 });
    });

    expect(onNodeResizeStop).toHaveBeenCalledWith({}, { id: 'id1', width: 100, height: 100 });
  });
});
