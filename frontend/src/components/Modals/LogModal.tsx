import React, { useState, useMemo, useEffect } from 'react';
import { useFlowStore } from '../../store';
import { Modal } from './Modal';
import { Bell, Trash2 } from 'lucide-react';
import { LogToolbar, FilterLevel } from './LogModal/LogToolbar';
import { LogRow } from './LogModal/LogRow';
import { LogPagination } from './LogModal/LogPagination';
import { exportLogsToFile } from './LogModal/logExport';

export const LogModal: React.FC = () => {
  const logs = useFlowStore((state) => state.logs);
  const isOpen = useFlowStore((state) => state.isLogModalOpen);
  const setOpen = useFlowStore((state) => state.setLogModalOpen);
  const clearLogs = useFlowStore((state) => state.clearLogs);
  const deleteLog = useFlowStore((state) => state.deleteLog);
  const deleteLogs = useFlowStore((state) => state.deleteLogs);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [activeLevelFilter, setActiveLevelFilter] = useState<FilterLevel>('all');
  const [activeScopeFilter, setActiveScopeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isSelectMenuOpen, setIsSelectMenuOpen] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeLevelFilter, activeScopeFilter, searchQuery]);

  const availableScopes = useMemo(() => {
    const defaultScopes = ['Simulation', 'KubeConsole', 'Store', 'UI', 'Backend', 'System'];
    const foundScopes = new Set<string>(defaultScopes);
    for (const log of logs) {
      if (log.scope) foundScopes.add(log.scope);
    }
    return Array.from(foundScopes);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (activeLevelFilter !== 'all') {
      result = result.filter((l) => {
        if (activeLevelFilter === 'error') return l.level === 'error' || l.level === 'fatal';
        return l.level === activeLevelFilter;
      });
    }

    if (activeScopeFilter !== 'all') {
      result = result.filter((l) => (l.scope || 'System') === activeScopeFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => l.message.toLowerCase().includes(q));
    }

    return [...result].reverse();
  }, [logs, activeLevelFilter, activeScopeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, validCurrentPage]);

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
      setSelectedIds(new Set(filteredLogs.map((l) => l.id)));
    }
  };

  const selectByType = (type: 'all' | 'none' | 'error' | 'warn' | 'info') => {
    if (type === 'none') {
      setSelectedIds(new Set());
    } else if (type === 'all') {
      setSelectedIds(new Set(filteredLogs.map((l) => l.id)));
    } else {
      const matching = filteredLogs.filter((l) => {
        if (type === 'error') return l.level === 'error' || l.level === 'fatal';
        return l.level === type;
      });
      setSelectedIds(new Set(matching.map((l) => l.id)));
    }
    setIsSelectMenuOpen(false);
  };

  const handleBulkDelete = () => {
    deleteLogs(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleExportLogs = () => {
    exportLogsToFile(filteredLogs);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      title="Console Logs"
      subtitle="History of application events"
      icon={Bell}
      iconColorClass="text-slate-500"
      widthClass="w-[780px]"
      maxHeightClass="h-[70vh]"
      disableScroll={true}
      compactHeader={true}
      footer={
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-slate-500">Logs are kept in-memory for the current session (last 500 entries).</p>
          <button
            type="button"
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
      <div className="flex flex-col h-full overflow-hidden gap-3">
        <LogToolbar
          logs={logs}
          filteredLogs={filteredLogs}
          selectedIds={selectedIds}
          activeLevelFilter={activeLevelFilter}
          setActiveLevelFilter={setActiveLevelFilter}
          activeScopeFilter={activeScopeFilter}
          setActiveScopeFilter={setActiveScopeFilter}
          availableScopes={availableScopes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSelectMenuOpen={isSelectMenuOpen}
          setIsSelectMenuOpen={setIsSelectMenuOpen}
          onHandleSelectAll={handleSelectAll}
          onSelectByType={selectByType}
          onBulkDelete={handleBulkDelete}
          onExportLogs={handleExportLogs}
          colorMode={colorMode}
        />

        {/* Log list */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-0.5">
          {paginatedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3" data-testid="no-logs-container">
              <Bell size={48} strokeWidth={1} />
              <p>{searchQuery ? "No logs matching your search." : "No logs recorded in this category."}</p>
            </div>
          ) : (
            paginatedLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                isSelected={selectedIds.has(log.id)}
                isExpanded={expandedIds.has(log.id)}
                searchQuery={searchQuery}
                colorMode={colorMode}
                onToggleSelect={toggleSelection}
                onToggleExpand={toggleExpand}
                onDelete={deleteLog}
              />
            ))
          )}
        </div>

        {/* Pagination Controls */}
        <LogPagination
          currentPage={validCurrentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filteredLogs.length}
          onPageChange={setCurrentPage}
          colorMode={colorMode}
        />
      </div>
    </Modal>
  );
};
