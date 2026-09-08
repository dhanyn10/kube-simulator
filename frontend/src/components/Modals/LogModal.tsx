import React from 'react';
import { Modal } from './Modal';
import { Bell, Trash2 } from 'lucide-react';
import { LogToolbar } from './LogModal/LogToolbar';
import { LogRow } from './LogModal/LogRow';
import { LogPagination } from './LogModal/LogPagination';
import { useLogModal } from '../../activity/modals';

export const LogModal: React.FC = () => {
  const {
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
    currentPage,
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
  } = useLogModal();

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      title="Logs"
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
          currentPage={currentPage}
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
