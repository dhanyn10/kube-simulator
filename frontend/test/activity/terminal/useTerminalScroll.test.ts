import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTerminalScroll } from '../../../src/activity/terminal/useTerminalScroll';

describe('useTerminalScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles performScroll when contentAreaRef is null or present', () => {
    const { result } = renderHook(() =>
      useTerminalScroll(true, 'activity', 1, 1, ['log 1'])
    );

    // Initial state check
    expect(result.current.isAutoscroll).toBe(true);

    // Call handleScroll when contentAreaRef is null (should return early)
    act(() => {
      result.current.handleScroll();
    });

    // Toggle autoscroll on when contentAreaRef is null
    act(() => {
      result.current.handleToggleAutoscroll(true);
    });
    expect(result.current.isAutoscroll).toBe(true);

    // Toggle autoscroll off
    act(() => {
      result.current.handleToggleAutoscroll(false);
    });
    expect(result.current.isAutoscroll).toBe(false);
  });

  it('performs scroll when terminalEndRef is provided and handles timer timeout', () => {
    const { result } = renderHook(() =>
      useTerminalScroll(true, 'activity', 1, 1, ['log 1'])
    );

    const mockContentEl = document.createElement('div');
    Object.defineProperty(mockContentEl, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(mockContentEl, 'scrollTop', { value: 0, configurable: true });
    Object.defineProperty(mockContentEl, 'clientHeight', { value: 200, configurable: true });

    const mockEndEl = document.createElement('div');
    const scrollIntoViewMock = vi.fn();
    mockEndEl.scrollIntoView = scrollIntoViewMock;

    // Attach refs
    (result.current.contentAreaRef as any).current = mockContentEl;
    (result.current.terminalEndRef as any).current = mockEndEl;

    // Trigger toggle autoscroll (instant scroll)
    act(() => {
      result.current.handleToggleAutoscroll(true);
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto' });

    // Advance fake timers to execute programmatic scroll timeout (100ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });
  });

  it('performs scroll using el.scrollTo when terminalEndRef is null', () => {
    const { result } = renderHook(() =>
      useTerminalScroll(true, 'logs', 1, 1, ['log 1'])
    );

    const mockContentEl = document.createElement('div');
    Object.defineProperty(mockContentEl, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(mockContentEl, 'scrollTop', { value: 0, configurable: true });
    Object.defineProperty(mockContentEl, 'clientHeight', { value: 200, configurable: true });
    const scrollToMock = vi.fn();
    mockContentEl.scrollTo = scrollToMock;

    (result.current.contentAreaRef as any).current = mockContentEl;
    (result.current.terminalEndRef as any).current = null;

    act(() => {
      result.current.handleToggleAutoscroll(true);
    });

    expect(scrollToMock).toHaveBeenCalledWith({ top: 500, behavior: 'auto' });

    act(() => {
      vi.advanceTimersByTime(650);
    });
  });

  it('handles user scroll behavior and turns off autoscroll when not at bottom', () => {
    const { result } = renderHook(() =>
      useTerminalScroll(true, 'activity', 1, 1, ['log 1'])
    );

    const mockContentEl = document.createElement('div');
    Object.defineProperty(mockContentEl, 'scrollHeight', { value: 500, configurable: true });
    let currentScrollTop = 0; // Not at bottom (500 - 0 - 200 = 300 > 15)
    Object.defineProperty(mockContentEl, 'scrollTop', {
      get: () => currentScrollTop,
      configurable: true,
    });
    Object.defineProperty(mockContentEl, 'clientHeight', { value: 200, configurable: true });

    (result.current.contentAreaRef as any).current = mockContentEl;

    // Fast-forward programmatic scroll timeout so isProgrammaticScrollRef becomes false
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // User scrolls when not at bottom -> autoscroll disabled
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAutoscroll).toBe(false);

    // Call handleScroll again when not at bottom and autoscroll is ALREADY false
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAutoscroll).toBe(false);

    // Re-enable autoscroll
    act(() => {
      result.current.handleToggleAutoscroll(true);
    });
    expect(result.current.isAutoscroll).toBe(true);

    // Scroll when at bottom (500 - 490 - 200 = 10 <= 15) -> autoscroll remains enabled
    currentScrollTop = 490;
    act(() => {
      result.current.handleScroll();
    });
    expect(result.current.isAutoscroll).toBe(true);
  });

  it('handles scroll event during programmatic scroll when at bottom vs not at bottom', () => {
    const { result } = renderHook(() =>
      useTerminalScroll(true, 'activity', 1, 1, ['log 1'])
    );

    const mockContentEl = document.createElement('div');
    let currentScrollTop = 0;
    Object.defineProperty(mockContentEl, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(mockContentEl, 'scrollTop', {
      get: () => currentScrollTop,
      configurable: true,
    });
    Object.defineProperty(mockContentEl, 'clientHeight', { value: 200, configurable: true });

    (result.current.contentAreaRef as any).current = mockContentEl;

    // Trigger toggle to set isProgrammaticScrollRef = true
    act(() => {
      result.current.handleToggleAutoscroll(true);
    });

    // While programmatic scroll is active, user scrolls but is NOT at bottom
    act(() => {
      result.current.handleScroll();
    });

    // While programmatic scroll is active, scroll hits bottom (isAtBottom = true)
    currentScrollTop = 490;
    act(() => {
      result.current.handleScroll();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });

  it('effect respects page number matching in logs tab', () => {
    const { rerender } = renderHook(
      ({ currentPage, totalPages, isTerminalOpen, activeTab }) =>
        useTerminalScroll(isTerminalOpen, activeTab, currentPage, totalPages, ['log 1']),
      {
        initialProps: {
          currentPage: 1,
          totalPages: 5,
          isTerminalOpen: true,
          activeTab: 'logs' as const,
        },
      }
    );

    rerender({
      currentPage: 5,
      totalPages: 5,
      isTerminalOpen: true,
      activeTab: 'logs',
    });

    rerender({
      currentPage: 5,
      totalPages: 5,
      isTerminalOpen: false,
      activeTab: 'logs',
    });
  });
});
