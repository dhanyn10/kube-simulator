import { LogEntry } from '../../../store/types';

/**
 * Formats timestamp to ISO-like local date time string: YYYY-MM-DD HH:mm:ss
 */
export const formatFullDateTime = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Converts log entries into formatted text for .log file export.
 */
export const formatLogsText = (logs: LogEntry[]): string => {
  return logs
    .map((log) => {
      const dateTime = formatFullDateTime(log.timestamp);
      const level = (log.level || 'info').toUpperCase().padEnd(5, ' ');
      const scope = log.scope ? `[${log.scope}]` : '[System]';
      return `[${dateTime}] [${level}] ${scope} ${log.message}`;
    })
    .join('\n');
};

/**
 * Opens the log JSON file directory in OS file explorer via Wails backend (App.OpenLogFile),
 * or falls back to browser JSON download if outside Wails context.
 */
export const exportLogsToFile = async (logs: LogEntry[]): Promise<boolean> => {
  if (window.go?.main?.App?.OpenLogFile) {
    try {
      const success = await window.go.main.App.OpenLogFile();
      if (success) return true;
    } catch {
      // Fallback to browser download if backend call fails
    }
  }

  if (logs.length === 0) return false;

  const jsonlContent = logs.map((log) => JSON.stringify(log)).join('\n');
  const blob = new Blob([jsonlContent], { type: 'application/x-ndjson;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `app_logs_${dateStr}_${timeStr}.jsonl`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};
