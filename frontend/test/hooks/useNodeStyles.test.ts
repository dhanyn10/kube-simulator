import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeStyles } from '@/hooks/useNodeStyles';
import { useFlowStore } from '@/store';

describe('useNodeStyles', () => {
  it('returns default styles when no node is dragged', () => {
    useFlowStore.setState({ draggedNodeId: null });
    const { result } = renderHook(() => useNodeStyles('node-1'));

    expect(result.current.isSelfDragged).toBe(false);
    expect(result.current.isAnyNodeDragged).toBe(false);
    expect(result.current.transitionClasses).toContain('transition-none');
  });

  it('identifies when self is dragged', () => {
    useFlowStore.setState({ draggedNodeId: 'node-1' });
    const { result } = renderHook(() => useNodeStyles('node-1'));

    expect(result.current.isSelfDragged).toBe(true);
    expect(result.current.isAnyNodeDragged).toBe(true);
    expect(result.current.transitionClasses).toContain('transition-none');
  });

  it('returns transition classes when another node is dragged', () => {
    useFlowStore.setState({ draggedNodeId: 'node-2' });
    const { result } = renderHook(() => useNodeStyles('node-1'));

    expect(result.current.isSelfDragged).toBe(false);
    expect(result.current.isAnyNodeDragged).toBe(true);
    expect(result.current.transitionClasses).toContain('transition-[transform,left,top,width,height]');
    expect(result.current.transitionClasses).toContain('duration-300');
  });
});
