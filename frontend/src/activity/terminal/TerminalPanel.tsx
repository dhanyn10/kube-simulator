import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { getAutocompleteSuggestions, SuggestionItem } from './terminalAutocomplete';
import { TerminalLogBody } from './TerminalLogBody';
import { TerminalPaginationBar } from './TerminalPaginationBar';
import { TerminalCommandForm } from './TerminalCommandForm';
import { TerminalMinimizedTrigger } from './TerminalMinimizedTrigger';
import { TerminalToolbar } from './TerminalToolbar';
import { useTerminalCommandSubmit, executeKubectlCommand } from './useTerminalCommandSubmit';
import { handleTerminalKeyDown } from './terminalKeyDown';
import { useTerminalLogs, getTabClass } from './useTerminalLogs';
import { useTerminalScroll } from './useTerminalScroll';
import {
  formatCommandTimestamp,
  makeDivider,
  generateLogFilename,
  exportLogFile,
  getLogLineColorClass,
  formatLogLineContent,
  CommandHistoryEntry,
} from './terminalLogUtils';
import {
  handleGetPods,
  handleGetDeployments,
  handleGetServices,
  handleGetCommands,
  handleLogsCommand,
  handleHistoryCommand,
  handleHelpCommand,
  handleDescribeCommand,
} from './terminalHandlers';

// Re-export utilities and handlers for backwards compatibility and tests
export {
  handleGetPods,
  handleGetDeployments,
  handleGetServices,
  handleGetCommands,
  handleLogsCommand,
  generateLogFilename,
  makeDivider,
  exportLogFile,
  formatCommandTimestamp,
  handleHistoryCommand,
  handleHelpCommand,
  getLogLineColorClass,
  formatLogLineContent,
  TerminalLogBody,
  handleTerminalKeyDown,
  executeKubectlCommand,
  getTabClass,
  TerminalPaginationBar,
  TerminalCommandForm,
  TerminalMinimizedTrigger,
  TerminalToolbar,
  handleDescribeCommand,
  useTerminalCommandSubmit,
  useTerminalLogs,
  useTerminalScroll,
};
export type { CommandHistoryEntry };
export { trimDashes, sanitizeSlug, cleanProjectName } from '../../lib/utils';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const suppressAutocompleteRef = useRef(false);

  const {
    commandInput,
    setCommandInput,
    commandHistory,
    historyIndex,
    setHistoryIndex,
    processCommandSubmit,
  } = useTerminalCommandSubmit(
    nodes,
    isSimulating,
    clearTerminalLogs,
    setTerminalSelectedResourceId,
    setTerminalActiveTab
  );

  const PAGE_SIZE = 25;

  const {
    currentPage,
    setCurrentPage,
    loggableResources,
    activeLogs,
    filteredLogs,
    totalPages,
    paginatedLogs,
  } = useTerminalLogs({
    terminalActiveTab,
    terminalSelectedResourceId,
    setTerminalSelectedResourceId,
    nodes,
    activityLogs,
    terminalLogs,
    searchQuery,
    pageSize: PAGE_SIZE,
  });

  const {
    contentAreaRef,
    terminalEndRef,
    isAutoscroll,
    handleToggleAutoscroll,
    handleScroll,
  } = useTerminalScroll(
    isTerminalOpen,
    terminalActiveTab,
    currentPage,
    totalPages,
    filteredLogs
  );

  const handleExportLogs = () => {
    const selectedNode = nodes.find(n => n.id === terminalSelectedResourceId);
    const resourceLabel = selectedNode ? ((selectedNode.data?.label as string) || selectedNode.id) : undefined;
    const filename = generateLogFilename(currentProject?.name, terminalActiveTab, resourceLabel);
    exportLogFile(activeLogs, filename);
  };

  const isAdminAuthenticated = useFlowStore((state) => state.isAdminAuthenticated);
  const isAwaitingAdminPassword = useFlowStore((state) => state.isAwaitingAdminPassword);

  const suggestions = useMemo(() => {
    return getAutocompleteSuggestions(commandInput, nodes, isAdminAuthenticated, isAwaitingAdminPassword);
  }, [commandInput, nodes, isAdminAuthenticated, isAwaitingAdminPassword]);

  useEffect(() => {
    if (suppressAutocompleteRef.current) {
      setIsDropdownOpen(false);
      return;
    }
    if (commandInput.trim().length > 0 && suggestions.length > 0) {
      setIsDropdownOpen(true);
      setSelectedIndex(0);
      setSelectedSubIndex(0);
    } else {
      setIsDropdownOpen(false);
    }
  }, [commandInput, suggestions]);

  const handleInputChange = (val: string) => {
    suppressAutocompleteRef.current = false;
    setCommandInput(val);
  };

  const activityTabClass = useMemo(() => getTabClass('activity', terminalActiveTab, colorMode), [terminalActiveTab, colorMode]);
  const logsTabClass = useMemo(() => getTabClass('logs', terminalActiveTab, colorMode), [terminalActiveTab, colorMode]);

  const setIsNavigatingHistory = useCallback((navigating: boolean) => {
    suppressAutocompleteRef.current = navigating;
  }, []);

  const handleSelectSuggestion = useCallback((item: SuggestionItem, podName?: string) => {
    suppressAutocompleteRef.current = true;
    if (podName) {
      setCommandInput(`kubectl logs ${podName}`);
    } else if (item.subItems && item.subItems.length > 0) {
      const selectedPod = item.subItems[selectedSubIndex] || item.subItems[0];
      setCommandInput(`kubectl logs ${selectedPod}`);
    } else {
      setCommandInput(item.value);
    }
    setIsDropdownOpen(false);
  }, [selectedSubIndex, setCommandInput]);

  const setDropdownOpenCustom = useCallback((open: boolean) => {
    if (!open) {
      suppressAutocompleteRef.current = true;
    }
    setIsDropdownOpen(open);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleTerminalKeyDown({
      e,
      commandHistory,
      historyIndex,
      setHistoryIndex,
      setCommandInput,
      suggestions,
      selectedIndex,
      setSelectedIndex,
      selectedSubIndex,
      setSelectedSubIndex,
      isDropdownOpen,
      setIsDropdownOpen: setDropdownOpenCustom,
      setIsNavigatingHistory,
    });
  };

  const handleCommandSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    processCommandSubmit(commandInput, setDropdownOpenCustom, setIsNavigatingHistory);
  };

  if (!isTerminalOpen) {
    return null;
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
      <TerminalToolbar
        terminalActiveTab={terminalActiveTab}
        setTerminalActiveTab={setTerminalActiveTab}
        activityTabClass={activityTabClass}
        logsTabClass={logsTabClass}
        loggableResources={loggableResources}
        terminalSelectedResourceId={terminalSelectedResourceId}
        setTerminalSelectedResourceId={setTerminalSelectedResourceId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleExportLogs={handleExportLogs}
        clearTerminalLogs={clearTerminalLogs}
        setTerminalOpen={setTerminalOpen}
        colorMode={colorMode}
      />

      {/* Terminal logs content */}
      <div
        ref={contentAreaRef}
        onScroll={handleScroll}
        className={cn(
          "terminal-content-area custom-scrollbar",
          colorMode === 'dark' ? "bg-slate-950/40" : "bg-slate-50/30"
        )}
      >
        <TerminalLogBody
          isSimulating={isSimulating}
          terminalActiveTab={terminalActiveTab}
          activeLogs={activeLogs}
          loggableResources={loggableResources}
          paginatedLogs={paginatedLogs}
          searchQuery={searchQuery}
          colorMode={colorMode}
          startSimulation={startSimulation}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
        />
        <div ref={terminalEndRef} />
      </div>

      {/* Fixed bottom footer for pagination and input form */}
      {((terminalActiveTab === 'logs' && filteredLogs.length > 0) || terminalActiveTab === 'activity') && (
        <div className={cn(
          "terminal-footer",
          colorMode === 'dark'
            ? "border-slate-800 bg-slate-950/95 text-slate-400"
            : "border-slate-200 bg-white/95 text-slate-500"
        )}>
          {terminalActiveTab === 'logs' && filteredLogs.length > 0 && (
            <TerminalPaginationBar
              filteredLogsLength={filteredLogs.length}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              totalPages={totalPages}
              colorMode={colorMode}
              setCurrentPage={setCurrentPage}
              isAutoscroll={isAutoscroll}
              onToggleAutoscroll={handleToggleAutoscroll}
            />
          )}

          {terminalActiveTab === 'activity' && (
            <TerminalCommandForm
              onSubmit={handleCommandSubmit}
              commandInput={commandInput}
              onInputChange={handleInputChange}
              onKeyDown={handleKeyDown}
              colorMode={colorMode}
              isAutoscroll={isAutoscroll}
              onToggleAutoscroll={handleToggleAutoscroll}
              suggestions={suggestions}
              isDropdownOpen={isDropdownOpen}
              selectedIndex={selectedIndex}
              selectedSubIndex={selectedSubIndex}
              onSelectSuggestion={handleSelectSuggestion}
            />
          )}
        </div>
      )}
    </div>
  );
};
