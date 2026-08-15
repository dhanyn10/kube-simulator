import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
  })),
}));

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/App', () => ({
  default: () => <div>App</div>,
}));

// We need to mock these before main.tsx is imported
const addLogSpy = vi.fn();
vi.mock('@/store', () => ({
  useFlowStore: {
    getState: vi.fn(() => ({
      addLog: addLogSpy,
    })),
    setState: vi.fn(),
  },
}));

const mockEventsOn = vi.fn();
vi.mock('../wailsjs/runtime', () => ({
  EventsOn: mockEventsOn,
}));

const mockInitWailsMocks = vi.fn();
vi.mock('@/lib/mocks', () => ({
  initWailsMocks: mockInitWailsMocks,
}));

// Mock init-console to avoid real console capture during tests
vi.mock('@/init-console', () => ({
    originalLog: vi.fn(),
    originalWarn: vi.fn(),
    originalError: vi.fn(),
}));

describe('main.tsx entry point', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset modules to allow re-importing main.tsx
    vi.resetModules();

    // Setup DOM
    document.body.innerHTML = '<div id="root"></div>';

    // We need to use globalThis because main.tsx uses it
    (globalThis as any)._originalConsoleLog = vi.fn();
    (globalThis as any)._originalConsoleWarn = vi.fn();
    (globalThis as any)._originalConsoleError = vi.fn();
  });

  it('initializes the application', async () => {
    const { createRoot } = await import('react-dom/client');
    const { initWailsMocks } = await import('@/lib/mocks');

    // Import main.tsx to trigger its side effects
    await import('@/main');

    expect(initWailsMocks).toHaveBeenCalled();
    expect(mockEventsOn).toHaveBeenCalledWith('backend-log', expect.any(Function));
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
  });

  it('captures console logs and adds them to the store', async () => {
    // Ensure main is loaded
    await import('@/main');

    console.log('test log');
    expect(addLogSpy).toHaveBeenCalledWith('info', 'test log');

    console.warn('test warn');
    expect(addLogSpy).toHaveBeenCalledWith('warn', 'test warn');

    console.error('test error');
    expect(addLogSpy).toHaveBeenCalledWith('error', 'test error');
  });

  it('formats complex log messages correctly', async () => {
    await import('@/main');

    console.log('string', { a: 1 }, new Error('boom'));
    const lastCall = addLogSpy.mock.calls.at(-1);
    expect(lastCall[1]).toContain('string');
    expect(lastCall[1]).toContain('{"a":1}');
    expect(lastCall[1]).toContain('Error: boom');
  });

  it('handles unserializable objects in logs', async () => {
    await import('@/main');

    const circular: any = {};
    circular.self = circular;

    console.log(circular);
    const lastCall = addLogSpy.mock.calls.at(-1);
    expect(lastCall[1]).toBe('[Unserializable Object]');
  });

  it('handles backend log events', async () => {
    await import('@/main');

    // Get the callback passed to EventsOn
    const callback = mockEventsOn.mock.calls.find((call: any) => call[0] === 'backend-log')[1];

    callback({ level: 'info', message: 'backend message' });
    expect(addLogSpy).toHaveBeenCalledWith('info', 'backend message', 'Backend');

    callback({ level: 'fatal', message: 'fatal error' });
    expect(addLogSpy).toHaveBeenCalledWith('error', 'fatal error', 'Backend');
  });
});
