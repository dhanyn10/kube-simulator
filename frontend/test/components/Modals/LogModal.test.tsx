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

    const matchPre = (text: string) => (_, el: Element | null) =>
        el?.tagName.toLowerCase() === 'pre' && (el.textContent?.includes(text) ?? false);

    it('renders logs correctly', () => {
        render(<LogModal />);
        expect(screen.getByText('Console Logs')).toBeDefined();
        expect(screen.getByText(matchPre('Info log 1'))).toBeDefined();
        expect(screen.getByText(matchPre('Warn log 1'))).toBeDefined();
        expect(screen.getByText(matchPre('Error log 1'))).toBeDefined();
    });

    it('filters logs by level', async () => {
        render(<LogModal />);

        const errorTab = screen.getByText('Errors');
        fireEvent.click(errorTab);

        expect(screen.getByText(matchPre('Error log 1'))).toBeDefined();
        expect(screen.queryByText(matchPre('Info log 1'))).toBeNull();
        expect(screen.queryByText(matchPre('Warn log 1'))).toBeNull();
    });

    it('searches logs', () => {
        render(<LogModal />);
        const searchInput = screen.getByPlaceholderText('Search logs...');
        fireEvent.change(searchInput, { target: { value: 'Warn' } });

        expect(screen.getByText(matchPre('Warn log 1'))).toBeDefined();
        expect(screen.queryByText(matchPre('Info log 1'))).toBeNull();
        expect(screen.queryByText(matchPre('Error log 1'))).toBeNull();
    });

    it('filters logs by scope', () => {
        useFlowStore.setState({
            logs: [
                { id: '1', level: 'info', scope: 'Simulation', message: 'Simulation event', timestamp: Date.now() },
                { id: '2', level: 'info', scope: 'KubeConsole', message: 'Console command', timestamp: Date.now() },
            ],
            isLogModalOpen: true,
        });

        render(<LogModal />);

        const scopeSelect = screen.getByTestId('log-scope-filter');
        fireEvent.change(scopeSelect, { target: { value: 'Simulation' } });

        expect(screen.getByText(matchPre('Simulation event'))).toBeDefined();
        expect(screen.queryByText(matchPre('Console command'))).toBeNull();
    });

    it('exports logs to .log file when export button is clicked', () => {
        const createObjectURLMock = vi.fn().mockReturnValue('blob:test');
        const revokeObjectURLMock = vi.fn();
        globalThis.URL.createObjectURL = createObjectURLMock;
        globalThis.URL.revokeObjectURL = revokeObjectURLMock;

        render(<LogModal />);

        const exportBtn = screen.getByTestId('log-export-btn');
        fireEvent.click(exportBtn);

        expect(createObjectURLMock).toHaveBeenCalled();
        expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test');
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
        const element = screen.getByText(matchPre('Info log 1'));
        const logItem = element.closest('button');
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

    it('handles pagination for logs correctly', () => {
        const manyLogs = Array.from({ length: 55 }, (_, i) => ({
            id: `log-${i}`,
            level: 'info' as const,
            message: `Info log ${i}`,
            timestamp: Date.now() - i * 1000,
        }));
        useFlowStore.setState({
            logs: manyLogs,
            isLogModalOpen: true,
        });

        render(<LogModal />);

        // Expect page 1 button to exist
        expect(screen.getByTestId('log-pagination-page-1')).toBeDefined();
        expect(screen.getByTestId('log-pagination-page-2')).toBeDefined();
        // Expect to show "Showing 1 to 50 of 55 logs"
        expect(screen.getByText((_, el) => el?.textContent === 'Showing 1 to 50 of 55 logs')).toBeDefined();

        // Click next
        fireEvent.click(screen.getByTestId('log-pagination-next'));
        expect(screen.getByTestId('log-pagination-page-2').className).toContain('bg-blue-600');
        expect(screen.getByText((_, el) => el?.textContent === 'Showing 51 to 55 of 55 logs')).toBeDefined();

        // Click prev
        fireEvent.click(screen.getByTestId('log-pagination-prev'));
        expect(screen.getByTestId('log-pagination-page-1').className).toContain('bg-blue-600');

        // Click last
        fireEvent.click(screen.getByTestId('log-pagination-last'));
        expect(screen.getByTestId('log-pagination-page-2').className).toContain('bg-blue-600');

        // Click first
        fireEvent.click(screen.getByTestId('log-pagination-first'));
        expect(screen.getByTestId('log-pagination-page-1').className).toContain('bg-blue-600');

        // Click page 2 button directly
        fireEvent.click(screen.getByTestId('log-pagination-page-2'));
        expect(screen.getByTestId('log-pagination-page-2').className).toContain('bg-blue-600');
    });
});
