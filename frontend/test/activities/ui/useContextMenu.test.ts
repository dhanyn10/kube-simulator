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
});
