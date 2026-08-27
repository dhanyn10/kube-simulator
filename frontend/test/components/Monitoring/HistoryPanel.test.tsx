import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders correctly and fetches history logs', () => {
    render(<HistoryPanel colorMode="dark" />);
    expect(mockFetchHistoryLogs).toHaveBeenCalled();
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    expect(screen.getByText('Create Node')).toBeInTheDocument();
  });

  it('calls handleJumpToHistory when a log is clicked', () => {
    render(<HistoryPanel colorMode="dark" />);

    const logButton = screen.getByText('Create Node').closest('button');
    fireEvent.click(logButton!);

    expect(mockHandleJumpToHistory).toHaveBeenCalledWith(1);
  });

  it('applies dark mode classes', () => {
    const { container } = render(<HistoryPanel colorMode="dark" />);
    expect(container.firstChild).toHaveClass('bg-slate-900');
  });

  it('applies light mode classes', () => {
    const { container } = render(<HistoryPanel colorMode="light" />);
    expect(container.firstChild).toHaveClass('bg-white');
  });
});
