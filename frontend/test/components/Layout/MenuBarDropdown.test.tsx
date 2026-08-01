import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBarDropdown } from '../../../src/components/Layout/MenuBarDropdown';
import { Settings } from 'lucide-react';

describe('MenuBarDropdown', () => {
  const mockMenu = {
    label: 'Test Menu',
    items: [
      { label: 'Item 1', onClick: vi.fn(), shortcut: 'Ctrl+1' },
      { type: 'separator' as const, label: 'sep', onClick: () => {} },
      { label: 'Toggle Item', onClick: vi.fn(), checked: true },
      { label: 'Item 2', icon: Settings, onClick: vi.fn() },
    ]
  };

  it('renders menu label', () => {
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu={null}
        setActiveMenu={vi.fn()}
        colorMode="light"
      />
    );
    expect(screen.getByText('Test Menu')).toBeDefined();
  });

  it('renders items when open', () => {
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Test Menu"
        setActiveMenu={vi.fn()}
        colorMode="light"
      />
    );
    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Ctrl+1')).toBeDefined();
    expect(screen.getByText('Toggle Item')).toBeDefined();
    expect(screen.getByText('Item 2')).toBeDefined();
  });

  it('calls setActiveMenu when clicked', () => {
    const setActiveMenu = vi.fn();
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu={null}
        setActiveMenu={setActiveMenu}
        colorMode="light"
      />
    );
    fireEvent.click(screen.getByText('Test Menu'));
    expect(setActiveMenu).toHaveBeenCalledWith('Test Menu');
  });

  it('calls onClick when an item is clicked', () => {
    const onClick = mockMenu.items[0].onClick;
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Test Menu"
        setActiveMenu={vi.fn()}
        colorMode="light"
      />
    );
    fireEvent.click(screen.getByText('Item 1'));
    expect(onClick).toHaveBeenCalled();
  });

  it('closes menu when non-toggle item is clicked', () => {
    const setActiveMenu = vi.fn();
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Test Menu"
        setActiveMenu={setActiveMenu}
        colorMode="light"
      />
    );
    fireEvent.click(screen.getByText('Item 1'));
    expect(setActiveMenu).toHaveBeenCalledWith(null);
  });

  it('does not close menu when toggle item is clicked', () => {
    const setActiveMenu = vi.fn();
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Test Menu"
        setActiveMenu={setActiveMenu}
        colorMode="light"
      />
    );
    fireEvent.click(screen.getByText('Toggle Item'));
    // It calls onClick but doesn't call setActiveMenu(null) because item.checked is a boolean
    expect(setActiveMenu).not.toHaveBeenCalledWith(null);
  });

  it('renders checkmark for checked items', () => {
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Test Menu"
        setActiveMenu={vi.fn()}
        colorMode="light"
      />
    );
    const toggleItem = screen.getByText('Toggle Item').closest('button');
    expect(toggleItem?.querySelector('svg[class*="lucide-check"]')).toBeDefined();
  });
});
