import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { TerminalCommandForm } from '@/components/Layout/Terminal/TerminalCommandForm';
import { useFlowStore } from '@/store';
import { SuggestionItem } from '@/activities/terminal';

describe('TerminalCommandForm', () => {
  const defaultProps = {
    onSubmit: vi.fn((e) => e.preventDefault()),
    commandInput: '',
    onInputChange: vi.fn(),
    onKeyDown: vi.fn(),
    colorMode: 'dark' as const,
    isAutoscroll: true,
    onToggleAutoscroll: vi.fn(),
    suggestions: [
      { value: 'kubectl get pods', category: 'kubectl', label: 'kubectl get pods' },
    ] as SuggestionItem[],
    isDropdownOpen: false,
    selectedIndex: 0,
    selectedSubIndex: -1,
    onSelectSuggestion: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ isAwaitingAdminPassword: false });
  });

  it('renders correctly in dark mode', () => {
    render(<TerminalCommandForm {...defaultProps} colorMode="dark" />);

    expect(screen.getByText('$')).toHaveClass('text-cyan-400');
    const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.placeholder).toContain('Type kubectl command');

    const checkbox = screen.getByTestId('autoscroll-checkbox-activity') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('renders correctly in light mode with light mode styling', () => {
    render(
      <TerminalCommandForm
        {...defaultProps}
        colorMode="light"
        isDropdownOpen={true}
      />
    );

    expect(screen.getByText('$')).toHaveClass('text-cyan-600');
    expect(screen.getByTestId('terminal-autocomplete-popup')).toHaveClass('bg-white');
  });

  it('handles isAwaitingAdminPassword password mode and hides dropdown popup', () => {
    useFlowStore.setState({ isAwaitingAdminPassword: true });

    render(
      <TerminalCommandForm
        {...defaultProps}
        isDropdownOpen={true}
      />
    );

    const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.placeholder).toBe('Enter admin password (input hidden)...');

    // Dropdown should be hidden when awaiting admin password
    expect(screen.queryByTestId('terminal-autocomplete-popup')).toBeNull();
  });

  it('triggers callbacks on input change, key down, submit, and autoscroll checkbox toggle', () => {
    render(<TerminalCommandForm {...defaultProps} commandInput="kubectl get" />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    expect(defaultProps.onInputChange).toHaveBeenCalledWith('kubectl get pods');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onKeyDown).toHaveBeenCalled();

    const form = input.closest('form')!;
    fireEvent.submit(form);
    expect(defaultProps.onSubmit).toHaveBeenCalled();

    const checkbox = screen.getByTestId('autoscroll-checkbox-activity');
    fireEvent.click(checkbox);
    expect(defaultProps.onToggleAutoscroll).toHaveBeenCalledWith(false);
  });
});
