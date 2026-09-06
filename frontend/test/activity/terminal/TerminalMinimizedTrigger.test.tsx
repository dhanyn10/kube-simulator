import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TerminalMinimizedTrigger } from '../../../src/activity/terminal/TerminalMinimizedTrigger';
import '@testing-library/jest-dom';

describe('TerminalMinimizedTrigger', () => {
  it('renders in dark mode when isSimulating is false', () => {
    const setTerminalOpen = vi.fn();
    const { container } = render(
      <TerminalMinimizedTrigger
        setTerminalOpen={setTerminalOpen}
        isSimulating={false}
        colorMode="dark"
      />
    );

    const button = screen.getByRole('button', { name: /Kube Terminal/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-slate-900');
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(setTerminalOpen).toHaveBeenCalledWith(true);
  });

  it('renders in light mode when isSimulating is true', () => {
    const setTerminalOpen = vi.fn();
    const { container } = render(
      <TerminalMinimizedTrigger
        setTerminalOpen={setTerminalOpen}
        isSimulating={true}
        colorMode="light"
      />
    );

    const button = screen.getByRole('button', { name: /Kube Terminal/i });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('bg-white');

    const pingDot = container.querySelector('.animate-ping');
    expect(pingDot).toBeInTheDocument();

    fireEvent.click(button);
    expect(setTerminalOpen).toHaveBeenCalledWith(true);
  });
});
