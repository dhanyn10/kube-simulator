import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuBarDropdown } from '@/activities/menubar/useMenuBarDropdown';

describe('useMenuBarDropdown', () => {
  const defaultProps = {
    menu: {
      label: 'View',
      items: [
        { label: 'Item 1', onClick: vi.fn() },
        { label: 'Toggle 1', onClick: vi.fn(), checked: true },
      ],
    },
    activeMenu: 'View',
    setActiveMenu: vi.fn(),
    colorMode: 'dark' as const,
    onMenuClick: vi.fn(),
  };

  it('computes isOpen, isDark, and hasIconsOrChecks correctly', () => {
    const { result } = renderHook(() => useMenuBarDropdown(defaultProps));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isDark).toBe(true);
    expect(result.current.hasIconsOrChecks).toBe(true);
  });

  it('handles header click', () => {
    const setActiveMenu = vi.fn();
    const onMenuClick = vi.fn();
    const { result } = renderHook(() =>
      useMenuBarDropdown({
        ...defaultProps,
        activeMenu: null,
        setActiveMenu,
        onMenuClick,
      })
    );

    act(() => {
      result.current.handleHeaderClick();
    });

    expect(onMenuClick).toHaveBeenCalledWith('View');
    expect(setActiveMenu).toHaveBeenCalledWith('View');
  });

  it('handles mouse enter when another menu is active and not File', () => {
    const setActiveMenu = vi.fn();
    const { result } = renderHook(() =>
      useMenuBarDropdown({
        ...defaultProps,
        activeMenu: 'Edit',
        setActiveMenu,
      })
    );

    act(() => {
      result.current.handleMouseEnter();
    });

    expect(setActiveMenu).toHaveBeenCalledWith('View');
  });

  it('does not trigger mouse enter when menu label is File', () => {
    const setActiveMenu = vi.fn();
    const { result } = renderHook(() =>
      useMenuBarDropdown({
        ...defaultProps,
        menu: { label: 'File', items: [] },
        activeMenu: 'Edit',
        setActiveMenu,
      })
    );

    act(() => {
      result.current.handleMouseEnter();
    });

    expect(setActiveMenu).not.toHaveBeenCalled();
  });

  it('handles item click for non-toggle item and closes menu', () => {
    const setActiveMenu = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() =>
      useMenuBarDropdown({
        ...defaultProps,
        setActiveMenu,
      })
    );

    act(() => {
      result.current.handleItemClick({ label: 'Plain item', onClick });
    });

    expect(onClick).toHaveBeenCalled();
    expect(setActiveMenu).toHaveBeenCalledWith(null);
  });

  it('handles item click for toggle item and does NOT close menu', () => {
    const setActiveMenu = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() =>
      useMenuBarDropdown({
        ...defaultProps,
        setActiveMenu,
      })
    );

    act(() => {
      result.current.handleItemClick({ label: 'Toggle item', onClick, checked: false });
    });

    expect(onClick).toHaveBeenCalled();
    expect(setActiveMenu).not.toHaveBeenCalledWith(null);
  });
});
