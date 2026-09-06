import { Node } from '@xyflow/react';
import { Box, Layers, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatLogLineContent } from './terminalLogUtils';

export interface TerminalLogBodyProps {
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
