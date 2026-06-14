import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@/lib/logger';
import { useFlowStore } from '@/store';

describe('Frontend logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds info logs to the store', () => {
    const addLog = vi.spyOn(useFlowStore.getState(), 'addLog');
    logger.info('test info');
    expect(addLog).toHaveBeenCalledWith('info', 'test info');
  });

  it('adds warn logs to the store', () => {
    const addLog = vi.spyOn(useFlowStore.getState(), 'addLog');
    logger.warn('test warn');
    expect(addLog).toHaveBeenCalledWith('warn', 'test warn');
  });

  it('adds error logs to the store', () => {
    const addLog = vi.spyOn(useFlowStore.getState(), 'addLog');
    logger.error('test error');
    expect(addLog).toHaveBeenCalledWith('error', 'test error');
  });

  it('formats messages with arguments', () => {
    const addLog = vi.spyOn(useFlowStore.getState(), 'addLog');
    logger.info('test', 123, { a: 1 });
    expect(addLog).toHaveBeenCalledWith('info', 'test 123 {"a":1}');
  });

  it('handles Error objects in arguments', () => {
    const addLog = vi.spyOn(useFlowStore.getState(), 'addLog');
    const err = new Error('boom');
    logger.error('test error', err);

    const callArg = addLog.mock.calls[0][1];
    expect(callArg).toContain('test error Error: boom');
    expect(callArg).toContain('logger.test.ts');
  });

  it('handles circular objects', () => {
    const addLog = vi.spyOn(useFlowStore.getState(), 'addLog');
    const obj: any = { a: 1 };
    obj.self = obj;
    logger.info('circular', obj);
    expect(addLog).toHaveBeenCalledWith('info', 'circular [Circular Object]');
  });
});
