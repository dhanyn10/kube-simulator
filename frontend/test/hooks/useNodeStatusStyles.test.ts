import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeStatus, useNodeContainerStyles, getRoleDragClasses } from '@/hooks/useNodeStatusStyles';

describe('useNodeStatus', () => {
  it('identifies ready status for pods', () => {
    const data = { type: 'Pod', status: 'ready' } as any;
    const { result } = renderHook(() => useNodeStatus(data, undefined, 'cyan', 'dark'));

    expect(result.current.isReady).toBe(true);
    expect(result.current.isPending).toBe(false);
    expect(result.current.statusTextColor).toBe('text-emerald-500');
  });

  it('identifies pending status for pods', () => {
    const data = { type: 'Pod', status: 'pending' } as any;
    const { result } = renderHook(() => useNodeStatus(data, undefined, 'cyan', 'dark'));

    expect(result.current.isPending).toBe(true);
    expect(result.current.statusTextColor).toBe('text-red-500');
  });

  it('identifies crashing status', () => {
    const data = { type: 'Pod', status: 'crashing' } as any;
    const { result } = renderHook(() => useNodeStatus(data, undefined, 'cyan', 'dark'));

    expect(result.current.isCrashing).toBe(true);
    expect(result.current.statusDotColor).toContain('animate-ping');
  });

  it('uses default colors for normal nodes', () => {
    const data = { type: 'Service' } as any;
    const { result } = renderHook(() => useNodeStatus(data, undefined, 'amber', 'light'));

    expect(result.current.statusTextColor).toBe('text-amber-600');
  });
});

describe('useNodeContainerStyles', () => {
  it('returns base classes for light mode', () => {
    const { result } = renderHook(() => useNodeContainerStyles({
      selected: false,
      isReady: false,
      isPending: false,
      isCrashing: false,
      color: 'blue',
      colorMode: 'light'
    }));
    expect(result.current.containerClasses).toContain('bg-white');
    expect(result.current.containerClasses).toContain('border-slate-200');
  });

  it('returns selection classes when selected in dark vs light modes', () => {
    const { result: darkResult } = renderHook(() => useNodeContainerStyles({
      selected: true,
      isReady: false,
      isPending: false,
      isCrashing: false,
      color: 'blue',
      colorMode: 'dark'
    }));
    expect(darkResult.current.containerClasses).toContain('border-blue-400');
    expect(darkResult.current.containerClasses).toContain('ring-blue-400/20');

    const { result: lightResult } = renderHook(() => useNodeContainerStyles({
      selected: true,
      isReady: false,
      isPending: false,
      isCrashing: false,
      color: 'blue',
      colorMode: 'light'
    }));
    expect(lightResult.current.containerClasses).toContain('border-blue-500');
    expect(lightResult.current.containerClasses).toContain('shadow-lg');
  });

  it('returns crashing classes', () => {
    const { result } = renderHook(() => useNodeContainerStyles({
      selected: false,
      isReady: false,
      isPending: false,
      isCrashing: true,
      color: 'blue',
      colorMode: 'dark'
    }));
    expect(result.current.containerClasses).toContain('animate-crash-blink');
    expect(result.current.containerClasses).toContain('border-red-600');
  });

  it('getRoleDragClasses returns role drag classes for compatible, incompatible, and hovered targets', () => {
    expect(getRoleDragClasses(false, 'Pod', true)).toBe('');
    expect(getRoleDragClasses(true, 'Internet', true)).toBe('role-drag-outside-ns');
    expect(getRoleDragClasses(true, 'Pod', true)).toBe('role-drag-inside-ns');
    expect(getRoleDragClasses(true, 'Pod', false)).toBe('');
  });
});
