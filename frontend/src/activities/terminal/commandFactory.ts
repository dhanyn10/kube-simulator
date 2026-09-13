import { Node } from '@xyflow/react';
import { CommandContext } from './terminalCommands';
import {
  handleDescribeCommand,
  handleGetCommands,
  handleHelpCommand,
  handleHistoryCommand,
  handleLogsCommand,
} from './terminalHandlers';
import { handleKubectlConfigCommand } from './terminalConfigCommands';
import { CommandHistoryEntry } from './terminalLogUtils';

/**
 * Interface representing a CLI command handler in the terminal command factory system.
 */
export interface ICommandHandler {
  /**
   * Executes the command if matched.
   *
   * @param ctx - Execution context containing command string, logger, store getters, and handlers.
   * @returns True if command was matched and processed; false otherwise.
   */
  handle(ctx: CommandContext): boolean;
}

/**
 * Options required when building standard command handlers.
 */
export interface CommandHandlerOptions {
  readonly nodes: Node[];
  readonly isSimulating: boolean;
  readonly historyEntries: CommandHistoryEntry[];
  readonly setTerminalSelectedResourceId: (id: string | null) => void;
  readonly setTerminalActiveTab: (tab: 'activity' | 'logs') => void;
}

/**
 * Handler for 'kubectl get' commands.
 */
export class GetCommandHandler implements ICommandHandler {
  handle(ctx: CommandContext): boolean {
    return handleGetCommands(
      ctx.cmdLower,
      ctx.addActivityLog,
      ctx.nodes,
      ctx.isSimulating
    );
  }
}

/**
 * Handler for 'kubectl describe' commands.
 */
export class DescribeCommandHandler implements ICommandHandler {
  handle(ctx: CommandContext): boolean {
    return handleDescribeCommand(
      ctx.cmd,
      ctx.addActivityLog,
      ctx.nodes,
      ctx.isSimulating
    );
  }
}

/**
 * Handler for 'kubectl logs' commands.
 */
export class LogsCommandHandler implements ICommandHandler {
  constructor(private readonly options: CommandHandlerOptions) {}

  handle(ctx: CommandContext): boolean {
    return handleLogsCommand(
      ctx.cmd,
      ctx.addActivityLog,
      ctx.nodes,
      this.options.setTerminalSelectedResourceId,
      this.options.setTerminalActiveTab
    );
  }
}

/**
 * Handler for 'kubectl config' commands.
 */
export class ConfigCommandHandler implements ICommandHandler {
  handle(ctx: CommandContext): boolean {
    return handleKubectlConfigCommand(ctx.cmd || '', ctx);
  }
}

/**
 * Handler for 'history' command.
 */
export class HistoryCommandHandler implements ICommandHandler {
  constructor(private readonly historyEntries: CommandHistoryEntry[]) {}

  handle(ctx: CommandContext): boolean {
    return handleHistoryCommand(ctx.cmdLower, this.historyEntries, ctx.addActivityLog);
  }
}

/**
 * Handler for 'help' command.
 */
export class HelpCommandHandler implements ICommandHandler {
  handle(ctx: CommandContext): boolean {
    return handleHelpCommand(ctx.cmdLower, ctx);
  }
}

/**
 * Factory class managing registration and execution of terminal command handlers.
 */
export class TerminalCommandFactory {
  private readonly handlers: ICommandHandler[] = [];

  /**
   * Registers a command handler in the factory pipeline.
   *
   * @param handler - Instance implementing ICommandHandler.
   */
  register(handler: ICommandHandler): void {
    if (handler) {
      this.handlers.push(handler);
    }
  }

  /**
   * Executes registered command handlers sequentially until one handles the command context.
   *
   * @param ctx - Command execution context.
   * @returns True if a handler processed the command; false otherwise.
   */
  execute(ctx: CommandContext): boolean {
    for (const handler of this.handlers) {
      if (handler.handle(ctx)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Creates and initializes a default TerminalCommandFactory configured with standard handlers.
 *
 * @param options - Required options for command handlers.
 * @returns Configured TerminalCommandFactory instance.
 */
export const createDefaultTerminalCommandFactory = (options: CommandHandlerOptions): TerminalCommandFactory => {
  const factory = new TerminalCommandFactory();
  factory.register(new ConfigCommandHandler());
  factory.register(new GetCommandHandler());
  factory.register(new DescribeCommandHandler());
  factory.register(new LogsCommandHandler(options));
  factory.register(new HistoryCommandHandler(options.historyEntries));
  factory.register(new HelpCommandHandler());
  return factory;
};
