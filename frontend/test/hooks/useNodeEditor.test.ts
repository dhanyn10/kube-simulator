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

    expect(onRename).toHaveBeenCalledWith('new name');
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
