import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from '@/components/Monitoring/HistoryPanel';
import '@testing-library/jest-dom';

let mockLogs: any[] = [
  { actionName: 'Create Node', index: 1, timestamp: Date.now() },
  { actionName: 'Delete Node', index: 2, timestamp: 0 },
];
let mockCurrentHistoryIndex: number | null = 1;
let mockIsLoading = false;

const mockFetchHistoryLogs = vi.fn();
const mockHandleJumpToHistory = vi.fn();

vi.mock('@/hooks/useHistory', () => ({
  useHistory: () => ({
    historyLogs: mockLogs,
    currentHistoryIndex: mockCurrentHistoryIndex,
    isLoading: mockIsLoading,
    fetchHistoryLogs: mockFetchHistoryLogs,
    handleJumpToHistory: mockHandleJumpToHistory,
  }),
}));

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogs = [
      { actionName: 'Create Node', index: 1, timestamp: Date.now() },
      { actionName: 'Delete Node', index: 2, timestamp: 0 },
    ];
    mockCurrentHistoryIndex = 1;
    mockIsLoading = false;
  });

  it('renders correctly and fetches history logs', () => {
    render(<HistoryPanel colorMode="dark" />);
    expect(mockFetchHistoryLogs).toHaveBeenCalled();
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    expect(screen.getByText('Create Node')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('calls handleJumpToHistory when a log is clicked', () => {
    render(<HistoryPanel colorMode="dark" />);

    const logButton = screen.getByText('Create Node').closest('button');
    fireEvent.click(logButton!);

    expect(mockHandleJumpToHistory).toHaveBeenCalledWith(1);
  });

  it('renders light mode and recorded snapshot fallback timestamp', () => {
    render(<HistoryPanel colorMode="light" />);
    expect(screen.getByText('Recorded Snapshot')).toBeInTheDocument();
  });

  it('renders non-current step log item styling in light mode and dark mode', () => {
    mockCurrentHistoryIndex = 2; // index 1 is not current step
    const { rerender } = render(<HistoryPanel colorMode="light" />);
    const logButton = screen.getByText('Create Node').closest('button');
    expect(logButton?.className).toContain('hover:bg-violet-50/50 text-slate-700');

    // Test non-current step in dark mode
    rerender(<HistoryPanel colorMode="dark" />);
    const darkLogButton = screen.getByText('Create Node').closest('button');
    expect(darkLogButton?.className).toContain('hover:bg-slate-800/50 text-slate-300');
  });

  it('renders fallback index === 0 as current step when currentHistoryIndex is null, and handles non-matching currentHistoryIndex', () => {
    mockCurrentHistoryIndex = null;
    const { rerender } = render(<HistoryPanel colorMode="dark" />);
    expect(screen.getByText('Current')).toBeInTheDocument();

    // Test non-matching currentHistoryIndex where no log is current
    mockCurrentHistoryIndex = 999;
    rerender(<HistoryPanel colorMode="dark" />);
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('renders non-current log item when currentHistoryIndex is null for items at index > 0', () => {
    mockLogs = [
      { actionName: 'Action 1', index: 1, timestamp: Date.now() },
      { actionName: 'Action 2', index: 2, timestamp: Date.now() },
    ];
    mockCurrentHistoryIndex = null;

    render(<HistoryPanel colorMode="dark" />);

    const log1 = screen.getByText('Action 1').closest('button');
    const log2 = screen.getByText('Action 2').closest('button');

    expect(log1?.className).toContain('bg-violet-950/40');
    expect(log2?.className).not.toContain('bg-violet-950/40');
  });

  it('renders empty activity recorded state', () => {
    mockLogs = [];
    render(<HistoryPanel colorMode="dark" />);
    expect(screen.getByText('No activity recorded')).toBeInTheDocument();
  });

  it('renders skeleton loading state when isLoading is true and historyLogs is empty, and handles background loading with existing logs', () => {
    mockLogs = [];
    mockIsLoading = true;
    const { container, rerender } = render(<HistoryPanel colorMode="dark" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);

    // Rerender skeleton loading in light mode
    rerender(<HistoryPanel colorMode="light" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);

    // Background refetching while logs exist
    mockLogs = [{ actionName: 'Refetch Log', index: 1, timestamp: Date.now() }];
    mockIsLoading = true;
    rerender(<HistoryPanel colorMode="dark" />);
    expect(screen.getByText('Refetch Log')).toBeInTheDocument();
  });
});
