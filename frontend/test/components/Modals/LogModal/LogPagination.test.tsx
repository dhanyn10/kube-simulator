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

  it('returns null when totalPages <= 1', () => {
    const { container } = render(
      <LogPagination {...defaultProps} totalPages={1} totalItems={10} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders pagination counts and handles navigation buttons in light mode', () => {
    const onPageChange = vi.fn();
    render(
      <LogPagination
        {...defaultProps}
        colorMode="light"
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    // Click page number button
    const page2Btn = screen.getByTestId('log-pagination-page-2');
    fireEvent.click(page2Btn);
    expect(onPageChange).toHaveBeenCalledWith(2);

    // Click Last button
    const lastBtn = screen.getByTestId('log-pagination-last');
    fireEvent.click(lastBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables Prev and First on page 1 and handles Next button click', () => {
    const onPageChange = vi.fn();
    render(<LogPagination {...defaultProps} onPageChange={onPageChange} />);

    const firstBtn = screen.getByTestId('log-pagination-first');
    const prevBtn = screen.getByTestId('log-pagination-prev');
    const nextBtn = screen.getByTestId('log-pagination-next');

    expect(firstBtn).toBeDisabled();
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Next and Last on last page and handles First button click', () => {
    const onPageChange = vi.fn();
    render(
      <LogPagination
        {...defaultProps}
        currentPage={3}
        onPageChange={onPageChange}
      />
    );

    const firstBtn = screen.getByTestId('log-pagination-first');
    const prevBtn = screen.getByTestId('log-pagination-prev');
    const nextBtn = screen.getByTestId('log-pagination-next');
    const lastBtn = screen.getByTestId('log-pagination-last');

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
    expect(lastBtn).toBeDisabled();

    fireEvent.click(firstBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calculates page numbers correctly when totalPages > 5 and currentPage is near the end', () => {
    const onPageChange = vi.fn();
    render(
      <LogPagination
        {...defaultProps}
        currentPage={9}
        totalPages={10}
        totalItems={200}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByTestId('log-pagination-page-6')).toBeInTheDocument();
    expect(screen.getByTestId('log-pagination-page-10')).toBeInTheDocument();
  });
});
