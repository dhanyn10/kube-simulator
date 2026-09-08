import { useState, useMemo, useEffect } from 'react';
import { useFlowStore } from '../../store';
import { FilterLevel } from '../../components/Modals/LogModal/LogToolbar';
import { exportLogsToFile } from './logExport';

export const useLogModal = () => {
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

  return {
    logs,
    isOpen,
    setOpen,
    clearLogs,
    deleteLog,
    colorMode,
    activeLevelFilter,
    setActiveLevelFilter,
    activeScopeFilter,
    setActiveScopeFilter,
    searchQuery,
    setSearchQuery,
    selectedIds,
    expandedIds,
    isSelectMenuOpen,
    setIsSelectMenuOpen,
    currentPage: validCurrentPage,
    setCurrentPage,
    itemsPerPage,
    totalPages,
    availableScopes,
    filteredLogs,
    paginatedLogs,
    toggleSelection,
    toggleExpand,
    handleSelectAll,
    selectByType,
    handleBulkDelete,
    handleExportLogs,
  };
};
