import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '../../store';
import { cn, safeRandom, sanitizeSlug, cleanProjectName } from '../../lib/utils';
import { Terminal, X, Trash2, Search, Box, Layers, Play, Download, TerminalSquare, Info } from 'lucide-react';
import './TerminalPanel.css';
import {
  CommandContext,
  handleAdminCommands,
  handleScaleCommand,
  handleSetImageCommand,
  handleRolloutStatusCommand,
  handleRolloutHistoryCommand,
  handleRolloutUndoCommand,
  handleDeletePodCommand,
  handleGetAllCommand,
  handleDescribeDeploymentCommand,
  handleGetRolesCommand,
  handleDescribeRoleCommand,
  handleGetConfigMapsCommand,
  handleDescribeConfigMapCommand,
  handleGetSecretsCommand,
  handleDescribeSecretCommand
} from './terminalCommands';
import { getAutocompleteSuggestions, SuggestionItem } from './terminalAutocomplete';

// Helper functions to handle kubectl commands and reduce cognitive complexity of TerminalPanel

export const handleGetPods = (addActivityLog: (line: string) => void, nodes: Node[], isSimulating: boolean) => {
  const workloads = nodes.filter(n => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet');
  if (workloads.length === 0) {
    addActivityLog('No pods or workloads found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(38)} READY   STATUS              RESTARTS   AGE`);
  workloads.forEach(w => {
    const name = (w.data?.label as string) || w.id;
    const status = (w.data?.status as string) || (isSimulating ? 'Running' : 'Pending');
    const ready = status === 'ready' || status === 'Running' ? '1/1' : '0/1';
    let displayStatus = status;
    if (status === 'ready') {
      displayStatus = 'Running';
    } else if (status === 'pending') {
      displayStatus = 'Pending';
    }
    addActivityLog(`${String(name).padEnd(38)} ${ready.padEnd(7)} ${displayStatus.padEnd(19)} 0          45s`);
  });
};

export const handleGetDeployments = (addActivityLog: (line: string) => void, nodes: Node[], isSimulating: boolean) => {
  const deploys = nodes.filter(n => n.type === 'Deployment');
  if (deploys.length === 0) {
    addActivityLog('No deployments found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(30)} READY   UP-TO-DATE   AVAILABLE   AGE`);
  deploys.forEach(d => {
    const name = (d.data?.label as string) || d.id;
    const replicas = (d.data?.replicas as number) || 1;
    const status = isSimulating ? `${replicas}/${replicas}` : `0/${replicas}`;
    addActivityLog(`${String(name).padEnd(30)} ${status.padEnd(7)} ${String(replicas).padEnd(12)} ${String(isSimulating ? replicas : 0).padEnd(11)} 2m`);
  });
};

export const handleGetServices = (addActivityLog: (line: string) => void, nodes: Node[]) => {
  const svcs = nodes.filter(n => n.type === 'Service');
  if (svcs.length === 0) {
    addActivityLog('No services found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(30)} TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)`);
  svcs.forEach(s => {
    const name = (s.data?.label as string) || s.id;
    const port = (s.data?.port as number) || 80;
    addActivityLog(`${String(name).padEnd(30)} ClusterIP   10.96.4.52   <none>        ${port}/TCP`);
  });
};

export const handleGetCommands = (
  cmdLower: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  isSimulating: boolean
): boolean => {
  const isPodGet = ['kubectl get pods', 'kubectl get pod', 'kubectl get pods -w', 'kubectl get pod -w'].includes(cmdLower);
  if (isPodGet) {
    handleGetPods(addActivityLog, nodes, isSimulating);
    return true;
  }

  const isDeployGet = ['kubectl get deployments', 'kubectl get deployment', 'kubectl get deploy'].includes(cmdLower);
  if (isDeployGet) {
    handleGetDeployments(addActivityLog, nodes, isSimulating);
    return true;
  }

  const isSvcGet = ['kubectl get services', 'kubectl get service', 'kubectl get svc'].includes(cmdLower);
  if (isSvcGet) {
    handleGetServices(addActivityLog, nodes);
    return true;
  }

  return false;
};

const cleanLogTargetName = (rawName: string): string => {
  const name = rawName.toLowerCase();
  if (name.startsWith('pod/')) return name.substring(4);
  if (name.startsWith('deployment/')) return name.substring(11);
  if (name.startsWith('deploy/')) return name.substring(7);
  return name;
};

const isLoggableNode = (n: Node, targetName: string): boolean => {
  if (!['Pod', 'Deployment', 'ReplicaSet'].includes(n.type)) return false;
  const label = n.data?.label ? String(n.data.label).toLowerCase() : '';
  return n.id.toLowerCase() === targetName || label === targetName;
};

export const handleLogsCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  setTerminalSelectedResourceId: (id: string | null) => void,
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void
): boolean => {
  const logsMatch = /^kubectl\s+logs\s+([-a-z0-9/]+)/i.exec(cmd);
  if (!logsMatch) return false;

  const targetName = cleanLogTargetName(logsMatch[1]);
  const foundNode = nodes.find(n => isLoggableNode(n, targetName));

  if (foundNode) {
    setTerminalSelectedResourceId(foundNode.id);
    setTerminalActiveTab('logs');
    addActivityLog(`Switched console output stream to logs for resource: ${foundNode.type.toLowerCase()}/${targetName}`);
  } else {
    addActivityLog(`Error from server (NotFound): resource "${targetName}" not found`);
  }
  return true;
};

export { trimDashes, sanitizeSlug, cleanProjectName } from '../../lib/utils';

export const generateLogFilename = (
  projectName?: string | null,
  activeTab?: 'activity' | 'logs',
  resourceName?: string
): string => {
  let prefix = activeTab === 'activity' ? 'activity-history' : 'resource-logs';
  if (projectName) {
    const cleanProject = cleanProjectName(projectName);
    if (cleanProject) {
      prefix = `${prefix}-${cleanProject}`;
    }
  }
  if (activeTab === 'logs' && resourceName) {
    const cleanResource = sanitizeSlug(String(resourceName).toLowerCase());
    if (cleanResource) {
      prefix = `${prefix}-${cleanResource}`;
    }
  }

  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 8).replaceAll(':', '-');
  return `${prefix}_${dateStr}_${timeStr}.log`;
};

export const makeDivider = (char = '-', length = 50): string => char.repeat(length);

export const exportLogFile = (logs: string[], filename: string) => {
  const fileHeader = `# Kube Simulator Log Output\n# File: ${filename}\n# Exported At: ${new Date().toISOString()}\n# Total Lines: ${logs.length}\n${makeDivider('-', 50)}\n`;
  const content = fileHeader + (logs.length > 0 ? logs.join('\n') : '# No log entries recorded');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export interface CommandHistoryEntry {
  id: number;
  command: string;
  timestamp: string;
}

export const formatCommandTimestamp = (d = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const handleHistoryCommand = (
  cmdLower: string,
  historyEntries: CommandHistoryEntry[],
  addActivityLog: (line: string) => void
): boolean => {
  if (cmdLower !== 'history') return false;
  if (historyEntries.length === 0) {
    addActivityLog('No command history recorded.');
    return true;
  }
  historyEntries.forEach((entry) => {
    const paddedId = String(entry.id).padStart(5, ' ');
    addActivityLog(`${paddedId}  ${entry.timestamp}  ${entry.command}`);
  });
  return true;
};

export const handleHelpCommand = (cmdLower: string, addActivityLogOrCtx: ((line: string) => void) | CommandContext): boolean => {
  if (cmdLower !== 'help') return false;

  let addActivityLog: (line: string) => void;
  let isAdmin = false;

  if (typeof addActivityLogOrCtx === 'function') {
    addActivityLog = addActivityLogOrCtx;
  } else {
    addActivityLog = addActivityLogOrCtx.addActivityLog;
    const store = addActivityLogOrCtx.getStoreState();
    isAdmin = store.isAdminAuthenticated;
  }

  if (isAdmin) {
    addActivityLog('Admin CLI Commands:');
    addActivityLog('  try version update <version>          Simulate update notification button (e.g. try version update 0.4.0)');
    addActivityLog('  try version current <version>         Simulate current application version (e.g. try version current 0.3.0)');
    addActivityLog('  try version clear                     Clear simulated current version');
    addActivityLog('  try clear                             Clear all simulated version settings');
    addActivityLog('  try status                            View secret mode status');
    addActivityLog('  logout / exit                         Exit Admin Mode and return to standard CLI');
    return true;
  }

  addActivityLog('Available educational Kubernetes commands:');
  addActivityLog('  kubectl get pods                      List all pods on the canvas');
  addActivityLog('  kubectl get deployments               List deployments on the canvas');
  addActivityLog('  kubectl get services                  List services on the canvas');
  addActivityLog('  kubectl get all                       List all resources on the canvas');
  addActivityLog('  kubectl scale deployment/<name>       Scale replicas of a deployment');
  addActivityLog('  kubectl set image deployment/<name>   Set container image (triggers Rolling Update)');
  addActivityLog('  kubectl rollout status deploy/<name>  Check progress of a rolling update');
  addActivityLog('  kubectl rollout history deploy/<name> View rollout revision history');
  addActivityLog('  kubectl rollout undo deploy/<name>    Rollback to the previous deployment revision');
  addActivityLog('  kubectl delete pod <name>             Delete pod (triggers replica controller self-healing)');
  addActivityLog('  kubectl get roles                     List all roles on the canvas');
  addActivityLog('  kubectl get rolebindings              List role bindings on the canvas');
  addActivityLog('  kubectl describe role <name>          Describe role specifications & rules');
  addActivityLog('  kubectl get configmaps                List all configmaps on the canvas');
  addActivityLog('  kubectl describe cm <name>            Describe configmap specifications & data');
  addActivityLog('  kubectl get secrets                   List all secrets on the canvas');
  addActivityLog('  kubectl describe secret <name>        Describe secret specifications & data');
  addActivityLog('  kubectl logs <pod-name>               Stream live container stdout logs');
  addActivityLog('  kubectl describe deploy <name>        Describe deployment specifications');
  addActivityLog('  kubectl describe pod <name>           Describe pod specifications & events');
  addActivityLog('  history                               View command execution history with timestamps');
  addActivityLog('  clear                                 Clear the console log list');

  return true;
};

const LOG_COLORS = {
  command: { dark: 'text-cyan-400 font-bold', light: 'text-cyan-600 font-bold' },
  error: { dark: 'text-red-400', light: 'text-red-600' },
  warning: { dark: 'text-amber-400', light: 'text-amber-600' },
  success: { dark: 'text-emerald-400', light: 'text-emerald-600' },
  default: { dark: 'text-slate-300', light: 'text-slate-700' },
};

const getLineType = (line: string): keyof typeof LOG_COLORS => {
  if (line.startsWith('$')) return 'command';
  const lineLower = line.toLowerCase();
  if (/(?:error|fatal|failed)/i.test(lineLower)) return 'error';
  if (/(?:warning|warn|throttled|oom risk)/i.test(lineLower)) return 'warning';
  if (/(?:created|running|ready|successfully|deleted)/i.test(lineLower)) return 'success';
  return 'default';
};

export const getLogLineColorClass = (line: string, colorMode: 'dark' | 'light'): string => {
  const lineType = getLineType(line);
  return LOG_COLORS[lineType][colorMode];
};

export const formatLogLineContent = (line: string, colorMode: 'dark' | 'light', searchQuery: string): React.ReactNode => {
  const textClass = getLogLineColorClass(line, colorMode);

  if (!searchQuery) {
    return <span className={textClass}>{line}</span>;
  }

  const q = searchQuery.toLowerCase();
  const escapedSearch = searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
  const parts = line.split(new RegExp(`(${escapedSearch})`, 'gi'));
  const partsWithObjects = parts.map((part, index) => ({
    key: `highlight-part-${index}-${part}`,
    text: part,
    isMatch: part.toLowerCase() === q,
  }));

  return (
    <span className={textClass}>
      {partsWithObjects.map((item) => {
        if (item.isMatch) {
          return <mark key={item.key} className="bg-yellow-500 text-black px-0.5 rounded">{item.text}</mark>;
        }
        return item.text;
      })}
    </span>
  );
};

interface TerminalLogBodyProps {
  isSimulating: boolean;
  terminalActiveTab: 'activity' | 'logs';
  activeLogs: string[];
  loggableResources: Node[];
  paginatedLogs: string[];
  searchQuery: string;
  colorMode: 'dark' | 'light';
  startSimulation: () => void;
  currentPage: number;
  pageSize: number;
}

export const TerminalLogBody = ({
  isSimulating,
  terminalActiveTab,
  activeLogs,
  loggableResources,
  paginatedLogs,
  searchQuery,
  colorMode,
  startSimulation,
  currentPage,
  pageSize,
}: TerminalLogBodyProps) => {
  if (!isSimulating && terminalActiveTab === 'activity' && activeLogs.length === 0) {
    return (
      <div className={cn(
        "terminal-empty-state",
        colorMode === 'dark' ? "text-slate-600" : "text-slate-400"
      )}>
        <Box size={24} className="opacity-25" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Terminal Idle</p>
          <p className="text-[10px] max-w-xs">Click the "Play" button in the top menu to apply manifests and start cluster operations, or type commands below.</p>
        </div>
        <button
          type="button"
          onClick={() => startSimulation()}
          className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider shadow"
        >
          <Play size={10} fill="currentColor" /> Apply Manifests
        </button>
      </div>
    );
  }

  if (terminalActiveTab === 'logs' && loggableResources.length === 0) {
    return (
      <div className={cn(
        "terminal-empty-state",
        colorMode === 'dark' ? "text-slate-600" : "text-slate-400"
      )}>
        <Layers size={24} className="opacity-25" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wider">No Loggable Resources</p>
          <p className="text-[10px] max-w-xs">Add a Pod, Deployment, or ReplicaSet to the canvas to view container logs.</p>
        </div>
      </div>
    );
  }

  if (paginatedLogs.length === 0) {
    return (
      <div className={cn(
        "h-full flex items-center justify-center",
        colorMode === 'dark' ? "text-slate-600" : "text-slate-400"
      )}>
        <span className="text-[10px] uppercase font-bold tracking-wider">
          {searchQuery ? "No matches found" : "Waiting for log stream..."}
        </span>
      </div>
    );
  }

  return (
    <>
      {paginatedLogs.map((line, index) => {
        const actualIndex = terminalActiveTab === 'logs'
          ? (currentPage - 1) * pageSize + index
          : index;
        const key = `log-${terminalActiveTab}-${actualIndex}-${line}`;
        return (
          <div key={key} className="flex items-start gap-2 whitespace-pre-wrap select-text leading-relaxed">
            {formatLogLineContent(line, colorMode, searchQuery)}
          </div>
        );
      })}
    </>
  );
};

export interface HandleTerminalKeyDownOptions {
  e: React.KeyboardEvent<HTMLInputElement>;
  commandHistory: string[];
  historyIndex: number;
  setHistoryIndex: (idx: number) => void;
  setCommandInput: (val: string) => void;
  suggestions?: SuggestionItem[];
  selectedIndex?: number;
  setSelectedIndex?: (idx: number) => void;
  selectedSubIndex?: number;
  setSelectedSubIndex?: React.Dispatch<React.SetStateAction<number>>;
  isDropdownOpen?: boolean;
  setIsDropdownOpen?: (open: boolean) => void;
  setIsNavigatingHistory?: (navigating: boolean) => void;
}

interface HandleTabKeyOptions {
  e: React.KeyboardEvent<HTMLInputElement>;
  isDropdownOpen: boolean;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  selectedSubIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setSelectedSubIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsDropdownOpen: (open: boolean) => void;
}

const handleTabKey = (opts: HandleTabKeyOptions) => {
  const {
    e,
    isDropdownOpen,
    suggestions,
    selectedIndex,
    setSelectedIndex,
    setSelectedSubIndex,
    setIsDropdownOpen,
  } = opts;

  if (suggestions.length === 0) return;

  if (!isDropdownOpen) {
    setIsDropdownOpen(true);
    setSelectedIndex(0);
    setSelectedSubIndex(0);
    return;
  }

  const activeIndex = Math.max(0, selectedIndex);
  const activeItem = suggestions[activeIndex];
  const subCount = activeItem?.subItems?.length || 0;

  if (e.shiftKey) {
    if (subCount > 0) {
      setSelectedSubIndex(prev => (prev <= 0 ? subCount - 1 : prev - 1));
    } else {
      setSelectedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      setSelectedSubIndex(0);
    }
  } else if (subCount > 0) {
    setSelectedSubIndex(prev => (prev >= subCount - 1 ? 0 : prev + 1));
  } else {
    setSelectedIndex(prev => (prev >= suggestions.length - 1 ? 0 : prev + 1));
    setSelectedSubIndex(0);
  }
};

interface HandleDropdownKeysOptions {
  e: React.KeyboardEvent<HTMLInputElement>;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  selectedSubIndex: number;
  setSelectedIndex: (idx: number) => void;
  setSelectedSubIndex: React.Dispatch<React.SetStateAction<number>>;
  setCommandInput: (val: string) => void;
  setIsDropdownOpen: (open: boolean) => void;
}

const handleEnterDropdownKey = (
  activeItem: SuggestionItem | undefined,
  selectedSubIndex: number,
  setCommandInput: (val: string) => void,
  setIsDropdownOpen: (open: boolean) => void
) => {
  if (activeItem) {
    if (activeItem.subItems && activeItem.subItems.length > 0) {
      const podName = activeItem.subItems[selectedSubIndex] || activeItem.subItems[0];
      setCommandInput(`kubectl logs ${podName}`);
    } else {
      setCommandInput(activeItem.value);
    }
    setIsDropdownOpen(false);
  }
};

const handleDropdownKeys = (opts: HandleDropdownKeysOptions): boolean => {
  const {
    e,
    suggestions,
    selectedIndex,
    selectedSubIndex,
    setSelectedIndex,
    setSelectedSubIndex,
    setCommandInput,
    setIsDropdownOpen,
  } = opts;

  const activeIndex = Math.max(0, selectedIndex);
  const activeItem = suggestions[activeIndex];
  const subCount = activeItem?.subItems?.length || 0;

  if (e.key === 'ArrowLeft' && subCount > 0) {
    e.preventDefault();
    setSelectedSubIndex(prev => (prev <= 0 ? subCount - 1 : prev - 1));
    return true;
  }
  if (e.key === 'ArrowRight' && subCount > 0) {
    e.preventDefault();
    setSelectedSubIndex(prev => (prev >= subCount - 1 ? 0 : prev + 1));
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const nextIdx = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
    setSelectedIndex(nextIdx);
    setSelectedSubIndex(0);
    return true;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = selectedIndex >= suggestions.length - 1 ? 0 : selectedIndex + 1;
    setSelectedIndex(nextIdx);
    setSelectedSubIndex(0);
    return true;
  }
  if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    handleEnterDropdownKey(activeItem, selectedSubIndex, setCommandInput, setIsDropdownOpen);
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    setIsDropdownOpen(false);
    return true;
  }
  return false;
};

const handleHistoryKeys = (opts: HandleTerminalKeyDownOptions) => {
  const { e, commandHistory, historyIndex, setHistoryIndex, setCommandInput, setIsDropdownOpen, setIsNavigatingHistory } = opts;
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.length === 0) return;
    setIsNavigatingHistory?.(true);
    setIsDropdownOpen?.(false);
    const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(nextIndex);
    setCommandInput(commandHistory[nextIndex]);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex === -1) return;
    setIsNavigatingHistory?.(true);
    setIsDropdownOpen?.(false);
    if (historyIndex === commandHistory.length - 1) {
      setHistoryIndex(-1);
      setCommandInput('');
    } else {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCommandInput(commandHistory[nextIndex]);
    }
  }
};

export const handleTerminalKeyDown = (opts: HandleTerminalKeyDownOptions) => {
  const {
    e,
    suggestions = [],
    selectedIndex = -1,
    setSelectedIndex = () => {},
    selectedSubIndex = 0,
    setSelectedSubIndex = () => {},
    setCommandInput,
    isDropdownOpen = false,
    setIsDropdownOpen = () => {},
  } = opts;

  if (e.key === 'Tab') {
    e.preventDefault();
    handleTabKey({
      e,
      isDropdownOpen,
      suggestions,
      selectedIndex,
      selectedSubIndex,
      setSelectedIndex,
      setSelectedSubIndex,
      setIsDropdownOpen,
    });
    return;
  }

  if (isDropdownOpen && suggestions.length > 0) {
    const handled = handleDropdownKeys({
      e,
      suggestions,
      selectedIndex,
      selectedSubIndex,
      setSelectedIndex,
      setSelectedSubIndex,
      setCommandInput,
      setIsDropdownOpen,
    });
    if (handled) return;
  }

  handleHistoryKeys(opts);
};

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

export const getTabClass = (
  tabName: 'activity' | 'logs',
  activeTab: 'activity' | 'logs',
  colorMode: 'dark' | 'light'
): string => {
  if (activeTab === tabName) {
    return `border-blue-500 font-black ${colorMode === 'dark' ? 'text-white' : 'text-slate-900'}`;
  }
  return colorMode === 'dark' ? 'border-transparent text-slate-500 hover:text-slate-300' : 'border-transparent text-slate-400 hover:text-slate-600';
};

interface TerminalPaginationBarProps {
  filteredLogsLength: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  colorMode: 'dark' | 'light';
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  isAutoscroll: boolean;
  onToggleAutoscroll: (val: boolean) => void;
}

export const TerminalPaginationBar = ({
  filteredLogsLength,
  currentPage,
  pageSize,
  totalPages,
  colorMode,
  setCurrentPage,
  isAutoscroll,
  onToggleAutoscroll,
}: TerminalPaginationBarProps) => {
  const startCount = Math.min(filteredLogsLength, (currentPage - 1) * pageSize + 1);
  const endCount = Math.min(filteredLogsLength, currentPage * pageSize);
  const isDark = colorMode === 'dark';

  return (
    <div className={cn(
      "terminal-pagination-bar",
      isDark ? "text-slate-400" : "text-slate-500"
    )}>
      <div>
        Showing {startCount}-{endCount} of {filteredLogsLength} logs
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold select-none hover:opacity-80">
          <input
            type="checkbox"
            checked={isAutoscroll}
            onChange={(e) => onToggleAutoscroll(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            data-testid="autoscroll-checkbox-logs"
          />
          <span>Autoscroll</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className={cn(
              "terminal-pagination-btn",
              isDark
                ? "border-slate-800 hover:bg-slate-900 bg-slate-950 text-slate-300"
                : "border-slate-200 hover:bg-slate-100 bg-white text-slate-600"
            )}
          >
            Prev
          </button>
          <span className="font-bold">Page {currentPage} of {totalPages}</span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className={cn(
              "terminal-pagination-btn",
              isDark
                ? "border-slate-800 hover:bg-slate-900 bg-slate-950 text-slate-300"
                : "border-slate-200 hover:bg-slate-100 bg-white text-slate-600"
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

interface AutocompleteItemProps {
  item: SuggestionItem;
  index: number;
  isSelected: boolean;
  isDark: boolean;
  selectedSubIndex: number;
  onSelectSuggestion: (item: SuggestionItem, podName?: string) => void;
}

const getAutocompleteItemClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return isDark ? "bg-slate-800 text-white border-blue-600/80" : "bg-blue-50 text-slate-900 border-blue-400/80";
  }
  return isDark ? "hover:bg-slate-800/80 text-slate-300 border-slate-800/60" : "hover:bg-slate-50 text-slate-700 border-slate-100";
};

const getCategoryBadgeClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return "bg-blue-600 text-white";
  }
  return isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500";
};

const getInfoBtnClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return "hover:bg-blue-700 text-white";
  }
  return isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600";
};

const getAccordionClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return "bg-slate-900/90 text-blue-100 border-slate-800";
  }
  return isDark ? "bg-slate-950/80 text-slate-300 border-slate-800" : "bg-slate-100/90 text-slate-700 border-slate-200";
};

const getSubItemClass = (isSubSelected: boolean, isDark: boolean): string => {
  if (isSubSelected) {
    return "bg-blue-600 text-white border-blue-400 shadow-sm font-bold scale-105";
  }
  if (isDark) {
    return "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white";
  }
  return "bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-600";
};

export const AutocompleteItem = ({
  item,
  index,
  isSelected,
  isDark,
  selectedSubIndex,
  onSelectSuggestion,
}: AutocompleteItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const containerClass = getAutocompleteItemClass(isSelected, isDark);
  const categoryBadgeClass = getCategoryBadgeClass(isSelected, isDark);
  const infoBtnClass = getInfoBtnClass(isSelected, isDark);
  const accordionClass = getAccordionClass(isSelected, isDark);

  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsInfoOpen(false);
      }}
      className={cn(
        "group flex flex-col transition-colors border-b last:border-b-0",
        containerClass
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 w-full">
        <button
          type="button"
          data-testid={`autocomplete-item-${index}`}
          onClick={() => onSelectSuggestion(item)}
          className="flex-1 flex items-center gap-2 overflow-hidden text-left focus:outline-none"
        >
          <TerminalSquare size={12} className={isSelected ? "text-blue-400 shrink-0" : "text-blue-500 shrink-0"} />
          <span className="font-semibold truncate text-[11px]">{item.label}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {item.description && (
            <span className={cn("text-[9px] truncate max-w-[120px] hidden sm:inline-block", isSelected ? "text-slate-300" : "text-slate-400")}>
              {item.description}
            </span>
          )}

          <span className={cn(
            "text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider",
            categoryBadgeClass
          )}>
            {item.category}
          </span>

          {/* Info toggle button visible on hover */}
          {item.description && (
            <button
              type="button"
              data-testid={`autocomplete-info-btn-${index}`}
              title="Toggle detailed description"
              onClick={(e) => {
                e.stopPropagation();
                setIsInfoOpen(prev => !prev);
              }}
              className={cn(
                "p-0.5 rounded transition-all focus:outline-none",
                isHovered || isInfoOpen ? "opacity-100" : "opacity-0",
                infoBtnClass
              )}
            >
              <Info size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Accordion list showing inline sub-item options (pod names) */}
      {hasSubItems && (
        <div
          data-testid={`autocomplete-subitems-accordion-${index}`}
          className={cn(
            "px-3 py-1.5 text-[10px] border-t flex flex-wrap items-center gap-1.5 animate-in slide-in-from-top-1 duration-150",
            accordionClass
          )}
        >
          {item.subItems!.map((subName, subIdx) => {
            const isSubSelected = isSelected && selectedSubIndex === subIdx;
            return (
              <button
                type="button"
                key={`subitem-${subName}-${subIdx}`}
                data-testid={`autocomplete-subitem-${subIdx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSuggestion(item, subName);
                }}
                className={cn(
                  "px-2 py-0.5 rounded font-mono text-[10px] transition-all inline-block border focus:outline-none",
                  getSubItemClass(isSubSelected, isDark)
                )}
              >
                {subName}
              </button>
            );
          })}
        </div>
      )}

      {/* Accordion dropdown for full description */}
      {isInfoOpen && item.description && (
        <div
          data-testid={`autocomplete-description-accordion-${index}`}
          className={cn(
            "px-3 py-1.5 text-[10px] border-t leading-relaxed animate-in slide-in-from-top-1 duration-150",
            accordionClass
          )}
        >
          <div className="flex items-start gap-1.5">
            <Info size={11} className="mt-0.5 shrink-0 opacity-80" />
            <div>
              <p className="font-bold mb-0.5 uppercase text-[9px] tracking-wider opacity-90">Detailed Information</p>
              <p className="select-text whitespace-normal break-words">{item.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TerminalCommandFormProps {
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  commandInput: string;
  onInputChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  colorMode: 'dark' | 'light';
  isAutoscroll: boolean;
  onToggleAutoscroll: (val: boolean) => void;
  suggestions: SuggestionItem[];
  isDropdownOpen: boolean;
  selectedIndex: number;
  selectedSubIndex: number;
  onSelectSuggestion: (item: SuggestionItem, podName?: string) => void;
}

export const TerminalCommandForm = ({
  onSubmit,
  commandInput,
  onInputChange,
  onKeyDown,
  colorMode,
  isAutoscroll,
  onToggleAutoscroll,
  suggestions,
  isDropdownOpen,
  selectedIndex,
  selectedSubIndex,
  onSelectSuggestion,
}: TerminalCommandFormProps) => {
  const isDark = colorMode === 'dark';
  const isAwaitingAdminPassword = useFlowStore((state) => state.isAwaitingAdminPassword);

  return (
    <div className="flex items-center justify-between gap-4 w-full relative">
      {/* Autocomplete Popup Dropdown */}
      {!isAwaitingAdminPassword && isDropdownOpen && suggestions.length > 0 && (
        <div
          data-testid="terminal-autocomplete-popup"
          className={cn(
            "terminal-autocomplete-popup custom-scrollbar",
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200 divide-slate-800"
              : "bg-white border-slate-200 text-slate-800 divide-slate-100"
          )}
        >
          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <AutocompleteItem
                key={`suggestion-${item.value}-${index}`}
                item={item}
                index={index}
                isSelected={isSelected}
                isDark={isDark}
                selectedSubIndex={selectedSubIndex}
                onSelectSuggestion={onSelectSuggestion}
              />
            );
          })}
        </div>
      )}

      <form onSubmit={onSubmit} className={cn(
        "flex-1 flex items-center gap-2 select-text",
        isDark ? "text-slate-300" : "text-slate-700"
      )}>
        <span className={cn("font-bold select-none", isDark ? "text-cyan-400" : "text-cyan-600")}>$</span>
        <input
          type={isAwaitingAdminPassword ? "password" : "text"}
          value={commandInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={isAwaitingAdminPassword ? "Enter admin password (input hidden)..." : "Type kubectl command (e.g. 'help', 'kubectl get pods')..."}
          className={cn(
            "flex-1 bg-transparent outline-none border-none font-mono text-[11px] p-0 focus:ring-0",
            isDark ? "text-slate-200 placeholder-slate-700" : "text-slate-800 placeholder-slate-300"
          )}
          data-testid="terminal-cli-input"
        />
      </form>
      <label className={cn(
        "flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold select-none shrink-0 hover:opacity-80",
        isDark ? "text-slate-400" : "text-slate-500"
      )}>
        <input
          type="checkbox"
          checked={isAutoscroll}
          onChange={(e) => onToggleAutoscroll(e.target.checked)}
          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
          data-testid="autoscroll-checkbox-activity"
        />
        <span>Autoscroll</span>
      </label>
    </div>
  );
};

interface TerminalMinimizedTriggerProps {
  setTerminalOpen: (open: boolean) => void;
  isSimulating: boolean;
  colorMode: 'dark' | 'light';
}

export const TerminalMinimizedTrigger = ({
  setTerminalOpen,
  isSimulating,
  colorMode,
}: TerminalMinimizedTriggerProps) => {
  const isDark = colorMode === 'dark';
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[50]">
      <button
        type="button"
        onClick={() => setTerminalOpen(true)}
        className={cn(
          "terminal-trigger-btn",
          isDark
            ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-700"
        )}
      >
        <Terminal size={14} className="text-blue-500 animate-pulse" />
        Kube Terminal {isSimulating && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />}
      </button>
    </div>
  );
};

interface TerminalToolbarProps {
  terminalActiveTab: 'activity' | 'logs';
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void;
  activityTabClass: string;
  logsTabClass: string;
  loggableResources: Node[];
  terminalSelectedResourceId: string | null;
  setTerminalSelectedResourceId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleExportLogs: () => void;
  clearTerminalLogs: () => void;
  setTerminalOpen: (open: boolean) => void;
  colorMode: 'dark' | 'light';
}

export const TerminalToolbar = ({
  terminalActiveTab,
  setTerminalActiveTab,
  activityTabClass,
  logsTabClass,
  loggableResources,
  terminalSelectedResourceId,
  setTerminalSelectedResourceId,
  searchQuery,
  setSearchQuery,
  handleExportLogs,
  clearTerminalLogs,
  setTerminalOpen,
  colorMode,
}: TerminalToolbarProps) => {
  const isDark = colorMode === 'dark';

  return (
    <div className={cn(
      "terminal-toolbar",
      isDark ? "border-slate-800 bg-slate-950/60 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-600"
    )}>
      <div className="flex items-center gap-4 h-full">
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          <Terminal size={13} className="text-blue-500" />
          <span>Kube Console</span>
        </div>

        <div className={cn("h-4 w-px", isDark ? "bg-slate-800" : "bg-slate-200")} />

        {/* Tabs */}
        <div className="flex items-center gap-1 h-full text-[11px] font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setTerminalActiveTab('activity')}
            className={cn(
              "h-full px-2.5 transition-colors border-b-2",
              activityTabClass
            )}
          >
            Kubectl Activity
          </button>
          <button
            type="button"
            onClick={() => setTerminalActiveTab('logs')}
            className={cn(
              "h-full px-2.5 transition-colors border-b-2",
              logsTabClass
            )}
          >
            Kube Logs
          </button>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {terminalActiveTab === 'logs' && loggableResources.length > 0 && (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <span className={cn("text-[10px] font-mono uppercase font-bold", isDark ? "text-slate-500" : "text-slate-400")}>RESOURCE:</span>
            <select
              value={terminalSelectedResourceId || ''}
              onChange={(e) => setTerminalSelectedResourceId(e.target.value)}
              className={cn(
                "border rounded px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-blue-500/50",
                isDark
                  ? "bg-slate-900 text-slate-200 border-slate-800"
                  : "bg-white text-slate-800 border-slate-200"
              )}
            >
              {loggableResources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.type.toLowerCase()}/{(r.data?.label as string) || r.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative w-36">
          <Search size={10} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", isDark ? "text-slate-500" : "text-slate-400")} />
          <input
            type="text"
            placeholder="Filter logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full border rounded pl-7 pr-2 py-0.5 text-[10px] outline-none focus:border-blue-500/50",
              isDark
                ? "bg-slate-900/60 border-slate-800 text-slate-300 placeholder-slate-600"
                : "bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400"
            )}
          />
        </div>

        <div className={cn("h-4 w-px", isDark ? "bg-slate-800" : "bg-slate-200")} />

        {/* Action buttons */}
        <button
          type="button"
          onClick={handleExportLogs}
          title="Export Log File"
          data-testid="terminal-export-log-btn"
          className={cn(
            "terminal-action-btn",
            isDark ? "hover:bg-slate-800 text-slate-500 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          )}
        >
          <Download size={12} />
        </button>
        <button
          type="button"
          onClick={clearTerminalLogs}
          title="Clear Terminal Output"
          className={cn(
            "terminal-action-btn",
            isDark ? "hover:bg-slate-800 text-slate-500 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          )}
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          onClick={() => setTerminalOpen(false)}
          title="Minimize Panel"
          className={cn(
            "terminal-action-btn",
            isDark ? "hover:bg-slate-800 text-slate-500 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          )}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

const isTargetNode = (n: Node, type: string, targetName: string): boolean => {
  const matchesType = n.type.toLowerCase() === type || (type === 'deploy' && n.type === 'Deployment');
  if (!matchesType) return false;
  const label = n.data?.label ? String(n.data.label).toLowerCase() : '';
  return n.id.toLowerCase() === targetName || label === targetName;
};

const printNodeDescription = (
  foundNode: Node,
  isSimulating: boolean,
  addActivityLog: (line: string) => void
) => {
  const name = (foundNode.data?.label as string) || foundNode.id;
  const status = (foundNode.data?.status as string) || (isSimulating ? 'Running' : 'Pending');
  const image = (foundNode.data?.image as string) || 'nginx:latest';
  const cpu = (foundNode.data?.cpuLimit as string) || '500m';
  const memory = (foundNode.data?.memoryLimit as string) || '256Mi';

  addActivityLog(`Name:         ${name}`);
  addActivityLog(`Namespace:    default`);
  addActivityLog(`Status:       ${status}`);
  addActivityLog(`IP:           10.244.0.${Math.floor(safeRandom() * 253) + 2}`);
  addActivityLog(`Containers:`);
  addActivityLog(`  app-container:`);
  addActivityLog(`    Image:      ${image}`);
  addActivityLog(`    Limits:`);
  addActivityLog(`      cpu:      ${cpu}`);
  addActivityLog(`      memory:   ${memory}`);
  addActivityLog(`Events:`);
  addActivityLog(`  Type    Reason     Age   From               Message`);
  addActivityLog(`  ----    ------     ----  ----               -------`);
  addActivityLog(`  Normal  Scheduled  1m    default-scheduler  Successfully assigned default/${name} to minikube-worker-1`);
  addActivityLog(`  Normal  Pulling    50s   kubelet            Pulling image "${image}"`);
  addActivityLog(`  Normal  Pulled     45s   kubelet            Successfully pulled image "${image}"`);
  addActivityLog(`  Normal  Created    44s   kubelet            Created container app-container`);
  addActivityLog(`  Normal  Started    44s   kubelet            Started container app-container`);
};

export const handleDescribeCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  isSimulating: boolean
): boolean => {
  const describeMatch = /^kubectl\s+describe\s+(pod|deploy(?:ment)?)\s+([-a-z0-9]+)/i.exec(cmd);
  if (!describeMatch) return false;

  const type = describeMatch[1].toLowerCase();
  const targetName = describeMatch[2].toLowerCase();

  const foundNode = nodes.find(n => isTargetNode(n, type, targetName));

  if (foundNode) {
    printNodeDescription(foundNode, isSimulating, addActivityLog);
  } else {
    addActivityLog(`Error from server (NotFound): ${type} "${targetName}" not found`);
  }
  return true;
};

// Custom Hook to manage terminal command submission and history
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
      id: commandHistoryEntries.length + 1,
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
      wailsApp.WriteLog('kubeconsole', 'info', `$ ${cmd}`).catch(() => {});
    }

    if (cmd.toLowerCase() === 'clear') {
      clearTerminalLogs();
      return;
    }

    const ctx: CommandContext = {
      nodes,
      isSimulating,
      updateNodeData: useFlowStore.getState().updateNodeData,
      addActivityLog,
      deleteNodes: useFlowStore.getState().deleteNodes,
      getStoreState: useFlowStore.getState,
      setStoreState: useFlowStore.setState,
    };

    executeKubectlCommand(cmd, ctx, setTerminalSelectedResourceId, setTerminalActiveTab, nextHistoryEntries);
  }, [commandHistoryEntries, isSimulating, nodes, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab]);

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

const useTerminalScroll = (
  isTerminalOpen: boolean,
  terminalActiveTab: 'activity' | 'logs',
  currentPage: number,
  totalPages: number,
  filteredLogs: string[]
) => {
  const [isAutoscroll, setIsAutoscroll] = useState(true);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);

  const performScroll = useCallback((instant: boolean) => {
    const el = contentAreaRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    const behavior = instant ? 'auto' : 'smooth';
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior });
    } else if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
    const timeoutMs = instant ? 100 : 600;
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, timeoutMs);
  }, []);

  const handleToggleAutoscroll = useCallback((checked: boolean) => {
    setIsAutoscroll(checked);
    if (checked) {
      performScroll(true);
    }
  }, [performScroll]);

  const handleScroll = useCallback(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 15;
    if (isProgrammaticScrollRef.current) {
      if (isAtBottom) {
        isProgrammaticScrollRef.current = false;
      }
      return;
    }
    if (!isAtBottom && isAutoscroll) {
      setIsAutoscroll(false);
    }
  }, [isAutoscroll]);

  useEffect(() => {
    if (isTerminalOpen && isAutoscroll) {
      if (terminalActiveTab === 'activity' || currentPage === totalPages) {
        performScroll(false);
      }
    }
  }, [isTerminalOpen, isAutoscroll, filteredLogs, terminalActiveTab, currentPage, totalPages, performScroll]);

  return {
    contentAreaRef,
    terminalEndRef,
    isAutoscroll,
    handleToggleAutoscroll,
    handleScroll,
  };
};

export interface UseTerminalLogsOptions {
  terminalActiveTab: 'activity' | 'logs';
  terminalSelectedResourceId: string | null;
  setTerminalSelectedResourceId: (id: string | null) => void;
  nodes: Node[];
  activityLogs: string[];
  terminalLogs: Record<string, string[]>;
  searchQuery: string;
  pageSize: number;
}

const useTerminalLogs = ({
  terminalActiveTab,
  terminalSelectedResourceId,
  setTerminalSelectedResourceId,
  nodes,
  activityLogs,
  terminalLogs,
  searchQuery,
  pageSize,
}: UseTerminalLogsOptions) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Filter workloads that can produce logs
  const loggableResources = useMemo(() => {
    return nodes.filter(n => ['Pod', 'Deployment', 'ReplicaSet'].includes(n.type));
  }, [nodes]);

  // Automatically select a resource if none is selected and one is available
  useEffect(() => {
    if (!terminalSelectedResourceId && loggableResources.length > 0) {
      setTerminalSelectedResourceId(loggableResources[0].id);
    }
  }, [loggableResources, terminalSelectedResourceId, setTerminalSelectedResourceId]);

  // Reset page when tab, resource, or query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [terminalActiveTab, terminalSelectedResourceId, searchQuery]);

  const activeLogs = useMemo(() => {
    if (terminalActiveTab === 'activity') {
      return activityLogs;
    }
    if (terminalSelectedResourceId) {
      return terminalLogs[terminalSelectedResourceId] || [];
    }
    return [];
  }, [terminalActiveTab, terminalSelectedResourceId, activityLogs, terminalLogs]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return activeLogs;
    const q = searchQuery.toLowerCase();
    return activeLogs.filter(line => line.toLowerCase().includes(q));
  }, [activeLogs, searchQuery]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  }, [filteredLogs, pageSize]);

  const paginatedLogs = useMemo(() => {
    if (terminalActiveTab !== 'logs') return filteredLogs;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, currentPage, terminalActiveTab, pageSize]);

  return {
    currentPage,
    setCurrentPage,
    loggableResources,
    activeLogs,
    filteredLogs,
    totalPages,
    paginatedLogs,
  };
};

export const TerminalPanel = () => {
  const isTerminalOpen = useFlowStore((state) => state.isTerminalOpen);
  const setTerminalOpen = useFlowStore((state) => state.setTerminalOpen);
  const terminalActiveTab = useFlowStore((state) => state.terminalActiveTab);
  const setTerminalActiveTab = useFlowStore((state) => state.setTerminalActiveTab);
  const terminalSelectedResourceId = useFlowStore((state) => state.terminalSelectedResourceId);
  const setTerminalSelectedResourceId = useFlowStore((state) => state.setTerminalSelectedResourceId);
  const terminalLogs = useFlowStore((state) => state.terminalLogs);
  const activityLogs = useFlowStore((state) => state.activityLogs);
  const clearTerminalLogs = useFlowStore((state) => state.clearTerminalLogs);
  const isSimulating = useFlowStore((state) => state.isSimulating);
  const startSimulation = useFlowStore((state) => state.startSimulation);
  const currentProject = useFlowStore((state) => state.currentProject);
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const suppressAutocompleteRef = useRef(false);

  const {
    commandInput,
    setCommandInput,
    commandHistory,
    historyIndex,
    setHistoryIndex,
    processCommandSubmit,
  } = useTerminalCommandSubmit(
    nodes,
    isSimulating,
    clearTerminalLogs,
    setTerminalSelectedResourceId,
    setTerminalActiveTab
  );

  const PAGE_SIZE = 25;

  const {
    currentPage,
    setCurrentPage,
    loggableResources,
    activeLogs,
    filteredLogs,
    totalPages,
    paginatedLogs,
  } = useTerminalLogs({
    terminalActiveTab,
    terminalSelectedResourceId,
    setTerminalSelectedResourceId,
    nodes,
    activityLogs,
    terminalLogs,
    searchQuery,
    pageSize: PAGE_SIZE,
  });

  const {
    contentAreaRef,
    terminalEndRef,
    isAutoscroll,
    handleToggleAutoscroll,
    handleScroll,
  } = useTerminalScroll(
    isTerminalOpen,
    terminalActiveTab,
    currentPage,
    totalPages,
    filteredLogs
  );

  const handleExportLogs = () => {
    const selectedNode = nodes.find(n => n.id === terminalSelectedResourceId);
    const resourceLabel = selectedNode ? ((selectedNode.data?.label as string) || selectedNode.id) : undefined;
    const filename = generateLogFilename(currentProject?.name, terminalActiveTab, resourceLabel);
    exportLogFile(activeLogs, filename);
  };

  const isAdminAuthenticated = useFlowStore((state) => state.isAdminAuthenticated);
  const isAwaitingAdminPassword = useFlowStore((state) => state.isAwaitingAdminPassword);

  const suggestions = useMemo(() => {
    return getAutocompleteSuggestions(commandInput, nodes, isAdminAuthenticated, isAwaitingAdminPassword);
  }, [commandInput, nodes, isAdminAuthenticated, isAwaitingAdminPassword]);

  useEffect(() => {
    if (suppressAutocompleteRef.current) {
      setIsDropdownOpen(false);
      return;
    }
    if (commandInput.trim().length > 0 && suggestions.length > 0) {
      setIsDropdownOpen(true);
      setSelectedIndex(0);
      setSelectedSubIndex(0);
    } else {
      setIsDropdownOpen(false);
    }
  }, [commandInput, suggestions]);

  const handleInputChange = (val: string) => {
    suppressAutocompleteRef.current = false;
    setCommandInput(val);
  };

  const activityTabClass = useMemo(() => getTabClass('activity', terminalActiveTab, colorMode), [terminalActiveTab, colorMode]);
  const logsTabClass = useMemo(() => getTabClass('logs', terminalActiveTab, colorMode), [terminalActiveTab, colorMode]);

  const setIsNavigatingHistory = useCallback((navigating: boolean) => {
    suppressAutocompleteRef.current = navigating;
  }, []);

  const handleSelectSuggestion = useCallback((item: SuggestionItem, podName?: string) => {
    suppressAutocompleteRef.current = true;
    if (podName) {
      setCommandInput(`kubectl logs ${podName}`);
    } else if (item.subItems && item.subItems.length > 0) {
      const selectedPod = item.subItems[selectedSubIndex] || item.subItems[0];
      setCommandInput(`kubectl logs ${selectedPod}`);
    } else {
      setCommandInput(item.value);
    }
    setIsDropdownOpen(false);
  }, [selectedSubIndex, setCommandInput]);

  const setDropdownOpenCustom = useCallback((open: boolean) => {
    if (!open) {
      suppressAutocompleteRef.current = true;
    }
    setIsDropdownOpen(open);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleTerminalKeyDown({
      e,
      commandHistory,
      historyIndex,
      setHistoryIndex,
      setCommandInput,
      suggestions,
      selectedIndex,
      setSelectedIndex,
      selectedSubIndex,
      setSelectedSubIndex,
      isDropdownOpen,
      setIsDropdownOpen: setDropdownOpenCustom,
      setIsNavigatingHistory,
    });
  };

  const handleCommandSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    processCommandSubmit(commandInput, setDropdownOpenCustom, setIsNavigatingHistory);
  };

  if (!isTerminalOpen) {
    return null;
  }

  return (
    <div
      data-testid="terminal-container"
      className={cn(
        "terminal-panel-container",
        colorMode === 'dark'
          ? "bg-slate-950/95 border-slate-800 text-slate-200"
          : "bg-white/95 border-slate-200 text-slate-800"
      )}
    >
      <TerminalToolbar
        terminalActiveTab={terminalActiveTab}
        setTerminalActiveTab={setTerminalActiveTab}
        activityTabClass={activityTabClass}
        logsTabClass={logsTabClass}
        loggableResources={loggableResources}
        terminalSelectedResourceId={terminalSelectedResourceId}
        setTerminalSelectedResourceId={setTerminalSelectedResourceId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleExportLogs={handleExportLogs}
        clearTerminalLogs={clearTerminalLogs}
        setTerminalOpen={setTerminalOpen}
        colorMode={colorMode}
      />

      {/* Terminal logs content */}
      <div
        ref={contentAreaRef}
        onScroll={handleScroll}
        className={cn(
          "terminal-content-area custom-scrollbar",
          colorMode === 'dark' ? "bg-slate-950/40" : "bg-slate-50/30"
        )}
      >
        <TerminalLogBody
          isSimulating={isSimulating}
          terminalActiveTab={terminalActiveTab}
          activeLogs={activeLogs}
          loggableResources={loggableResources}
          paginatedLogs={paginatedLogs}
          searchQuery={searchQuery}
          colorMode={colorMode}
          startSimulation={startSimulation}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
        />
        <div ref={terminalEndRef} />
      </div>

      {/* Fixed bottom footer for pagination and input form */}
      {((terminalActiveTab === 'logs' && filteredLogs.length > 0) || terminalActiveTab === 'activity') && (
        <div className={cn(
          "terminal-footer",
          colorMode === 'dark'
            ? "border-slate-800 bg-slate-950/95 text-slate-400"
            : "border-slate-200 bg-white/95 text-slate-500"
        )}>
          {terminalActiveTab === 'logs' && filteredLogs.length > 0 && (
            <TerminalPaginationBar
              filteredLogsLength={filteredLogs.length}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              totalPages={totalPages}
              colorMode={colorMode}
              setCurrentPage={setCurrentPage}
              isAutoscroll={isAutoscroll}
              onToggleAutoscroll={handleToggleAutoscroll}
            />
          )}

          {terminalActiveTab === 'activity' && (
            <TerminalCommandForm
              onSubmit={handleCommandSubmit}
              commandInput={commandInput}
              onInputChange={handleInputChange}
              onKeyDown={handleKeyDown}
              colorMode={colorMode}
              isAutoscroll={isAutoscroll}
              onToggleAutoscroll={handleToggleAutoscroll}
              suggestions={suggestions}
              isDropdownOpen={isDropdownOpen}
              selectedIndex={selectedIndex}
              selectedSubIndex={selectedSubIndex}
              onSelectSuggestion={handleSelectSuggestion}
            />
          )}
        </div>
      )}
    </div>
  );
};
