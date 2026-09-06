import { useState, useCallback } from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '../../../store';
import {
  CommandContext,
  handleAdminCommands,
  handleGetAllCommand,
  handleScaleCommand,
  handleSetImageCommand,
  handleRolloutStatusCommand,
  handleRolloutHistoryCommand,
  handleRolloutUndoCommand,
  handleDeletePodCommand,
  handleDescribeDeploymentCommand,
  handleGetRolesCommand,
  handleDescribeRoleCommand,
  handleGetConfigMapsCommand,
  handleDescribeConfigMapCommand,
  handleGetSecretsCommand,
  handleDescribeSecretCommand,
} from './terminalCommands';
import {
  handleHelpCommand,
  handleHistoryCommand,
  handleGetCommands,
  handleLogsCommand,
  handleDescribeCommand,
} from './terminalHandlers';
import { CommandHistoryEntry, formatCommandTimestamp } from './terminalLogUtils';

export const executeKubectlCommand = (
  cmd: string,
  ctx: CommandContext,
  setTerminalSelectedResourceId: (id: string | null) => void,
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void,
  historyEntries: CommandHistoryEntry[] = []
) => {
  const cmdLower = cmd.toLowerCase();

  if (handleHelpCommand(cmdLower, ctx)) {
    return;
  }

  if (handleHistoryCommand(cmdLower, historyEntries, ctx.addActivityLog)) {
    return;
  }

  const commandHandlers = [
    handleAdminCommands,
    handleGetAllCommand,
    handleScaleCommand,
    handleSetImageCommand,
    handleRolloutStatusCommand,
    handleRolloutHistoryCommand,
    handleRolloutUndoCommand,
    handleDeletePodCommand,
    handleDescribeDeploymentCommand,
    handleGetRolesCommand,
    handleDescribeRoleCommand,
    handleGetConfigMapsCommand,
    handleDescribeConfigMapCommand,
    handleGetSecretsCommand,
    handleDescribeSecretCommand,
  ];

  for (const handler of commandHandlers) {
    if (handler(cmd, ctx)) return;
  }

  if (handleGetCommands(cmdLower, ctx.addActivityLog, ctx.nodes, ctx.isSimulating)) {
    return;
  }

  if (handleLogsCommand(cmd, ctx.addActivityLog, ctx.nodes, setTerminalSelectedResourceId, setTerminalActiveTab)) {
    return;
  }

  if (handleDescribeCommand(cmd, ctx.addActivityLog, ctx.nodes, ctx.isSimulating)) {
    return;
  }

  ctx.addActivityLog(`kubectl-mock: command not found: "${cmd}". Type "help" to see available commands.`);
};

export const useTerminalCommandSubmit = (
  nodes: Node[],
  isSimulating: boolean,
  clearTerminalLogs: () => void,
  setTerminalSelectedResourceId: (id: string | null) => void,
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void
) => {
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [commandHistoryEntries, setCommandHistoryEntries] = useState<CommandHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const processCommandSubmit = useCallback((
    cmdInput: string,
    setIsDropdownOpen: (open: boolean) => void,
    setIsNavigatingHistory: (navigating: boolean) => void
  ) => {
    const cmd = cmdInput.trim();
    setIsDropdownOpen(false);
    setIsNavigatingHistory(false);
    if (!cmd) return;

    setCommandInput('');

    const timestamp = formatCommandTimestamp();
    const newEntry: CommandHistoryEntry = {
      id: String(commandHistoryEntries.length + 1),
      command: cmd,
      timestamp,
    };

    const nextHistoryEntries = [...commandHistoryEntries, newEntry];
    setCommandHistoryEntries(nextHistoryEntries);
    setCommandHistory(prev => (prev.at(-1) === cmd ? prev : [...prev, cmd]));
    setHistoryIndex(-1);

    const addActivityLog = useFlowStore.getState().addActivityLog;
    addActivityLog(`$ ${cmd}`);

    const wailsApp = globalThis.go?.main?.App as unknown as { WriteLog?: (cat: string, level: string, msg: string) => Promise<void> };
    if (wailsApp?.WriteLog) {
      wailsApp.WriteLog('kubeconsole', 'info', `${timestamp} $ ${cmd}`).catch(() => {});
    }

    if (cmd.toLowerCase() === 'clear') {
      clearTerminalLogs();
      return;
    }

    const ctx: CommandContext = {
      nodes,
      isSimulating,
      addActivityLog,
      getStoreState: () => useFlowStore.getState(),
      setStoreState: (partial) => useFlowStore.setState(partial),
      updateNodeData: (id, data) => useFlowStore.getState().updateNodeData(id, data),
    };

    executeKubectlCommand(cmd, ctx, setTerminalSelectedResourceId, setTerminalActiveTab, nextHistoryEntries);
  }, [nodes, isSimulating, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab, commandHistoryEntries]);

  return {
    commandInput,
    setCommandInput,
    commandHistory,
    commandHistoryEntries,
    historyIndex,
    setHistoryIndex,
    processCommandSubmit,
  };
};
