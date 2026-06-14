import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeStatus, useNodeContainerStyles } from '@/hooks/useNodeStatusStyles';

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
    const { result } = renderHook(() => useNodeContainerStyles(false, false, false, false, 'blue', 'light'));
    expect(result.current.containerClasses).toContain('bg-white');
    expect(result.current.containerClasses).toContain('border-slate-200');
  });

  it('returns selection classes when selected', () => {
    const { result } = renderHook(() => useNodeContainerStyles(true, false, false, false, 'blue', 'dark'));
    expect(result.current.containerClasses).toContain('border-blue-400');
    expect(result.current.containerClasses).toContain('ring-blue-400/20');
  });

  it('returns crashing classes', () => {
    const { result } = renderHook(() => useNodeContainerStyles(false, false, false, true, 'blue', 'dark'));
    expect(result.current.containerClasses).toContain('animate-crash-blink');
    expect(result.current.containerClasses).toContain('border-red-600');
  });
});
