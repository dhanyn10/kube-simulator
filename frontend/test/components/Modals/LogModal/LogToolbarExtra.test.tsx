import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { LogToolbar } from '../../../../src/components/Modals/LogModal/LogToolbar';

describe('LogToolbar extra branch coverage', () => {
  it('covers fatal log level counting, partial selection checkbox icon, and select menu dropdown options', () => {
    const onSelectByType = vi.fn();
    const setIsSelectMenuOpen = vi.fn();

    const logs: any[] = [
      { id: '1', level: 'fatal', message: 'fatal log', scope: 'UI', timestamp: '2025-01-01' },
      { id: '2', level: 'info', message: 'info log', scope: 'UI', timestamp: '2025-01-01' },
    ];

    const filteredLogs = logs;
    const selectedIds = new Set(['1']); // 1 selected out of 2 -> isSomeSelected = true

    render(
      <LogToolbar
        logs={logs}
        filteredLogs={filteredLogs}
        selectedIds={selectedIds}
        activeLevelFilter="all"
        setActiveLevelFilter={vi.fn()}
        activeScopeFilter="all"
        setActiveScopeFilter={vi.fn()}
        availableScopes={['UI', 'Backend']}
        searchQuery=""
        setSearchQuery={vi.fn()}
        isSelectMenuOpen={true}
        setIsSelectMenuOpen={setIsSelectMenuOpen}
        onHandleSelectAll={vi.fn()}
        onSelectByType={onSelectByType}
        onBulkDelete={vi.fn()}
        onExportLogs={vi.fn()}
        colorMode="dark"
      />
    );

    // Verify select menu dropdown options click
    const errorSelectOption = screen.getByTestId('log-select-error');
    fireEvent.click(errorSelectOption);
    expect(onSelectByType).toHaveBeenCalledWith('error');

    // Verify scope filter option selection
    const scopeSelect = screen.getByTestId('log-scope-filter');
    expect(scopeSelect).toBeInTheDocument();
  });
});
