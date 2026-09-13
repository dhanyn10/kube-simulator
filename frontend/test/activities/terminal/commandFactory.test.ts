import { describe, it, expect, vi } from 'vitest';
import { Node } from '@xyflow/react';
import {
  TerminalCommandFactory,
  createDefaultTerminalCommandFactory,
  ICommandHandler,
} from '@/activities/terminal/commandFactory';
import { CommandContext } from '@/activities/terminal/terminalCommands';

describe('TerminalCommandFactory', () => {
  const mockNodes: Node[] = [
    { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'My Pod', status: 'Running' } },
  ];

  const createMockContext = (cmd: string): { ctx: CommandContext; logs: string[] } => {
    const logs: string[] = [];
    const ctx: CommandContext = {
      cmd: cmd || '',
      cmdLower: (cmd || '').toLowerCase(),
      nodes: mockNodes,
      isSimulating: true,
      addActivityLog: (line: string) => logs.push(line),
      getStoreState: () => ({ isAdminAuthenticated: false } as any),
      setStoreState: vi.fn(),
      updateNodeData: vi.fn(),
    };
    return { ctx, logs };
  };

  it('executes registered command handlers sequentially', () => {
    const factory = new TerminalCommandFactory();
    const handledLogs: string[] = [];

    const customHandler: ICommandHandler = {
      handle: (ctx: CommandContext) => {
        if (ctx.cmdLower === 'custom') {
          ctx.addActivityLog('custom handled');
          return true;
        }
        return false;
      },
    };

    factory.register(customHandler);

    const { ctx, logs } = createMockContext('custom');
    const result = factory.execute(ctx);

    expect(result).toBe(true);
    expect(logs).toContain('custom handled');
  });

  it('returns false when no handler handles the command', () => {
    const factory = new TerminalCommandFactory();
    const { ctx } = createMockContext('unknown');
    expect(factory.execute(ctx)).toBe(false);
  });

  it('createDefaultTerminalCommandFactory dispatches standard commands', () => {
    const factory = createDefaultTerminalCommandFactory({
      nodes: mockNodes,
      isSimulating: true,
      historyEntries: [],
      setTerminalSelectedResourceId: vi.fn(),
      setTerminalActiveTab: vi.fn(),
    });

    const { ctx: helpCtx, logs: helpLogs } = createMockContext('help');
    expect(factory.execute(helpCtx)).toBe(true);
    expect(helpLogs.some(l => l.includes('Available educational Kubernetes commands'))).toBe(true);

    const { ctx: getCtx, logs: getLogs } = createMockContext('kubectl get pods');
    expect(factory.execute(getCtx)).toBe(true);
    expect(getLogs.some(l => l.includes('My Pod'))).toBe(true);
  });
});
