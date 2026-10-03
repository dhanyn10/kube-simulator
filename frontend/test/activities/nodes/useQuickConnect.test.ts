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

    const spaceKeyEvent = { stopPropagation, key: ' ' } as any;
    act(() => {
      result.current.handleConnect('left')(spaceKeyEvent);
    });

    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'left');
  });

  it('covers light mode styling, forbidden node, and child pod hidden arrowStyle with early returns', () => {
    const mockOnQuickConnect = vi.fn();
    useFlowStore.setState({
      colorMode: 'light',
      onQuickConnect: mockOnQuickConnect,
      activeIdentity: 'system:admin',
      iamUsers: [],
      nodes: [
        { id: 'regular-node', type: 'Pod', data: {} } as any,
        { id: 'child-pod-1', parentId: 'dep-1', type: 'Pod', data: {} } as any,
      ],
    });

    // Light mode node styling
    const { result: lightResult } = renderHook(() => useQuickConnect('regular-node', 'blue'));
    expect(lightResult.current.arrowStyle).toContain('bg-blue-500/10');

    // Child pod returns hidden arrowStyle and ignores connection
    const { result: childResult } = renderHook(() => useQuickConnect('child-pod-1', 'blue'));
    expect(childResult.current.arrowStyle).toBe('hidden');

    const clickEvent = { stopPropagation: vi.fn() } as any;
    act(() => {
      childResult.current.handleConnect('top')(clickEvent);
    });
    expect(mockOnQuickConnect).not.toHaveBeenCalled();

    // Forbidden node returns hidden arrowStyle and ignores connection
    useFlowStore.setState({
      activeIdentity: 'dev-restricted',
      iamUsers: [{ id: 'u2', username: 'dev-restricted', accessType: 'Managed Access', policies: [] }],
    });
    const { result: forbiddenResult } = renderHook(() => useQuickConnect('regular-node', 'blue'));
    expect(forbiddenResult.current.arrowStyle).toBe('hidden');
    act(() => {
      forbiddenResult.current.handleConnect('bottom')(clickEvent);
    });
    expect(mockOnQuickConnect).not.toHaveBeenCalled();
  });
});
