import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPaginationBar } from '../../../src/components/Layout/TerminalPanel';
import '@testing-library/jest-dom';

describe('TerminalPaginationBar', () => {
  it('renders correctly and handles page navigation', () => {
    const setCurrentPage = vi.fn();
    const onToggleAutoscroll = vi.fn();

    render(
      <TerminalPaginationBar
        filteredLogsLength={60}
        currentPage={1}
        pageSize={25}
        totalPages={3}
        colorMode="dark"
        setCurrentPage={setCurrentPage}
        isAutoscroll={true}
        onToggleAutoscroll={onToggleAutoscroll}
      />
    );

    expect(screen.getByText('Showing 1-25 of 60 logs')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Prev' });
    const nextBtn = screen.getByRole('button', { name: 'Next' });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(setCurrentPage).toHaveBeenCalled();

    const checkbox = screen.getByTestId('autoscroll-checkbox-logs') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(onToggleAutoscroll).toHaveBeenCalledWith(false);
  });

  it('handles last page boundaries correctly', () => {
    const setCurrentPage = vi.fn();

    render(
      <TerminalPaginationBar
        filteredLogsLength={60}
        currentPage={3}
        pageSize={25}
        totalPages={3}
        colorMode="light"
        setCurrentPage={setCurrentPage}
        isAutoscroll={false}
        onToggleAutoscroll={vi.fn()}
      />
    );

    expect(screen.getByText('Showing 51-60 of 60 logs')).toBeInTheDocument();
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Prev' });
    const nextBtn = screen.getByRole('button', { name: 'Next' });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    fireEvent.click(prevBtn);
    expect(setCurrentPage).toHaveBeenCalled();
  });
});
