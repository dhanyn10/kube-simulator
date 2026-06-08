import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryPanel } from '@/components/Monitoring/HistoryPanel';
import '@testing-library/jest-dom';

const mockLogs = [
  { actionName: 'Create Node', index: 1, timestamp: Date.now() },
  { actionName: 'Delete Node', index: 2, timestamp: Date.now() },
];

const mockFetchHistoryLogs = vi.fn();
const mockHandleJumpToHistory = vi.fn();

vi.mock('@/hooks/useHistory', () => ({
  useHistory: () => ({
    historyLogs: mockLogs,
    fetchHistoryLogs: mockFetchHistoryLogs,
    handleJumpToHistory: mockHandleJumpToHistory,
  }),
}));

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and toggles open/close', async () => {
    render(<HistoryPanel colorMode="dark" />);
    const button = screen.getByTitle('Activity Log (BadgerDB)');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(mockFetchHistoryLogs).toHaveBeenCalled();
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    expect(screen.getByText('Create Node')).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByText('Activity Timeline')).not.toBeInTheDocument();
  });

  it('calls handleJumpToHistory when a log is clicked', () => {
    render(<HistoryPanel colorMode="dark" />);
    fireEvent.click(screen.getByTitle('Activity Log (BadgerDB)'));

    const logButton = screen.getByText('Create Node').closest('button');
    fireEvent.click(logButton!);

    expect(mockHandleJumpToHistory).toHaveBeenCalledWith(1);
    expect(screen.queryByText('Activity Timeline')).not.toBeInTheDocument();
  });

  it('applies dark mode classes', () => {
    render(<HistoryPanel colorMode="dark" />);
    const button = screen.getByTitle('Activity Log (BadgerDB)');
    expect(button).toHaveClass('bg-slate-800');
  });

  it('applies light mode classes', () => {
    render(<HistoryPanel colorMode="light" />);
    const button = screen.getByTitle('Activity Log (BadgerDB)');
    expect(button).toHaveClass('bg-slate-200');
  });
});
