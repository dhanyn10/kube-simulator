import '@/init-console';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatLogMessage, setupConsoleOverrides } from '@/activities/ui/mainLogger';

const addLogSpy = vi.fn();
vi.mock('@/store', () => ({
  useFlowStore: {
    getState: vi.fn(() => ({
      addLog: addLogSpy,
    })),
    setState: vi.fn(),
  },
}));

describe('mainLogger activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats strings, errors, and JSON serializable objects correctly', () => {
    expect(formatLogMessage(['hello', 'world'])).toBe('hello world');

    const err = new Error('Test error');
    expect(formatLogMessage([err])).toContain('Error: Test error');

    const obj = { name: 'Kube', value: 42 };
    expect(formatLogMessage([obj])).toBe(JSON.stringify(obj));
  });

  it('handles circular/unserializable objects gracefully', () => {
    const circular: any = {};
    circular.self = circular;

    const result = formatLogMessage([circular]);
    expect(result).toBe('[Unserializable Object]');
  });

  it('overrides console methods and dispatches logs to flow store', () => {
    setupConsoleOverrides();

    console.log('Test info log');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'Test info log');

    console.warn('Test warn log');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'Test warn log');

    console.error('Test error log');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'Test error log');
  });
});
