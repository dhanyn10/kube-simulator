import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenuHandler } from '@/activities/ui/useContextMenu';
import { useFlowStore } from '@/store';

describe('useContextMenuHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      clipboard: null,
      colorMode: 'dark',
    });
  });

  it('useContextMenuHandler computes node selection, log viewing, paste capability, and keyboard navigation', () => {
    const onClose = vi.fn();
    useFlowStore.setState({
      nodes: [
        { id: 'p1', type: 'Pod', selected: true, data: {} },
        { id: 'p2', type: 'Pod', selected: true, data: { groupId: 'g1' } },
      ] as any,
      clipboard: { nodes: [{ id: 'clip1', type: 'Pod' }] } as any,
    });

    const { result } = renderHook(() => useContextMenuHandler({ onClose }));

    expect(result.current.hasSelection).toBe(true);
    expect(result.current.canGroup).toBe(true);
    expect(result.current.isGrouped).toBe(true);
    expect(result.current.canPaste).toBe(true);

    const mockKeyDownEvent = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      key: 'Escape',
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleMenuKeyDown(mockKeyDownEvent);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('handles singleNode canViewLogs evaluation and invalid/empty clipboard objects', () => {
    const onClose = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 's1', type: 'Service', selected: true, data: {} }] as any,
      clipboard: { nodes: [{ id: 'clip1' }] } as any, // missing type
    });

    const { result, rerender } = renderHook(() => useContextMenuHandler({ onClose }));

    expect(result.current.singleNode).toEqual({ id: 's1', type: 'Service', selected: true, data: {} });
    expect(result.current.canViewLogs).toBe(false);
    expect(result.current.canPaste).toBe(false);

    // Update node to Deployment
    useFlowStore.setState({
      nodes: [{ id: 'd1', type: 'Deployment', selected: true, data: {} }] as any,
      clipboard: null,
    });
    rerender();

    expect(result.current.canViewLogs).toBe(true);
    expect(result.current.canPaste).toBe(false);

    // Update node to ReplicaSet
    useFlowStore.setState({
      nodes: [{ id: 'rs1', type: 'ReplicaSet', selected: true, data: {} }] as any,
    });
    rerender();
    expect(result.current.canViewLogs).toBe(true);

    // Update node to Pod
    useFlowStore.setState({
      nodes: [{ id: 'pod1', type: 'Pod', selected: true, data: {} }] as any,
    });
    rerender();
    expect(result.current.canViewLogs).toBe(true);
  });

  it('handles keyboard navigation for ArrowDown, ArrowUp, and Tab keys with menuRef element', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useContextMenuHandler({ onClose }));

    const container = document.createElement('div');
    const item1 = document.createElement('button');
    item1.setAttribute('role', 'menuitem');
    const item2 = document.createElement('button');
    item2.setAttribute('role', 'menuitem');
    container.appendChild(item1);
    container.appendChild(item2);
    document.body.appendChild(container);

    (result.current.menuRef as any).current = container;
    item1.focus();

    const mockEvent = (key: string) =>
      ({
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
        key,
      } as unknown as React.KeyboardEvent);

    act(() => {
      result.current.handleMenuKeyDown(mockEvent('ArrowDown'));
    });
    expect(document.activeElement).toBe(item2);

    act(() => {
      result.current.handleMenuKeyDown(mockEvent('ArrowUp'));
    });
    expect(document.activeElement).toBe(item1);

    act(() => {
      result.current.handleMenuKeyDown(mockEvent('Tab'));
    });

    expect(onClose).toHaveBeenCalledOnce();

    // Key press that is neither ArrowUp/ArrowDown nor Escape/Tab (e.g. Enter or letter key)
    const otherKeyEvent = mockEvent('Enter');
    act(() => {
      result.current.handleMenuKeyDown(otherKeyEvent);
    });
    expect(otherKeyEvent.stopPropagation).toHaveBeenCalled();
    expect(otherKeyEvent.preventDefault).not.toHaveBeenCalled();

    document.body.removeChild(container);
  });
});
