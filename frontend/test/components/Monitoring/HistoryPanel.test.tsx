import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from '../../../src/components/Monitoring/HistoryPanel';
import '@testing-library/jest-dom';

let mockLogs: any[] = [
  { actionName: 'Create Node', index: 1, timestamp: Date.now() },
  { actionName: 'Delete Node', index: 2, timestamp: 0 },
];
let mockCurrentHistoryIndex: number | null = 1;
let mockIsLoading = false;

const mockFetchHistoryLogs = vi.fn();
const mockHandleJumpToHistory = vi.fn();

vi.mock('../../../src/hooks/useHistory', () => ({
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

  it('renders non-current step log item styling in light mode', () => {
    mockCurrentHistoryIndex = 2; // index 1 is not current step
    render(<HistoryPanel colorMode="light" />);
    const logButton = screen.getByText('Create Node').closest('button');
    expect(logButton?.className).toContain('hover:bg-violet-50/50 text-slate-700');
  });

  it('renders fallback index === 0 as current step when currentHistoryIndex is null', () => {
    mockCurrentHistoryIndex = null;
    render(<HistoryPanel colorMode="dark" />);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('renders empty activity recorded state', () => {
    mockLogs = [];
    render(<HistoryPanel colorMode="dark" />);
    expect(screen.getByText('No activity recorded')).toBeInTheDocument();
  });

  it('renders skeleton loading state when isLoading is true and historyLogs is empty', () => {
    mockLogs = [];
    mockIsLoading = true;
    const { container } = render(<HistoryPanel colorMode="dark" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);
  });
});
