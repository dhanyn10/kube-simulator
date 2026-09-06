import { Node } from '@xyflow/react';
import { Terminal, Search, Download, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TerminalToolbarProps {
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
