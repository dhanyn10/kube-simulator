import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { Shield } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { useFlowStore } from '@/store';

describe('Modal component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    icon: Shield,
    children: <div>Modal Inner Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<Modal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with default props and compact header in dark mode', () => {
    render(<Modal {...defaultProps} subtitle="Compact Subtitle" />);

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Compact Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Modal Inner Content')).toBeInTheDocument();
  });

  it('renders with subtitle, footer, non-compact header, disableScroll, and in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });

    render(
      <Modal
        {...defaultProps}
        subtitle="Non-compact Subtitle"
        footer={<button type="button">Footer Action</button>}
        compactHeader={false}
        disableScroll={true}
        alignClass="items-start"
        widthClass="max-w-xl"
        maxHeightClass="h-[50vh]"
      >
        <div>Content Without Scroll</div>
      </Modal>
    );

    expect(screen.getByText('Non-compact Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Footer Action')).toBeInTheDocument();
  });

  it('calls onClose when top-right close button or backdrop button is clicked', () => {
    render(<Modal {...defaultProps} />);

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    // Backdrop button click
    const backdropBtn = screen.getAllByRole('button', { hidden: true })[0];
    fireEvent.click(backdropBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<Modal {...defaultProps} />);

    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles right-click context menu, theme toggle, and close option in dark & light modes', () => {
    const toggleColorMode = vi.fn();
    useFlowStore.setState({ colorMode: 'dark', toggleColorMode });

    const { rerender } = render(<Modal {...defaultProps} />);

    // Open context menu via right click on dialog
    const dialogElement = screen.getByRole('dialog', { hidden: true });
    fireEvent.contextMenu(dialogElement, { clientX: 100, clientY: 150 });

    expect(screen.getByText('Change Theme')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();

    // Click Change Theme
    const changeThemeBtn = screen.getByText('Change Theme').closest('button')!;
    fireEvent.click(changeThemeBtn);
    expect(toggleColorMode).toHaveBeenCalledTimes(1);

    // Context menu should close after action
    expect(screen.queryByText('Change Theme')).not.toBeInTheDocument();

    // Re-open context menu in light mode
    act(() => {
      useFlowStore.setState({ colorMode: 'light' });
    });
    rerender(<Modal {...defaultProps} />);

    fireEvent.contextMenu(dialogElement, { clientX: 120, clientY: 180 });
    expect(screen.getByText('Change Theme')).toBeInTheDocument();

    // Click Exit inside context menu
    const closeContextBtn = screen.getByText('Exit').closest('button')!;
    fireEvent.click(closeContextBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes context menu on click outside or on secondary context menu event, and keeps open when clicking inside', () => {
    render(<Modal {...defaultProps} />);

    const dialogElement = screen.getByRole('dialog', { hidden: true });
    fireEvent.contextMenu(dialogElement, { clientX: 50, clientY: 50 });

    const changeThemeBtn = screen.getByText('Change Theme');
    const menuContainer = changeThemeBtn.closest('div')!;

    // Click inside context menu container (not triggering button handler)
    fireEvent.click(menuContainer);
    expect(screen.getByText('Change Theme')).toBeInTheDocument();

    // Click outside context menu
    fireEvent.click(document.body);
    expect(screen.queryByText('Change Theme')).not.toBeInTheDocument();

    // Re-open and trigger contextmenu outside
    fireEvent.contextMenu(dialogElement, { clientX: 50, clientY: 50 });
    expect(screen.getByText('Change Theme')).toBeInTheDocument();

    fireEvent.contextMenu(document.body);
    expect(screen.queryByText('Change Theme')).not.toBeInTheDocument();
  });
});
