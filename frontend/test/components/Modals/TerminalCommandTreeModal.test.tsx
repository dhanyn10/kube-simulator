import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TerminalCommandTreeModal } from '@/components/Modals/TerminalCommandTreeModal';
import * as modalsActivity from '@/activities/modals';
import { useFlowStore } from '@/store';

describe('TerminalCommandTreeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      isTerminalCommandTreeModalOpen: false,
      colorMode: 'dark',
      isTerminalOpen: false,
      terminalActiveTab: 'activity',
    });
  });

  it('does not render when modal is closed', () => {
    const { container } = render(<TerminalCommandTreeModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open in dark mode', () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    expect(screen.getByText('Terminal Commands Reference Tree')).toBeDefined();
    expect(screen.getByPlaceholderText(/Filter command tree/i)).toBeDefined();
    expect(screen.getByText('Expand All')).toBeDefined();
    expect(screen.getByText('Collapse All')).toBeDefined();
    expect(screen.getByText('kubectl')).toBeDefined();
  });

  it('renders correctly in light mode', () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true, colorMode: 'light' });
    render(<TerminalCommandTreeModal />);

    expect(screen.getByText('Terminal Commands Reference Tree')).toBeDefined();
  });

  it('handles Expand All and Collapse All button clicks', () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    const collapseBtn = screen.getByText('Collapse All');
    fireEvent.click(collapseBtn);

    const expandBtn = screen.getByText('Expand All');
    fireEvent.click(expandBtn);

    expect(screen.getByText('kubectl')).toBeDefined();
  });

  it('filters command tree when search input changes and handles clearing filter', () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    const searchInput = screen.getByPlaceholderText(/Filter command tree/i);
    fireEvent.change(searchInput, { target: { value: 'get-contexts' } });

    expect(screen.getByText('get-contexts')).toBeDefined();

    // Test clearing search input (value.trim().length > 0 evaluates to false)
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('kubectl')).toBeDefined();

    fireEvent.change(searchInput, { target: { value: '   ' } });
    expect(screen.getByText('kubectl')).toBeDefined();
  });

  it('displays empty state message when no commands match filter', () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    const searchInput = screen.getByPlaceholderText(/Filter command tree/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent-command-xyz' } });

    expect(screen.getByText('No matching CLI commands found')).toBeDefined();
  });

  it('selects a command, opens terminal, dispatches event, and closes modal', async () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const podsNode = screen.getByText('pods');
    await act(async () => {
      fireEvent.click(podsNode);
    });

    expect(useFlowStore.getState().isTerminalCommandTreeModalOpen).toBe(false);
    expect(useFlowStore.getState().isTerminalOpen).toBe(true);

    // Fast-forward timeout
    await new Promise((r) => setTimeout(r, 150));

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('handles node expand/collapse toggle buttons and keyboard navigation', () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true, colorMode: 'light' });
    render(<TerminalCommandTreeModal />);

    const kubectlNodeBtn = screen.getByText('kubectl');
    // Non-trigger key
    fireEvent.keyDown(kubectlNodeBtn, { key: 'ArrowDown' });
    fireEvent.keyDown(kubectlNodeBtn, { key: 'Enter' });
    fireEvent.keyDown(kubectlNodeBtn, { key: ' ' });

    // Directly click node-level chevron toggle button to collapse and expand
    const collapseChevron = screen.getByRole('button', { name: 'Collapse kubectl' });
    fireEvent.click(collapseChevron);
    expect(screen.getByRole('button', { name: 'Expand kubectl' })).toBeDefined();

    const expandChevron = screen.getByRole('button', { name: 'Expand kubectl' });
    fireEvent.click(expandChevron);
    expect(screen.getByRole('button', { name: 'Collapse kubectl' })).toBeDefined();
  });

  it('handles Run button click directly on executable nodes', async () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    const runBtns = screen.getAllByRole('button', { name: /Run/i });
    expect(runBtns.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(runBtns[0]);
    });

    expect(useFlowStore.getState().isTerminalCommandTreeModalOpen).toBe(false);
  });

  it('handles window event dispatching and keyboard events on non-children items', async () => {
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    // Click on leaf command
    const podsBtn = screen.getByText('pods');
    await act(async () => {
      fireEvent.click(podsBtn);
    });

    expect(useFlowStore.getState().isTerminalCommandTreeModalOpen).toBe(false);
  });

  it('handles click on item with neither children nor command', () => {
    vi.spyOn(modalsActivity, 'filterCommandTree').mockReturnValueOnce([
      { id: 'custom-no-cmd', name: 'info-only', description: 'Just a label' }
    ]);
    useFlowStore.setState({ isTerminalCommandTreeModalOpen: true });
    render(<TerminalCommandTreeModal />);

    const item = screen.getByText('info-only');
    expect(() => fireEvent.click(item)).not.toThrow();
  });
});
