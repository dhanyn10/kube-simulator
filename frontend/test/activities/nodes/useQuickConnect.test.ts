import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuickConnect } from '@/activities/nodes/useQuickConnect';
import { useFlowStore } from '@/store';

describe('useQuickConnect', () => {
  it('triggers onQuickConnect on enter key or mouse click', () => {
    const mockOnQuickConnect = vi.fn();
    useFlowStore.setState({
      colorMode: 'dark',
      onQuickConnect: mockOnQuickConnect,
    });

    const { result } = renderHook(() => useQuickConnect('node-1', 'blue'));

    expect(result.current.arrowStyle).toContain('bg-blue-500/20');

    const stopPropagation = vi.fn();
    const clickEvent = { stopPropagation } as any;

    act(() => {
      result.current.handleConnect('top')(clickEvent);
    });

    expect(stopPropagation).toHaveBeenCalled();
    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'top');

    const ignoreKeyEvent = { stopPropagation, key: 'Escape' } as any;
    act(() => {
      result.current.handleConnect('bottom')(ignoreKeyEvent);
    });

    const enterKeyEvent = { stopPropagation, key: 'Enter' } as any;
    act(() => {
      result.current.handleConnect('right')(enterKeyEvent);
    });

    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'right');
  });
});
