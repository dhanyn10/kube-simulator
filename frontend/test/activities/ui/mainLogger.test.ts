import '@/init-console';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatLogMessage,
  setupConsoleOverrides,
  setupBackendLogListener,
  initMainLogger
} from '@/activities/ui/mainLogger';

let backendLogCallback: ((data: { level: string; message: string }) => void) | null = null;
vi.mock('@wailsjs/runtime', () => ({
  EventsOn: vi.fn((event: string, callback: any) => {
    if (event === 'backend-log') {
      backendLogCallback = callback;
    }
  }),
}));

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

  it('formats strings, errors, null, numbers, and JSON serializable objects correctly', () => {
    expect(formatLogMessage(['hello', 'world'])).toBe('hello world');
    expect(formatLogMessage([null, undefined, 42])).toBe('null undefined 42');

    const err = new Error('Test error');
    expect(formatLogMessage([err])).toContain('Error: Test error');

    const obj = { name: 'Kube', value: 42 };
    expect(formatLogMessage([obj])).toBe(JSON.stringify(obj));
  });

  it('handles circular/unserializable objects gracefully with and without originalError', () => {
    const circular: any = {};
    circular.self = circular;

    // Without originalError (or when originalError is console.error)
    delete (globalThis as any)._originalConsoleError;
    const resultNoHandler = formatLogMessage([circular]);
    expect(resultNoHandler).toBe('[Unserializable Object]');

    // With mock originalError
    const mockOriginalError = vi.fn();
    (globalThis as any)._originalConsoleError = mockOriginalError;
    const resultWithHandler = formatLogMessage([circular]);
    expect(resultWithHandler).toBe('[Unserializable Object]');
    expect(mockOriginalError).toHaveBeenCalledWith('Log serialization failed:', expect.any(Error));

    delete (globalThis as any)._originalConsoleError;
  });

  it('handles backend log events for fatal and standard log levels', () => {
    setupBackendLogListener();
    expect(backendLogCallback).toBeDefined();

    backendLogCallback?.({ level: 'fatal', message: 'Fatal crash occurred' });
    expect(addLogSpy).toHaveBeenCalledWith('error', 'Fatal crash occurred', 'Backend');

    backendLogCallback?.({ level: 'info', message: 'Normal info log' });
    expect(addLogSpy).toHaveBeenCalledWith('info', 'Normal info log', 'Backend');
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

  it('resolves original console methods from globalThis and forwards logs', () => {
    const mockOriginalLog = vi.fn();
    const mockOriginalWarn = vi.fn();
    const mockOriginalError = vi.fn();

    (globalThis as any)._originalConsoleLog = mockOriginalLog;
    (globalThis as any)._originalConsoleWarn = mockOriginalWarn;
    (globalThis as any)._originalConsoleError = mockOriginalError;

    setupConsoleOverrides();

    console.log('global orig log');
    console.warn('global orig warn');
    console.error('global orig error');

    expect(mockOriginalLog).toHaveBeenCalledWith('global orig log');
    expect(mockOriginalWarn).toHaveBeenCalledWith('global orig warn');
    expect(mockOriginalError).toHaveBeenCalledWith('global orig error');

    delete (globalThis as any)._originalConsoleLog;
    delete (globalThis as any)._originalConsoleWarn;
    delete (globalThis as any)._originalConsoleError;
  });

  it('handles catch blocks and native forwarders when addLog throws or original methods equal console', () => {
    const mockOriginalError = vi.fn();
    const mockOriginalWarn = vi.fn();
    const mockOriginalLog = vi.fn();

    (globalThis as any)._originalConsoleLog = mockOriginalLog;
    (globalThis as any)._originalConsoleWarn = mockOriginalWarn;
    (globalThis as any)._originalConsoleError = mockOriginalError;

    setupConsoleOverrides();

    // Trigger catch in console.error with mockOriginalError defined
    addLogSpy.mockImplementationOnce(() => { throw new Error('Error in addLog'); });
    console.error('Boom error');
    expect(mockOriginalError).toHaveBeenCalledWith('Failed to capture error log:', expect.any(Error));

    // Trigger catch in console.warn with mockOriginalError defined
    addLogSpy.mockImplementationOnce(() => { throw new Error('Warn in addLog'); });
    console.warn('Boom warn');
    expect(mockOriginalError).toHaveBeenCalledWith('Failed to capture warn log:', expect.any(Error));

    // Trigger catch in console.log with mockOriginalError defined
    addLogSpy.mockImplementationOnce(() => { throw new Error('Log in addLog'); });
    console.log('Boom log');
    expect(mockOriginalError).toHaveBeenCalledWith('Failed to capture info log:', expect.any(Error));

    // Test branches when original methods are equal to console.* or undefined (no recursive forwarding)
    delete (globalThis as any)._originalConsoleLog;
    delete (globalThis as any)._originalConsoleWarn;
    delete (globalThis as any)._originalConsoleError;

    setupConsoleOverrides();

    // Catch blocks when originalError is console.error / undefined
    addLogSpy.mockImplementationOnce(() => { throw new Error('Silent error'); });
    expect(() => console.error('Silent error')).not.toThrow();

    addLogSpy.mockImplementationOnce(() => { throw new Error('Silent warn'); });
    expect(() => console.warn('Silent warn')).not.toThrow();

    addLogSpy.mockImplementationOnce(() => { throw new Error('Silent log'); });
    expect(() => console.log('Silent log')).not.toThrow();

    // Normal console calls without custom original handler (original is console.* so it doesn't loop)
    console.error('Normal error');
    console.warn('Normal warn');
    console.log('Normal info');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'Normal error');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'Normal warn');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'Normal info');
  });

  it('initializes main logger with initMainLogger', () => {
    expect(() => initMainLogger()).not.toThrow();
  });

  it('covers fallbacks when original console methods are initially absent', async () => {
    delete (globalThis as any)._originalConsoleLog;
    delete (globalThis as any)._originalConsoleWarn;
    delete (globalThis as any)._originalConsoleError;

    vi.resetModules();
    const freshLogger = await import('@/activities/ui/mainLogger');

    // First call: storedOriginal* is null and _originalConsole* is undefined, so it takes console.*
    expect(() => freshLogger.setupConsoleOverrides()).not.toThrow();

    // Second call: storedOriginal* is now truthy, so it takes storedOriginal*
    expect(() => freshLogger.setupConsoleOverrides()).not.toThrow();

    // When addLog throws with originalError === console.error (false branches in catch and outside catch)
    addLogSpy.mockImplementationOnce(() => { throw new Error('Fail err'); });
    console.error('Test error false branch');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'Test error false branch');

    addLogSpy.mockImplementationOnce(() => { throw new Error('Fail warn'); });
    console.warn('Test warn false branch');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'Test warn false branch');

    addLogSpy.mockImplementationOnce(() => { throw new Error('Fail log'); });
    console.log('Test log false branch');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'Test log false branch');

    // Without throw, calls console.* when original === console.* (false branches outside catch)
    console.error('Normal error false branch');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'Normal error false branch');

    console.warn('Normal warn false branch');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'Normal warn false branch');

    console.log('Normal info false branch');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'Normal info false branch');
  });

  it('covers else branches when global methods are set to the current console methods', () => {
    setupConsoleOverrides();

    // Set _originalConsole* to the current console functions (so originalX === console.x)
    (globalThis as any)._originalConsoleError = console.error;
    (globalThis as any)._originalConsoleWarn = console.warn;
    (globalThis as any)._originalConsoleLog = console.log;

    // Normal calls: won't forward to original because originalX === console.x
    console.error('No forward error');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'No forward error');

    console.warn('No forward warn');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'No forward warn');

    console.log('No forward log');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'No forward log');

    // Throws during addLog: won't call originalError in catch because originalError === console.error
    addLogSpy.mockImplementationOnce(() => { throw new Error('Throw error'); });
    console.error('Catch no forward error');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'Catch no forward error');

    addLogSpy.mockImplementationOnce(() => { throw new Error('Throw warn'); });
    console.warn('Catch no forward warn');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'Catch no forward warn');

    addLogSpy.mockImplementationOnce(() => { throw new Error('Throw log'); });
    console.log('Catch no forward log');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'Catch no forward log');

    delete (globalThis as any)._originalConsoleError;
    delete (globalThis as any)._originalConsoleWarn;
    delete (globalThis as any)._originalConsoleLog;
  });
});

