import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBarDropdown } from '@/components/Layout/MenuBarDropdown';
import { Settings } from 'lucide-react';

describe('MenuBarDropdown', () => {
  const mockMenu = {
    label: 'Test Menu',
    items: [
      { label: 'Item 1', onClick: vi.fn(), shortcut: 'Ctrl+1' },
      { type: 'separator' as const, label: '', onClick: () => {} },
      { label: 'Toggle Item', onClick: vi.fn(), checked: true },
      { label: 'Item 2', icon: Settings, onClick: vi.fn() },
    ]
  };

  it('renders menu label in dark and light modes', () => {
    const { rerender } = render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu={null}
        setActiveMenu={vi.fn()}
        colorMode="light"
      />
    );
    expect(screen.getByText('Test Menu')).toBeDefined();

    rerender(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Test Menu"
        setActiveMenu={vi.fn()}
        colorMode="dark"
      />
    );
    expect(screen.getByText('Item 1')).toBeDefined();
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

  it('calls setActiveMenu on click and onMouseEnter when another activeMenu is set', () => {
    const setActiveMenu = vi.fn();
    render(
      <MenuBarDropdown
        menu={mockMenu}
        activeMenu="Other Menu"
        setActiveMenu={setActiveMenu}
        colorMode="light"
      />
    );

    const btn = screen.getByText('Test Menu');
    fireEvent.mouseEnter(btn);
    expect(setActiveMenu).toHaveBeenCalledWith('Test Menu');

    fireEvent.click(btn);
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

  it('renders checkmark for checked items and handles unchecked boolean items', () => {
    const uncheckedMenu = {
      label: 'View',
      items: [
        { label: 'Show Grid', onClick: vi.fn(), checked: false },
      ],
    };
    const setActiveMenu = vi.fn();

    render(
      <MenuBarDropdown
        menu={uncheckedMenu}
        activeMenu="View"
        setActiveMenu={setActiveMenu}
        colorMode="dark"
      />
    );

    const checkBtn = screen.getByText('Show Grid').closest('button')!;
    fireEvent.click(checkBtn);
    expect(uncheckedMenu.items[0].onClick).toHaveBeenCalled();
    expect(setActiveMenu).not.toHaveBeenCalledWith(null);
  });

  it('handles File menu click and hover interactions', () => {
    const fileMenu = {
      label: 'File',
      items: [{ label: 'Save', onClick: vi.fn() }],
    };
    const onMenuClick = vi.fn();
    const setActiveMenu = vi.fn();

    render(
      <MenuBarDropdown
        menu={fileMenu}
        activeMenu="File"
        setActiveMenu={setActiveMenu}
        colorMode="dark"
        onMenuClick={onMenuClick}
      />
    );

    const fileBtn = screen.getByRole('button', { name: 'File' });

    // Hovering over File menu button when activeMenu is set should NOT call setActiveMenu('File')
    fireEvent.mouseEnter(fileBtn);
    expect(setActiveMenu).not.toHaveBeenCalledWith('File');

    // Clicking File menu header calls onMenuClick and sets activeMenu to null
    fireEvent.click(fileBtn);
    expect(onMenuClick).toHaveBeenCalledWith('File');
    expect(setActiveMenu).toHaveBeenCalledWith(null);
  });
});
