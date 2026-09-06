import { useState, useMemo, useEffect } from 'react';
import { Node } from '@xyflow/react';

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

export const useTerminalLogs = ({
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
