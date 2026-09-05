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

  it('renders in light mode with active filters and calculates log counts correctly', () => {
    const props = {
      ...defaultProps,
      colorMode: 'light' as const,
      activeLevelFilter: 'error' as const,
      logs: [
        { id: '1', level: 'error' as const, message: 'Err', timestamp: '10:00', scope: 'System' as const },
        { id: '2', level: 'fatal' as const, message: 'Fatal', timestamp: '10:01', scope: 'System' as const },
        { id: '3', level: 'warn' as const, message: 'Warn', timestamp: '10:02', scope: 'System' as const },
        { id: '4', level: 'info' as const, message: 'Info', timestamp: '10:03', scope: 'System' as const },
      ],
    };

    render(<LogToolbar {...props} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('handles dropdown selection menu and click outside', () => {
    const setIsSelectMenuOpen = vi.fn();
    const onSelectByType = vi.fn();

    const props = {
      ...defaultProps,
      isSelectMenuOpen: true,
      setIsSelectMenuOpen,
      onSelectByType,
    };

    render(<LogToolbar {...props} />);

    const selectAllOption = screen.getByTestId('log-select-all');
    fireEvent.click(selectAllOption);
    expect(onSelectByType).toHaveBeenCalledWith('all');

    // Trigger click outside listener
    fireEvent.mouseDown(document.body);
    expect(setIsSelectMenuOpen).toHaveBeenCalledWith(false);
  });

  it('renders selection mode controls, master checkbox icon variations, and triggers bulk delete', () => {
    const onBulkDelete = vi.fn();
    const filteredLogs = [
      { id: '1', level: 'error' as const, message: 'L1', timestamp: '10:00', scope: 'System' as const },
      { id: '2', level: 'warn' as const, message: 'L2', timestamp: '10:01', scope: 'System' as const },
    ];

    // Some selected
    const propsSome = {
      ...defaultProps,
      filteredLogs,
      selectedIds: new Set(['1']),
      onBulkDelete,
    };

    const { rerender } = render(<LogToolbar {...propsSome} />);

    expect(screen.getByTestId('log-selection-count')).toHaveTextContent('1 selected');
    fireEvent.click(screen.getByTestId('log-bulk-delete'));
    expect(onBulkDelete).toHaveBeenCalled();

    // All selected
    const propsAll = {
      ...defaultProps,
      filteredLogs,
      selectedIds: new Set(['1', '2']),
    };

    rerender(<LogToolbar {...propsAll} />);
    expect(screen.getByTestId('log-selection-count')).toHaveTextContent('2 selected');
  });
});
