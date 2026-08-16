import React, { useRef, useEffect } from 'react';
import { Search, Trash2, CheckSquare, Square, MinusSquare, ChevronDown, FolderOpen, Filter } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { LogEntry } from '../../../store/types';

export type FilterLevel = 'all' | 'error' | 'warn' | 'info';

interface TabProps {
  type: FilterLevel;
  label: string;
  count: number;
  activeFilter: FilterLevel;
  setActiveFilter: (type: FilterLevel) => void;
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
      type="button"
      onClick={() => setActiveFilter(type)}
      className={cn(
        "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
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

interface LogToolbarProps {
  logs: LogEntry[];
  filteredLogs: LogEntry[];
  selectedIds: Set<string>;
  activeLevelFilter: FilterLevel;
  setActiveLevelFilter: (type: FilterLevel) => void;
  activeScopeFilter: string;
  setActiveScopeFilter: (scope: string) => void;
  availableScopes: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSelectMenuOpen: boolean;
  setIsSelectMenuOpen: (open: boolean) => void;
  onHandleSelectAll: () => void;
  onSelectByType: (type: 'all' | 'none' | 'error' | 'warn' | 'info') => void;
  onBulkDelete: () => void;
  onExportLogs: () => void;
  colorMode: 'dark' | 'light';
}

export const LogToolbar: React.FC<LogToolbarProps> = ({
  logs,
  filteredLogs,
  selectedIds,
  activeLevelFilter,
  setActiveLevelFilter,
  activeScopeFilter,
  setActiveScopeFilter,
  availableScopes,
  searchQuery,
  setSearchQuery,
  isSelectMenuOpen,
  setIsSelectMenuOpen,
  onHandleSelectAll,
  onSelectByType,
  onBulkDelete,
  onExportLogs,
  colorMode,
}) => {
  const isDark = colorMode === 'dark';
  const selectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (selectMenuRef.current && target instanceof Node && !selectMenuRef.current.contains(target)) {
        setIsSelectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsSelectMenuOpen]);

  const counts = React.useMemo(() => {
    let all = 0, error = 0, warn = 0, info = 0;
    for (const l of logs) {
      all++;
      if (l.level === 'error' || l.level === 'fatal') error++;
      else if (l.level === 'warn') warn++;
      else if (l.level === 'info') info++;
    }
    return { all, error, warn, info };
  }, [logs]);

  const isAllSelected = filteredLogs.length > 0 && selectedIds.size === filteredLogs.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredLogs.length;

  let MasterCheckboxIcon = <Square size={18} />;
  if (isAllSelected) {
    MasterCheckboxIcon = <CheckSquare size={18} />;
  } else if (isSomeSelected) {
    MasterCheckboxIcon = <MinusSquare size={18} />;
  }

  return (
    <div className="flex flex-col gap-2.5 border-b border-slate-700/30 pb-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left selection & level tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center relative" ref={selectMenuRef}>
            <button
              type="button"
              onClick={onHandleSelectAll}
              className={cn(
                "p-1.5 rounded hover:bg-slate-500/10 transition-colors flex items-center",
                selectedIds.size > 0 ? "text-blue-500" : "text-slate-500"
              )}
              title="Select all"
              data-testid="log-master-checkbox"
            >
              {MasterCheckboxIcon}
            </button>
            <button
              type="button"
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
                isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
              )}>
                {(['all', 'none', 'error', 'warn', 'info'] as const).map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => onSelectByType(type)}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs capitalize hover:bg-blue-500/10 transition-colors",
                      isDark ? "text-slate-300 hover:text-blue-400" : "text-slate-600 hover:text-blue-600"
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
            <div className="flex items-center gap-2">
              <div className="w-px h-4 bg-slate-700/50 mx-1" />
              <button
                type="button"
                onClick={onBulkDelete}
                className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-all flex items-center gap-1 text-xs"
                title="Delete selected"
                data-testid="log-bulk-delete"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
              <span className="text-xs font-medium text-blue-500 ml-1" data-testid="log-selection-count">
                {selectedIds.size} selected
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-500/5 p-1 rounded-lg">
              <Tab type="all" label="All" count={counts.all} activeFilter={activeLevelFilter} setActiveFilter={setActiveLevelFilter} colorMode={colorMode} />
              <Tab type="error" label="Errors" count={counts.error} activeFilter={activeLevelFilter} setActiveFilter={setActiveLevelFilter} colorMode={colorMode} />
              <Tab type="warn" label="Warnings" count={counts.warn} activeFilter={activeLevelFilter} setActiveFilter={setActiveLevelFilter} colorMode={colorMode} />
              <Tab type="info" label="Info" count={counts.info} activeFilter={activeLevelFilter} setActiveFilter={setActiveLevelFilter} colorMode={colorMode} />
            </div>
          )}
        </div>

        {/* Right action group: Scope Filter, Search & Export */}
        <div className="flex items-center gap-2 flex-1 justify-end max-w-md">
          {/* Scope Dropdown */}
          <div className="relative shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-slate-400 bg-slate-500/5 border-slate-700/30">
              <Filter size={13} className="text-slate-500" />
              <select
                value={activeScopeFilter}
                onChange={(e) => setActiveScopeFilter(e.target.value)}
                className={cn(
                  "bg-transparent outline-none cursor-pointer pr-1 text-xs font-medium",
                  isDark ? "text-slate-300" : "text-slate-700"
                )}
                data-testid="log-scope-filter"
              >
                <option value="all" className={isDark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-800"}>
                  All Scopes
                </option>
                {availableScopes.map((scope) => (
                  <option
                    key={scope}
                    value={scope}
                    className={isDark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-800"}
                  >
                    {scope}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
              )}
              data-testid="log-search-input"
            />
          </div>

          {/* Open Log File Button */}
          <button
            type="button"
            onClick={onExportLogs}
            className="px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium flex items-center gap-1.5 transition-all shrink-0"
            title="Open log file in explorer"
            data-testid="log-export-btn"
          >
            <FolderOpen size={14} />
            <span className="hidden sm:inline">Open Log File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
