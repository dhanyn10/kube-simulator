import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { SidebarContextMenu, useSidebarContextMenu } from '../../../src/components/UI/SidebarContextMenu';

describe('SidebarContextMenu', () => {
  it('calls onCloseSidebar when onCloseSidebar prop is provided and close button is clicked', () => {
    const toggleColorMode = vi.fn();
    const onCloseSidebar = vi.fn();
    const onCloseContextMenu = vi.fn();

    render(
      <SidebarContextMenu
        x={100}
        y={200}
        colorMode="dark"
        toggleColorMode={toggleColorMode}
        onCloseSidebar={onCloseSidebar}
        onCloseContextMenu={onCloseContextMenu}
      />
    );

    const changeThemeBtn = screen.getByText('Change Theme');
    fireEvent.click(changeThemeBtn);
    expect(toggleColorMode).toHaveBeenCalled();
    expect(onCloseContextMenu).toHaveBeenCalled();

    const closeBtn = screen.getByText('Exit');
    fireEvent.click(closeBtn);
    expect(onCloseSidebar).toHaveBeenCalled();
  });

  it('handles Exit button click when onCloseSidebar is omitted and in light mode', () => {
    const onCloseContextMenu = vi.fn();

    render(
      <SidebarContextMenu
        x={100}
        y={200}
        colorMode="light"
        toggleColorMode={vi.fn()}
        onCloseContextMenu={onCloseContextMenu}
      />
    );

    const closeBtn = screen.getByText('Exit');
    fireEvent.click(closeBtn);
    expect(onCloseContextMenu).toHaveBeenCalled();
  });

  it('tests useSidebarContextMenu hook functions', () => {
    const { result } = renderHook(() => useSidebarContextMenu());
    expect(result.current.contextMenu).toBeNull();

    act(() => {
      result.current.handleContextMenu({ preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 50, clientY: 60 } as any);
    });
    expect(result.current.contextMenu).toEqual({ x: 50, y: 60 });

    act(() => {
      result.current.closeContextMenu();
    });
    expect(result.current.contextMenu).toBeNull();
  });
});
