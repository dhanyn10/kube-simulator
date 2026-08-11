import { useState, useRef, useEffect, useMemo } from 'react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { Terminal, X, Trash2, Search, ChevronDown, ChevronUp, Box, Layers, Play, Square } from 'lucide-react';

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
  const stopSimulation = useFlowStore((state) => state.stopSimulation);
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [searchQuery, setSearchQuery] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Filter workloads that can produce logs
  const loggableResources = useMemo(() => {
    return nodes.filter(n => ['Pod', 'Deployment', 'ReplicaSet'].includes(n.type));
  }, [nodes]);

  // Find currently selected resource object
  const currentResource = useMemo(() => {
    return loggableResources.find(r => r.id === terminalSelectedResourceId);
  }, [loggableResources, terminalSelectedResourceId]);

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

  // Auto-scroll to bottom on new log line
  useEffect(() => {
    if (isTerminalOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isTerminalOpen, filteredLogs]);

  // Color formatting for lines based on content
  const formatLogLine = (line: string, index: number) => {
    const isCommand = line.startsWith('$');
    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal') || line.toLowerCase().includes('failed');
    const isWarning = line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn') || line.toLowerCase().includes('throttled') || line.toLowerCase().includes('oom risk');
    const isSuccess = line.includes('created') || line.includes('Running') || line.includes('Ready') || line.includes('Successfully') || line.includes('deleted');

    let textClass = 'text-slate-300';
    if (isCommand) {
      textClass = 'text-cyan-400 font-bold';
    } else if (isError) {
      textClass = 'text-red-400';
    } else if (isWarning) {
      textClass = 'text-amber-400';
    } else if (isSuccess) {
      textClass = 'text-emerald-400';
    }

    // Highlight search match
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const parts = line.split(new RegExp(`(${searchQuery})`, 'gi'));
      return (
        <span className={textClass}>
          {parts.map((part, i) =>
            part.toLowerCase() === q ? (
              <mark key={i} className="bg-yellow-500 text-black px-0.5 rounded">{part}</mark>
            ) : part
          )}
        </span>
      );
    }

    return <span className={textClass}>{line}</span>;
  };

  if (!isTerminalOpen) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400]">
        <button
          type="button"
          onClick={() => setTerminalOpen(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl border text-xs font-bold uppercase tracking-wider transition-all scale-100 hover:scale-105 active:scale-95",
            colorMode === 'dark'
              ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-700"
          )}
        >
          <Terminal size={14} className="text-blue-500 animate-pulse" />
          K8s Terminal {isSimulating && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="terminal-container"
      className={cn(
        "fixed bottom-0 left-0 right-0 h-64 border-t z-[900] flex flex-col overflow-hidden backdrop-blur-md shadow-2xl transition-all duration-300",
        colorMode === 'dark' ? "bg-slate-950/95 border-slate-800 text-slate-200" : "bg-slate-900/95 border-slate-700 text-slate-100"
      )}
    >
      {/* Terminal Toolbar */}
      <div className="h-9 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 bg-slate-950/60 select-none">
        <div className="flex items-center gap-4 h-full">
          {/* Header title */}
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Terminal size={13} className="text-blue-500" />
            <span>Kubernetes Console</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Tabs */}
          <div className="flex items-center gap-1 h-full text-[11px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTerminalActiveTab('activity')}
              className={cn(
                "h-full px-2.5 transition-colors border-b-2",
                terminalActiveTab === 'activity'
                  ? "border-blue-500 text-white font-black"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              Kubectl Activity
            </button>
            <button
              type="button"
              onClick={() => setTerminalActiveTab('logs')}
              className={cn(
                "h-full px-2.5 transition-colors border-b-2",
                terminalActiveTab === 'logs'
                  ? "border-blue-500 text-white font-black"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              Kubernetes Logs
            </button>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Workload selector inside logs tab */}
          {terminalActiveTab === 'logs' && loggableResources.length > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">RESOURCE:</span>
              <select
                value={terminalSelectedResourceId || ''}
                onChange={(e) => setTerminalSelectedResourceId(e.target.value)}
                className="bg-slate-900 text-slate-200 border border-slate-800 rounded px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-blue-500/50"
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
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 placeholder-slate-600 rounded pl-7 pr-2 py-0.5 text-[10px] outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Action buttons */}
          <button
            type="button"
            onClick={clearTerminalLogs}
            title="Clear Terminal Output"
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors shrink-0"
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => setTerminalOpen(false)}
            title="Minimize Panel"
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Terminal logs content */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed select-text space-y-0.5 custom-scrollbar bg-slate-950/40">
        {!isSimulating && terminalActiveTab === 'activity' && activeLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6 text-slate-600 space-y-2">
            <Box size={24} className="opacity-25" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Terminal Idle</p>
              <p className="text-[10px] max-w-xs">Click the "Play" button in the top menu to apply manifests and start cluster operations.</p>
            </div>
            <button
              type="button"
              onClick={() => startSimulation()}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider shadow"
            >
              <Play size={10} fill="currentColor" /> Apply Manifests
            </button>
          </div>
        ) : terminalActiveTab === 'logs' && loggableResources.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6 text-slate-600 space-y-2">
            <Layers size={24} className="opacity-25" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">No Loggable Resources</p>
              <p className="text-[10px] max-w-xs">Add a Pod, Deployment, or ReplicaSet to the canvas to view container logs.</p>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600">
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {searchQuery ? "No matches found" : "Waiting for log stream..."}
            </span>
          </div>
        ) : (
          filteredLogs.map((line, index) => (
            <div key={index} className="flex items-start gap-2 whitespace-pre-wrap select-text leading-relaxed">
              <span className="text-slate-600 select-none text-right min-w-[20px] shrink-0 font-light">{index + 1}</span>
              {formatLogLine(line, index)}
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
