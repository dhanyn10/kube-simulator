import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogPagination } from '../../../../src/components/Modals/LogModal/LogPagination';
import '@testing-library/jest-dom';

describe('LogPagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 3,
    itemsPerPage: 20,
    totalItems: 50,
    onPageChange: vi.fn(),
    colorMode: 'dark' as const,
  };

  it('renders pagination counts', () => {
    render(<LogPagination {...defaultProps} />);

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('disables Prev button on page 1 and enables Next button', () => {
    const onPageChange = vi.fn();
    render(<LogPagination {...defaultProps} onPageChange={onPageChange} />);

    const prevBtn = screen.getByTestId('log-pagination-prev');
    const nextBtn = screen.getByTestId('log-pagination-next');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Next button on last page and handles Prev button click', () => {
    const onPageChange = vi.fn();
    render(
      <LogPagination
        {...defaultProps}
        currentPage={3}
        onPageChange={onPageChange}
      />
    );

    const prevBtn = screen.getByTestId('log-pagination-prev');
    const nextBtn = screen.getByTestId('log-pagination-next');

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
