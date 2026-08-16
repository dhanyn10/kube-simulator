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

  it('formats log entries into text string', () => {
    const ts = new Date('2025-05-20T10:15:30').getTime();
    const logs: LogEntry[] = [
      { id: '1', level: 'info', scope: 'Simulation', message: 'Tick started', timestamp: ts },
      { id: '2', level: 'error', scope: 'KubeConsole', message: 'Failed command', timestamp: ts + 1000 },
    ];

    const text = formatLogsText(logs);
    const lines = text.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('[INFO ] [Simulation] Tick started');
    expect(lines[1]).toContain('[ERROR] [KubeConsole] Failed command');
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
});
