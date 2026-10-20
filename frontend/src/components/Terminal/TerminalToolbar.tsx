import React, { useState } from 'react';
import { Node } from '@xyflow/react';
import { Terminal, Search, Download, Trash2, X, ShieldCheck } from 'lucide-react';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { TerminalContextMenu } from './TerminalContextMenu';

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
  showAuth?: boolean;
  setShowAuth?: (show: boolean) => void;
  showFilterLogs?: boolean;
  setShowFilterLogs?: (show: boolean) => void;
  showExportLogs?: boolean;
  setShowExportLogs?: (show: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
  showAuth: propShowAuth,
  setShowAuth: propSetShowAuth,
  showFilterLogs: propShowFilterLogs,
  setShowFilterLogs: propSetShowFilterLogs,
  showExportLogs: propShowExportLogs,
  setShowExportLogs: propSetShowExportLogs,
  onContextMenu: propOnContextMenu,
}: TerminalToolbarProps) => {
  const isDark = colorMode === 'dark';
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const setActiveIdentity = useFlowStore((state) => state.setActiveIdentity);
  const setKubeIamModalOpen = useFlowStore((state) => state.setKubeIamModalOpen);
  const iamUsers = useFlowStore((state) => state.iamUsers);

  const [internalContextMenu, setInternalContextMenu] = useState<{ x: number; y: number } | null>(null);

  const storeShowAuth = useFlowStore((state) => state.terminalShowAuth);
  const setStoreShowAuth = useFlowStore((state) => state.setTerminalShowAuth);
  const showAuth = propShowAuth ?? storeShowAuth ?? true;
  const toggleAuth = () => {
    const next = !showAuth;
    propSetShowAuth?.(next);
    setStoreShowAuth?.(next);
  };

  const storeShowFilterLogs = useFlowStore((state) => state.terminalShowFilterLogs);
  const setStoreShowFilterLogs = useFlowStore((state) => state.setTerminalShowFilterLogs);
  const showFilterLogs = propShowFilterLogs ?? storeShowFilterLogs ?? true;
  const toggleFilterLogs = () => {
    const next = !showFilterLogs;
    propSetShowFilterLogs?.(next);
    setStoreShowFilterLogs?.(next);
  };

  const storeShowExportLogs = useFlowStore((state) => state.terminalShowExportLogs);
  const setStoreShowExportLogs = useFlowStore((state) => state.setTerminalShowExportLogs);
  const showExportLogs = propShowExportLogs ?? storeShowExportLogs ?? true;
  const toggleExportLogs = () => {
    const next = !showExportLogs;
    propSetShowExportLogs?.(next);
    setStoreShowExportLogs?.(next);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (propOnContextMenu) {
      propOnContextMenu(e);
    } else {
      setInternalContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      className={cn(
        "terminal-toolbar",
        isDark ? "border-slate-800 bg-slate-950/60 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-600"
      )}
    >
      <div className="flex items-center gap-4 h-full">
        <div className={cn(
          "flex items-center text-xs font-bold uppercase tracking-widest",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          <Terminal size={13} className="text-blue-500" />
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
            Activity
          </button>
          <button
            type="button"
            onClick={() => setTerminalActiveTab('logs')}
            className={cn(
              "h-full px-2.5 transition-colors border-b-2",
              logsTabClass
            )}
          >
            Logs
          </button>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {terminalActiveTab === 'logs' && loggableResources.length > 0 && (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <span className={cn("text-[10px] font-mono uppercase font-bold", isDark ? "text-slate-500" : "text-slate-400")}>RESOURCE:</span>
            <select
              data-testid="terminal-resource-select"
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

        {/* Active Identity Selector */}
        {showAuth && (
          <>
            <div data-testid="terminal-auth-section" className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setKubeIamModalOpen(true)}
                title="Open Kube IAM Management"
                className={cn(
                  "p-1 rounded transition-colors flex items-center gap-1 text-[10px] font-mono font-semibold",
                  isDark ? "hover:bg-slate-800 text-emerald-400" : "hover:bg-slate-200 text-emerald-600"
                )}
              >
                <ShieldCheck size={13} />
                <span>Auth:</span>
              </button>
              <select
                data-testid="terminal-identity-select"
                value={activeIdentity}
                onChange={(e) => setActiveIdentity(e.target.value)}
                className={cn(
                  "border rounded px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-emerald-500/50",
                  isDark
                    ? "bg-slate-900 text-emerald-400 border-slate-800"
                    : "bg-white text-emerald-700 border-slate-200"
                )}
                title="Active K8s User Identity Context"
              >
                <option value="system:admin">system:admin</option>
                {iamUsers.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn("h-4 w-px", isDark ? "bg-slate-800" : "bg-slate-200")} />
          </>
        )}

        {/* Search Bar */}
        {showFilterLogs && (
          <>
            <div data-testid="terminal-filter-section" className="relative w-36">
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
          </>
        )}

        {/* Action buttons */}
        {showExportLogs && (
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
        )}
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

      {internalContextMenu && (
        <TerminalContextMenu
          x={internalContextMenu.x}
          y={internalContextMenu.y}
          colorMode={colorMode}
          onClose={() => setInternalContextMenu(null)}
          showAuth={showAuth}
          onToggleAuth={toggleAuth}
          showFilterLogs={showFilterLogs}
          onToggleFilterLogs={toggleFilterLogs}
          showExportLogs={showExportLogs}
          onToggleExportLogs={toggleExportLogs}
        />
      )}
    </div>
  );
};
