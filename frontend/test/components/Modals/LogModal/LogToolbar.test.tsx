import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogToolbar } from '../../../../src/components/Modals/LogModal/LogToolbar';
import '@testing-library/jest-dom';

describe('LogToolbar', () => {
  const defaultProps = {
    logs: [
      { id: '1', level: 'error' as const, message: 'Database failed', timestamp: '10:00', scope: 'System' as const },
      { id: '2', level: 'warn' as const, message: 'High CPU', timestamp: '10:01', scope: 'Backend' as const },
    ],
    filteredLogs: [],
    selectedIds: new Set<string>(),
    activeLevelFilter: 'all' as const,
    setActiveLevelFilter: vi.fn(),
    activeScopeFilter: 'all',
    setActiveScopeFilter: vi.fn(),
    availableScopes: ['System', 'Backend'],
    searchQuery: '',
    setSearchQuery: vi.fn(),
    isSelectMenuOpen: false,
    setIsSelectMenuOpen: vi.fn(),
    onHandleSelectAll: vi.fn(),
    onSelectByType: vi.fn(),
    onBulkDelete: vi.fn(),
    onExportLogs: vi.fn(),
    colorMode: 'dark' as const,
  };

  it('renders level filter tabs and handles level filter change', () => {
    render(<LogToolbar {...defaultProps} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();

    const errorTabBtn = screen.getByText('Errors');
    fireEvent.click(errorTabBtn);

    expect(defaultProps.setActiveLevelFilter).toHaveBeenCalledWith('error');
  });

  it('handles search input query change and scope dropdown selection', () => {
    render(<LogToolbar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'Database' } });
    expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('Database');

    const scopeSelect = screen.getByTestId('log-scope-filter');
    fireEvent.change(scopeSelect, { target: { value: 'System' } });
    expect(defaultProps.setActiveScopeFilter).toHaveBeenCalledWith('System');
  });

  it('triggers export log action', () => {
    render(<LogToolbar {...defaultProps} />);

    const exportBtn = screen.getByTestId('log-export-btn');
    fireEvent.click(exportBtn);
    expect(defaultProps.onExportLogs).toHaveBeenCalledTimes(1);
  });
});
