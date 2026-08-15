import { useState, useRef, useEffect, useMemo } from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '../../store';
import { cn, safeRandom } from '../../lib/utils';
import { Terminal, X, Trash2, Search, Box, Layers, Play, Download } from 'lucide-react';
import './TerminalPanel.css';
import {
  CommandContext,
  handleScaleCommand,
  handleSetImageCommand,
  handleRolloutStatusCommand,
  handleRolloutHistoryCommand,
  handleRolloutUndoCommand,
  handleDeletePodCommand,
  handleGetAllCommand,
  handleDescribeDeploymentCommand
} from './terminalCommands';

// Helper functions to handle kubectl commands and reduce cognitive complexity of TerminalPanel

export const handleGetPods = (addActivityLog: (line: string) => void, nodes: Node[], isSimulating: boolean) => {
  const workloads = nodes.filter(n => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet');
  if (workloads.length === 0) {
    addActivityLog('No pods or workloads found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(38)} READY   STATUS              RESTARTS   AGE`);
  workloads.forEach(w => {
    const name = w.data.label || w.id;
    const status = w.data.status || (isSimulating ? 'Running' : 'Pending');
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
    const name = d.data.label || d.id;
    const replicas = d.data.replicas || 1;
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
    const name = s.data.label || s.id;
    const port = s.data.port || 80;
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

export const handleLogsCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  setTerminalSelectedResourceId: (id: string | null) => void,
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void
): boolean => {
  const logsMatch = /^kubectl\s+logs\s+([a-z0-9/-]+)/i.exec(cmd);
  if (!logsMatch) return false;

  let targetName = logsMatch[1].toLowerCase();
  if (targetName.startsWith('pod/')) targetName = targetName.substring(4);
  if (targetName.startsWith('deployment/')) targetName = targetName.substring(11);
  if (targetName.startsWith('deploy/')) targetName = targetName.substring(7);

  const foundNode = nodes.find(n =>
    ['Pod', 'Deployment', 'ReplicaSet'].includes(n.type) &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

  if (foundNode) {
    setTerminalSelectedResourceId(foundNode.id);
    setTerminalActiveTab('logs');
    addActivityLog(`Switched console output stream to logs for resource: ${foundNode.type.toLowerCase()}/${targetName}`);
  } else {
    addActivityLog(`Error from server (NotFound): resource "${targetName}" not found`);
  }
  return true;
};

export const generateLogFilename = (
  projectName?: string | null,
  activeTab?: 'activity' | 'logs',
  resourceName?: string
): string => {
  let baseName = 'kube-simulator';
  if (projectName) {
    baseName = projectName.toLowerCase()
      .replace(/^scenario:\s*/i, 'scenario-')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (activeTab === 'logs' && resourceName) {
    const cleanResource = String(resourceName).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    baseName = `${baseName}-${cleanResource}`;
  }

  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${baseName}_${dateStr}_${timeStr}.log`;
};

export const exportLogFile = (logs: string[], filename: string) => {
  const fileHeader = `# Kube Simulator Log Output\n# Exported At: ${new Date().toISOString()}\n# Total Lines: ${logs.length}\n--------------------------------------------------\n`;
  const content = fileHeader + logs.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const handleDescribeCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  isSimulating: boolean
): boolean => {
  const describeMatch = /^kubectl\s+describe\s+(pod|deployment|deploy)\s+([a-z0-9-]+)/i.exec(cmd);
  if (!describeMatch) return false;

  const type = describeMatch[1].toLowerCase();
  const targetName = describeMatch[2].toLowerCase();

  const foundNode = nodes.find(n =>
    (n.type.toLowerCase() === type || (type === 'deploy' && n.type === 'Deployment')) &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

  if (foundNode) {
    const name = foundNode.data.label || foundNode.id;
    const status = foundNode.data.status || (isSimulating ? 'Running' : 'Pending');
    const image = foundNode.data.image || 'nginx:latest';
    const cpu = foundNode.data.cpuLimit || '500m';
    const memory = foundNode.data.memoryLimit || '256Mi';

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
  } else {
    addActivityLog(`Error from server (NotFound): ${type} "${targetName}" not found`);
  }
  return true;
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

  const handleExportLogs = () => {
    const selectedNode = nodes.find(n => n.id === terminalSelectedResourceId);
    const resourceLabel = selectedNode ? (selectedNode.data.label || selectedNode.id) : undefined;
    const filename = generateLogFilename(currentProject?.name, terminalActiveTab, resourceLabel);
    exportLogFile(activeLogs, filename);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Tab dynamic class computed independently to avoid nested ternaries
  const activityTabClass = useMemo(() => {
    if (terminalActiveTab === 'activity') {
      const colorClass = colorMode === 'dark' ? " text-white" : " text-slate-900";
      return "border-blue-500 font-black" + colorClass;
    }
    if (colorMode === 'dark') {
      return "border-transparent text-slate-500 hover:text-slate-300";
    }
    return "border-transparent text-slate-400 hover:text-slate-600";
  }, [terminalActiveTab, colorMode]);

  const logsTabClass = useMemo(() => {
    if (terminalActiveTab === 'logs') {
      const colorClass = colorMode === 'dark' ? " text-white" : " text-slate-900";
      return "border-blue-500 font-black" + colorClass;
    }
    if (colorMode === 'dark') {
      return "border-transparent text-slate-500 hover:text-slate-300";
    }
    return "border-transparent text-slate-400 hover:text-slate-600";
  }, [terminalActiveTab, colorMode]);

  // Reset page when tab, resource, or query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [terminalActiveTab, terminalSelectedResourceId, searchQuery]);

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

  // Get active logs to render
  const activeLogs = useMemo(() => {
    if (terminalActiveTab === 'activity') {
      return activityLogs;
    }
    if (terminalSelectedResourceId) {
      return terminalLogs[terminalSelectedResourceId] || [];
    }
    return [];
  }, [terminalActiveTab, terminalSelectedResourceId, activityLogs, terminalLogs]);

  // Filtered logs by search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return activeLogs;
    const q = searchQuery.toLowerCase();
    return activeLogs.filter(line => line.toLowerCase().includes(q));
  }, [activeLogs, searchQuery]);

  // Calculate total pages for logging pagination
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  }, [filteredLogs, PAGE_SIZE]);

  // Paginated slice for logs
  const paginatedLogs = useMemo(() => {
    if (terminalActiveTab !== 'logs') return filteredLogs;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredLogs, currentPage, terminalActiveTab, PAGE_SIZE]);

  // Auto-scroll to bottom on new log line (only auto-scrolls if we are on the latest page or if it is activity tab)
  useEffect(() => {
    if (isTerminalOpen && terminalEndRef.current) {
      if (terminalActiveTab === 'activity' || currentPage === totalPages) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isTerminalOpen, filteredLogs, terminalActiveTab, currentPage, totalPages]);

  // Color formatting for lines based on content
  const formatLogLine = (line: string) => {
    const isCommand = line.startsWith('$');
    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal') || line.toLowerCase().includes('failed');
    const isWarning = line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn') || line.toLowerCase().includes('throttled') || line.toLowerCase().includes('oom risk');
    const isSuccess = line.includes('created') || line.includes('Running') || line.includes('Ready') || line.includes('Successfully') || line.includes('deleted');

    let textClass = colorMode === 'dark' ? 'text-slate-300' : 'text-slate-700';
    if (isCommand) {
      textClass = colorMode === 'dark' ? 'text-cyan-400 font-bold' : 'text-cyan-600 font-bold';
    } else if (isError) {
      textClass = colorMode === 'dark' ? 'text-red-400' : 'text-red-600';
    } else if (isWarning) {
      textClass = colorMode === 'dark' ? 'text-amber-400' : 'text-amber-600';
    } else if (isSuccess) {
      textClass = colorMode === 'dark' ? 'text-emerald-400' : 'text-emerald-600';
    }

    // Highlight search match
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const parts = line.split(new RegExp(`(${searchQuery})`, 'gi'));
      const partsWithObjects = parts.map((part, index) => ({
        key: `part-${index}-${part}`,
        text: part,
        isMatch: part.toLowerCase() === q,
      }));
      return (
        <span className={textClass}>
          {partsWithObjects.map((item) =>
            item.isMatch ? (
              <mark key={item.key} className="bg-yellow-500 text-black px-0.5 rounded">{item.text}</mark>
            ) : (
              item.text
            )
          )}
        </span>
      );
    }

    return <span className={textClass}>{line}</span>;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommandInput(commandHistory[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
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

  const handleCommandSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    setCommandInput('');
    setCommandHistory(prev => {
      if (prev.at(-1) === cmd) return prev;
      return [...prev, cmd];
    });
    setHistoryIndex(-1);

    const addActivityLog = useFlowStore.getState().addActivityLog;
    addActivityLog(`$ ${cmd}`);

    const cmdLower = cmd.toLowerCase();

    if (cmdLower === 'clear') {
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
      setStoreState: useFlowStore.setState
    };

    if (cmdLower === 'help') {
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
      addActivityLog('  kubectl logs <pod-name>               Stream live container stdout logs');
      addActivityLog('  kubectl describe deploy <name>        Describe deployment specifications');
      addActivityLog('  kubectl describe pod <name>           Describe pod specifications & events');
      addActivityLog('  clear                                 Clear the console log list');
      return;
    }

    const commandHandlers = [
      handleGetAllCommand,
      handleScaleCommand,
      handleSetImageCommand,
      handleRolloutStatusCommand,
      handleRolloutHistoryCommand,
      handleRolloutUndoCommand,
      handleDeletePodCommand,
      handleDescribeDeploymentCommand,
    ];

    for (const handler of commandHandlers) {
      if (handler(cmd, ctx)) return;
    }

    if (handleGetCommands(cmdLower, addActivityLog, nodes, isSimulating)) {
      return;
    }

    if (handleLogsCommand(cmd, addActivityLog, nodes, setTerminalSelectedResourceId, setTerminalActiveTab)) {
      return;
    }

    if (handleDescribeCommand(cmd, addActivityLog, nodes, isSimulating)) {
      return;
    }

    addActivityLog(`kubectl-mock: command not found: "${cmd}". Type "help" to see available commands.`);
  };

  const renderLogBody = () => {
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

    const logItems = paginatedLogs.map((line, index) => {
      const actualIndex = terminalActiveTab === 'logs'
        ? (currentPage - 1) * PAGE_SIZE + index
        : index;
      return {
        key: `log-${terminalActiveTab}-${actualIndex}-${line}`,
        line,
      };
    });

    return logItems.map((item) => {
      return (
        <div key={item.key} className="flex items-start gap-2 whitespace-pre-wrap select-text leading-relaxed">
          {formatLogLine(item.line)}
        </div>
      );
    });
  };

  const renderTerminalContent = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1">
          {renderLogBody()}
        </div>

        {/* Pagination Controls for logs - Sticky at the bottom */}
        {terminalActiveTab === 'logs' && filteredLogs.length > 0 && (
          <div className={cn(
            "terminal-pagination-bar",
            colorMode === 'dark' ? "border-slate-800 text-slate-400 bg-slate-950/95" : "border-slate-200 text-slate-500 bg-white/95"
          )}>
            <div>
              Showing {Math.min(filteredLogs.length, (currentPage - 1) * PAGE_SIZE + 1)}-{Math.min(filteredLogs.length, currentPage * PAGE_SIZE)} of {filteredLogs.length} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={cn(
                  "terminal-pagination-btn",
                  colorMode === 'dark'
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
                  colorMode === 'dark'
                    ? "border-slate-800 hover:bg-slate-900 bg-slate-950 text-slate-300"
                    : "border-slate-200 hover:bg-slate-100 bg-white text-slate-600"
                )}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Interactive Terminal Input (Only available in the Kubectl Activity tab) */}
        {terminalActiveTab === 'activity' && (
          <form onSubmit={handleCommandSubmit} className={cn(
            "flex items-center gap-2 mt-2 select-text",
            colorMode === 'dark' ? "text-slate-300" : "text-slate-700"
          )}>
            <span className={cn("font-bold select-none", colorMode === 'dark' ? "text-cyan-400" : "text-cyan-600")}>$</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Type kubectl command (e.g. 'help', 'kubectl get pods')..."
              className={cn(
                "flex-1 bg-transparent outline-none border-none font-mono text-[11px] p-0 focus:ring-0",
                colorMode === 'dark' ? "text-slate-200 placeholder-slate-700" : "text-slate-800 placeholder-slate-300"
              )}
              data-testid="terminal-cli-input"
            />
          </form>
        )}
      </div>
    );
  };

  if (!isTerminalOpen) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400]">
        <button
          type="button"
          onClick={() => setTerminalOpen(true)}
          className={cn(
            "terminal-trigger-btn",
            colorMode === 'dark'
              ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-700"
          )}
        >
          <Terminal size={14} className="text-blue-500 animate-pulse" />
          Kube Terminal {isSimulating && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />}
        </button>
      </div>
    );
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
      {/* Terminal Toolbar */}
      <div className={cn(
        "terminal-toolbar",
        colorMode === 'dark' ? "border-slate-800 bg-slate-950/60 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-600"
      )}>
        <div className="flex items-center gap-4 h-full">
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest",
            colorMode === 'dark' ? "text-slate-400" : "text-slate-500"
          )}>
            <Terminal size={13} className="text-blue-500" />
            <span>Kube Console</span>
          </div>

          <div className={cn("h-4 w-px", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200")} />

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
              <span className={cn("text-[10px] font-mono uppercase font-bold", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>RESOURCE:</span>
              <select
                value={terminalSelectedResourceId || ''}
                onChange={(e) => setTerminalSelectedResourceId(e.target.value)}
                className={cn(
                  "border rounded px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-blue-500/50",
                  colorMode === 'dark'
                    ? "bg-slate-900 text-slate-200 border-slate-800"
                    : "bg-white text-slate-800 border-slate-200"
                )}
              >
                {loggableResources.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.type.toLowerCase()}/{r.data.label || r.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative w-36">
            <Search size={10} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full border rounded pl-7 pr-2 py-0.5 text-[10px] outline-none focus:border-blue-500/50",
                colorMode === 'dark'
                  ? "bg-slate-900/60 border-slate-800 text-slate-300 placeholder-slate-600"
                  : "bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400"
              )}
            />
          </div>

          <div className={cn("h-4 w-px", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200")} />

          {/* Action buttons */}
          <button
            type="button"
            onClick={handleExportLogs}
            title="Export Log File"
            data-testid="terminal-export-log-btn"
            className={cn(
              "terminal-action-btn",
              colorMode === 'dark' ? "hover:bg-slate-800 text-slate-500 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
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
              colorMode === 'dark' ? "hover:bg-slate-800 text-slate-500 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
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
              colorMode === 'dark' ? "hover:bg-slate-800 text-slate-500 hover:text-slate-200" : "hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            )}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Terminal logs content */}
      <div className={cn(
        "terminal-content-area custom-scrollbar",
        colorMode === 'dark' ? "bg-slate-950/40" : "bg-slate-50/30"
      )}>
        {renderTerminalContent()}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
