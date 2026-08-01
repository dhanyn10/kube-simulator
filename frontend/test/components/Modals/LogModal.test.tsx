import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogModal } from '@/components/Modals/LogModal';
import { useFlowStore } from '@/store';

// Mock useFlowStore
vi.mock('@/store', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/store')>();
    return {
        ...actual,
        useFlowStore: vi.fn(actual.useFlowStore),
    };
});

describe('LogModal', () => {
    const mockLogs = [
        { id: '1', level: 'info' as const, message: 'Info log 1', timestamp: Date.now() - 10000 },
        { id: '2', level: 'warn' as const, message: 'Warn log 1', timestamp: Date.now() - 5000 },
        { id: '3', level: 'error' as const, message: 'Error log 1', timestamp: Date.now() },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        useFlowStore.setState({
            logs: mockLogs,
            isLogModalOpen: true,
            colorMode: 'dark',
        });
    });

    it('renders logs correctly', () => {
        render(<LogModal />);
        expect(screen.getByText('Console Logs')).toBeDefined();
        expect(screen.getByText('Info log 1')).toBeDefined();
        expect(screen.getByText('Warn log 1')).toBeDefined();
        expect(screen.getByText('Error log 1')).toBeDefined();
    });

    it('filters logs by level', async () => {
        render(<LogModal />);

        const errorTab = screen.getByText('Errors');
        fireEvent.click(errorTab);

        expect(screen.getByText('Error log 1')).toBeDefined();
        expect(screen.queryByText('Info log 1')).toBeNull();
        expect(screen.queryByText('Warn log 1')).toBeNull();
    });

    it('searches logs', () => {
        render(<LogModal />);
        const searchInput = screen.getByPlaceholderText('Search logs...');
        fireEvent.change(searchInput, { target: { value: 'Warn' } });

        expect(screen.getByText('Warn log 1')).toBeDefined();
        expect(screen.queryByText('Info log 1')).toBeNull();
        expect(screen.queryByText('Error log 1')).toBeNull();
    });

    it('handles individual log deletion', async () => {
        const deleteLogSpy = vi.spyOn(useFlowStore.getState(), 'deleteLog');
        render(<LogModal />);

        const deleteButtons = screen.getAllByTitle('Delete log');
        fireEvent.click(deleteButtons[0]); // Delete first log (Error log 1)

        expect(deleteLogSpy).toHaveBeenCalledWith('3');
    });

    it('handles clear all', () => {
        const clearLogsSpy = vi.spyOn(useFlowStore.getState(), 'clearLogs');
        render(<LogModal />);

        fireEvent.click(screen.getByTestId('log-clear-all'));
        expect(clearLogsSpy).toHaveBeenCalled();
    });

    it('handles bulk selection and deletion', async () => {
        const deleteLogsSpy = vi.spyOn(useFlowStore.getState(), 'deleteLogs');
        render(<LogModal />);

        // Select all via master checkbox
        fireEvent.click(screen.getByTestId('log-master-checkbox'));
        expect(screen.getByText('3 selected')).toBeDefined();

        // Click bulk delete
        fireEvent.click(screen.getByTestId('log-bulk-delete'));
        expect(deleteLogsSpy).toHaveBeenCalledWith(['3', '2', '1']);
    });

    it('can select by type via dropdown', () => {
        render(<LogModal />);

        // Open dropdown
        fireEvent.click(screen.getByTestId('log-select-dropdown'));

        // Select error
        fireEvent.click(screen.getByTestId('log-select-error'));

        expect(screen.getByText('1 selected')).toBeDefined();
    });

    it('toggles log expansion', () => {
        render(<LogModal />);
        const logItem = screen.getByText('Info log 1').closest('button');
        if (!logItem) throw new Error('Log item button not found');

        expect(logItem.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(logItem);
        expect(logItem.getAttribute('aria-expanded')).toBe('true');
    });

    it('shows empty state when no logs match filter', () => {
        render(<LogModal />);
        const searchInput = screen.getByPlaceholderText('Search logs...');
        fireEvent.change(searchInput, { target: { value: 'non-existent' } });

        expect(screen.getByText('No logs matching your search.')).toBeDefined();
    });
});
