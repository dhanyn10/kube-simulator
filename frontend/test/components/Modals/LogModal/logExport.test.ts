import { describe, it, expect } from 'vitest';
import { formatFullDateTime, formatLogsText } from '../../../../src/components/Modals/LogModal/logExport';
import { LogEntry } from '../../../../src/store/types';

describe('logExport', () => {
  it('formats full date time correctly', () => {
    const ts = new Date('2025-05-20T10:15:30').getTime();
    const formatted = formatFullDateTime(ts);
    expect(formatted).toContain('2025-05-20');
    expect(formatted).toContain('10:15:30');
  });

  it('formats log entries into text string including default level and scope fallbacks', () => {
    const ts = new Date('2025-05-20T10:15:30').getTime();
    const logs: LogEntry[] = [
      { id: '1', level: 'info', scope: 'Simulation', message: 'Tick started', timestamp: ts },
      { id: '2', level: 'error', scope: 'KubeConsole', message: 'Failed command', timestamp: ts + 1000 },
      { id: '3', level: undefined as any, scope: undefined as any, message: 'Default log', timestamp: ts + 2000 },
    ];

    const text = formatLogsText(logs);
    const lines = text.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('[INFO ] [Simulation] Tick started');
    expect(lines[1]).toContain('[ERROR] [KubeConsole] Failed command');
    expect(lines[2]).toContain('[INFO ] [System] Default log');
  });

  it('calls OpenLogFile when window.go is defined', async () => {
    const exportMock = vi.fn().mockResolvedValue(true);
    (window as any).go = {
      main: {
        App: {
          OpenLogFile: exportMock,
        },
      },
    };

    const logs: LogEntry[] = [
      { id: '1', level: 'info', scope: 'Simulation', message: 'Test log', timestamp: Date.now() },
    ];

    const { exportLogsToFile } = await import('../../../../src/components/Modals/LogModal/logExport');
    const result = await exportLogsToFile(logs);

    expect(result).toBe(true);
    expect(exportMock).toHaveBeenCalled();
  });

  it('handles OpenLogFile returning false with empty logs and non-empty logs fallback download', async () => {
    const exportMock = vi.fn().mockResolvedValue(false);
    (window as any).go = {
      main: {
        App: {
          OpenLogFile: exportMock,
        },
      },
    };

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const { exportLogsToFile } = await import('../../../../src/components/Modals/LogModal/logExport');

    // Case 1: OpenLogFile returns false and logs is empty -> returns false
    const resultEmpty = await exportLogsToFile([]);
    expect(resultEmpty).toBe(false);

    // Case 2: OpenLogFile returns false and logs is non-empty -> browser download fallback returns true
    const logs: LogEntry[] = [
      { id: '1', level: 'info', scope: 'Simulation', message: 'Fallback log', timestamp: Date.now() },
    ];
    const resultFallback = await exportLogsToFile(logs);
    expect(resultFallback).toBe(true);
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it('handles OpenLogFile throwing an error and falls back to browser download', async () => {
    const exportMock = vi.fn().mockRejectedValue(new Error('Backend error'));
    (window as any).go = {
      main: {
        App: {
          OpenLogFile: exportMock,
        },
      },
    };

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const logs: LogEntry[] = [
      { id: '1', level: 'info', scope: 'Simulation', message: 'Error fallback log', timestamp: Date.now() },
    ];

    const { exportLogsToFile } = await import('../../../../src/components/Modals/LogModal/logExport');
    const result = await exportLogsToFile(logs);

    expect(result).toBe(true);
    expect(mockAnchor.click).toHaveBeenCalled();
  });
});
