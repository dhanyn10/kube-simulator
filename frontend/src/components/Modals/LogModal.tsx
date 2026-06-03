import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFlowStore } from '../../store';
import { Modal } from './Modal';
import { Bell, Trash2, AlertCircle, AlertTriangle, Info, Search, CheckSquare, Square, ChevronDown, MinusSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

type FilterType = 'all' | 'error' | 'warn' | 'info';

interface TabProps {
  type: FilterType;
  label: string;
  count: number;
  activeFilter: FilterType;
  setActiveFilter: (type: FilterType) => void;
  colorMode: 'dark' | 'light';
}

const Tab = ({ type, label, count, activeFilter, setActiveFilter, colorMode }: TabProps) => {
  const isActive = activeFilter === type;
  const isDark = colorMode === 'dark';

  let buttonClass = "text-slate-500 hover:bg-slate-500/10";
  if (isActive) {
    buttonClass = isDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-900";
  }

  let badgeClass = isDark ? "bg-slate-800" : "bg-slate-100";
  if (isActive) {
    badgeClass = isDark ? "bg-slate-600" : "bg-slate-300";
  }

  return (
    <button
      onClick={() => setActiveFilter(type)}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
        buttonClass
      )}
    >
      {label}
      <span className={cn(
        "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
        badgeClass
      )}>
        {count}
      </span>
    </button>
  );
};

export const LogModal: React.FC = () => {
  const logs = useFlowStore((state) => state.logs);
  const isOpen = useFlowStore((state) => state.isLogModalOpen);
  const setOpen = useFlowStore((state) => state.setLogModalOpen);
  const clearLogs = useFlowStore((state) => state.clearLogs);
  const deleteLog = useFlowStore((state) => state.deleteLog);
  const deleteLogs = useFlowStore((state) => state.deleteLogs);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isSelectMenuOpen, setIsSelectMenuOpen] = useState(false);
  const selectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectMenuRef.current && !selectMenuRef.current.contains(event.target as Node)) {
        setIsSelectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (activeFilter !== 'all') {
      result = result.filter(l => {
        if (activeFilter === 'error') return l.level === 'error' || l.level === 'fatal';
        return l.level === activeFilter;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.message.toLowerCase().includes(q));
    }
    return [...result].reverse();
  }, [logs, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    let all = 0, error = 0, warn = 0, info = 0;
    for (const l of logs) {
      all++;
      if (l.level === 'error' || l.level === 'fatal') error++;
      else if (l.level === 'warn') warn++;
      else if (l.level === 'info') info++;
    }
    return { all, error, warn, info };
  }, [logs]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length && filteredLogs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const selectByType = (type: 'all' | 'none' | 'error' | 'warn' | 'info') => {
    if (type === 'none') {
        setSelectedIds(new Set());
    } else if (type === 'all') {
        setSelectedIds(new Set(filteredLogs.map(l => l.id)));
    } else {
        const matching = filteredLogs.filter(l => {
            if (type === 'error') return l.level === 'error' || l.level === 'fatal';
            return l.level === type;
        });
        setSelectedIds(new Set(matching.map(l => l.id)));
    }
    setIsSelectMenuOpen(false);
  };

  const handleBulkDelete = () => {
    deleteLogs(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredLogs.length > 0 && selectedIds.size === filteredLogs.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredLogs.length;

  let MasterCheckboxIcon = <Square size={18} />;
  if (isAllSelected) {
    MasterCheckboxIcon = <CheckSquare size={18} />;
  } else if (isSomeSelected) {
    MasterCheckboxIcon = <MinusSquare size={18} />;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      alignClass="items-start pt-20"
      title="Console Logs"
      subtitle="History of application events"
      icon={Bell}
      iconColorClass="text-slate-500"
      widthClass="w-[900px]"
      disableScroll={true}
      footer={
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-slate-500">Logs are kept in-memory for the current session (last 500 entries).</p>
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            data-testid="log-clear-all"
          >
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-slate-700/30 pb-3 gap-4">
          <div className="flex items-center gap-1">
            <div className="flex items-center" ref={selectMenuRef}>
                <button
                    onClick={handleSelectAll}
                    className={cn(
                        "p-2 rounded hover:bg-slate-500/10 transition-colors flex items-center",
                        selectedIds.size > 0 ? "text-blue-500" : "text-slate-500"
                    )}
                    title="Select all"
                    data-testid="log-master-checkbox"
                >
                    {MasterCheckboxIcon}
                </button>
                <button
                    onClick={() => setIsSelectMenuOpen(!isSelectMenuOpen)}
                    className={cn(
                        "p-1 rounded hover:bg-slate-500/10 transition-colors",
                        isSelectMenuOpen ? "text-slate-200" : "text-slate-500"
                    )}
                    data-testid="log-select-dropdown"
                >
                    <ChevronDown size={14} />
                </button>

                {isSelectMenuOpen && (
                    <div className={cn(
                        "absolute top-full left-0 mt-1 w-32 py-1 rounded-md shadow-2xl border z-[60]",
                        colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                    )}>
                        {(['all', 'none', 'error', 'warn', 'info'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => selectByType(type)}
                                className={cn(
                                    "w-full px-3 py-1.5 text-left text-xs capitalize hover:bg-blue-500/10 transition-colors",
                                    colorMode === 'dark' ? "text-slate-300 hover:text-blue-400" : "text-slate-600 hover:text-blue-600"
                                )}
                                data-testid={`log-select-${type}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedIds.size > 0 ? (
                <>
                    <div className="w-px h-4 bg-slate-700/50 mx-1" />
                    <button
                        onClick={handleBulkDelete}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                        title="Delete selected"
                        data-testid="log-bulk-delete"
                    >
                        <Trash2 size={18} />
                    </button>
                    <span className="text-xs font-medium text-blue-500 ml-2" data-testid="log-selection-count">{selectedIds.size} selected</span>
                </>
            ) : (
                <div className="flex items-center gap-1 bg-slate-500/5 p-1 rounded-lg ml-2">
                    <Tab type="all" label="All" count={counts.all} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
                    <Tab type="error" label="Errors" count={counts.error} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
                    <Tab type="warn" label="Warnings" count={counts.warn} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
                    <Tab type="info" label="Info" count={counts.info} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
                </div>
            )}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-4 py-2 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
              )}
            />
          </div>
        </div>

        {/* Log list */}
        <div className="space-y-0.5 overflow-y-auto pr-2 custom-scrollbar max-h-[50vh]">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3" data-testid="no-logs-container">
              <Bell size={48} strokeWidth={1} />
              <p>{searchQuery ? "No logs matching your search." : "No logs recorded in this category."}</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
                let badgeClass = 'bg-blue-400/10 text-blue-400';
                const isError = log.level === 'error' || log.level === 'fatal';
                const isSelected = selectedIds.has(log.id);
                const isExpanded = expandedIds.has(log.id);

                if (isError) {
                    badgeClass = 'bg-red-500/10 text-red-500';
                } else if (log.level === 'warn') {
                    badgeClass = 'bg-amber-500/10 text-amber-500';
                }

                let rowColorClass = "";
                const isDark = colorMode === 'dark';
                if (isSelected) {
                    rowColorClass = isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200';
                } else {
                    rowColorClass = isDark ? 'bg-transparent border-slate-800/50 hover:bg-slate-800/40' : 'bg-transparent border-slate-100 hover:bg-slate-50';
                }

                return (
                    <div
                        key={log.id}
                        className={cn(
                        'group p-1.5 px-2 rounded flex items-start gap-3 transition-all select-none border-b',
                        rowColorClass
                        )}
                    >
                        <label
                            className={cn(
                                "mt-0.5 p-1 rounded transition-colors shrink-0 cursor-pointer outline-none focus-within:ring-1 focus-within:ring-blue-500",
                                isSelected ? "text-blue-500" : "text-slate-600 opacity-30 group-hover:opacity-100"
                            )}
                        >
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={isSelected}
                                onChange={() => toggleSelection(log.id)}
                                data-testid="log-checkbox"
                            />
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </label>

                        <button
                            onClick={() => toggleExpand(log.id)}
                            aria-expanded={isExpanded}
                            className="flex-1 min-w-0 flex flex-col gap-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                        >
                            <div className="flex items-start justify-between gap-4 w-full">
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <pre className={cn(
                                        "text-xs font-mono leading-relaxed break-all whitespace-pre-wrap",
                                        !isExpanded && "line-clamp-1",
                                        colorMode === 'dark' ? "text-slate-300" : "text-slate-700"
                                    )}>
                                        <span className="inline-flex items-center gap-1 mr-2 align-baseline translate-y-[1px]">
                                            {isError && <AlertCircle size={10} className="text-red-500" />}
                                            {log.level === 'warn' && <AlertTriangle size={10} className="text-amber-500" />}
                                            {log.level === 'info' && <Info size={10} className="text-blue-400" />}
                                            <span className={cn('text-[8px] font-bold uppercase px-1 rounded leading-tight', badgeClass)}>
                                                {log.level}
                                            </span>
                                        </span>
                                        {log.message}
                                    </pre>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 pt-0.5">
                                    <span className="text-[10px] tabular-nums text-slate-500 font-medium">{formatTime(log.timestamp)}</span>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteLog(log.id);
                            }}
                            className="p-1 mt-0.5 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-500/10 shrink-0"
                            title="Delete log"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
