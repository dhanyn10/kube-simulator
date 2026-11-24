import React from 'react';
import { Save, Folder, FilePlus, Sun, Moon, PackageOpen, FolderOpen, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modals/Modal';
import { useSaveModal } from '@/activities/modals/useSaveModal';
import { useContextMenuPosition } from '@/lib/contextMenuUtils';
import {
  formatDateModified,
  getHeaderProfileName,
  RecentFileItem as RecentProjectItem,
} from '@/activities/layout/fileBackstageHelpers';
import { renderRecentProjectsBody } from '@/components/Layout/RecentProjectsRow';
import { detectScenarioResources, ResourceBadgeList, DetectedResource } from '@/scenarios';

export interface SaveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
}

interface SaveModalHeaderProps {
  readonly currentProject: { id: number; name: string } | null;
  readonly newProjectName: string;
  readonly activeLocation: string;
  readonly currentCanvasResources: DetectedResource[];
  readonly colorMode: string;
}

const SaveModalHeader: React.FC<SaveModalHeaderProps> = ({
  currentProject,
  newProjectName,
  activeLocation,
  currentCanvasResources,
  colorMode,
}) => {
  const isDark = colorMode === 'dark';
  return (
    <div className={cn(
      "p-3.5 rounded-xl border flex items-center justify-between",
      isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
    )}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <Folder size={18} />
        </div>
        <div>
          <div className={cn("text-xs font-bold tracking-tight font-mono", isDark ? "text-slate-200" : "text-slate-800")}>
            {getHeaderProfileName(currentProject, newProjectName)}
          </div>
          <p
            title={activeLocation}
            className={cn("text-[11px] font-mono flex items-center gap-1.5 mt-0.5 cursor-help", isDark ? "text-slate-400" : "text-slate-600")}
          >
            <span>Location:</span>
            <span className="text-blue-500 font-bold truncate max-w-[360px]">{activeLocation}</span>
          </p>
          <ResourceBadgeList
            resources={currentCanvasResources}
            colorMode={colorMode}
            testId="current-profile-badges"
            prefixKey="current-profile"
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="text-right">
        <span className={cn("text-[10px] uppercase font-bold tracking-wider block", isDark ? "text-slate-400" : "text-slate-500")}>Date Modified</span>
        <span className={cn("text-[11px] font-mono font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{formatDateModified(Date.now())}</span>
      </div>
    </div>
  );
};

interface SaveModalContextMenuProps {
  readonly contextMenu: { x: number; y: number; item: RecentProjectItem | null } | null;
  readonly contextMenuRef: React.RefObject<HTMLDivElement | null>;
  readonly position: { top: number; left: number };
  readonly colorMode: string;
  readonly toggleColorMode: () => void;
  readonly setContextMenu: (val: null) => void;
  readonly handleRestoreFile: (item: RecentProjectItem) => void;
  readonly handleOpenFolder: (item: RecentProjectItem) => void;
  readonly handleDeleteFile: (item: RecentProjectItem) => void;
  readonly onClose: () => void;
}

const SaveModalContextMenu: React.FC<SaveModalContextMenuProps> = ({
  contextMenu,
  contextMenuRef,
  position,
  colorMode,
  toggleColorMode,
  setContextMenu,
  handleRestoreFile,
  handleOpenFolder,
  handleDeleteFile,
  onClose,
}) => {
  if (!contextMenu) return null;

  const isDark = colorMode === 'dark';

  return (
    <div
      ref={contextMenuRef}
      role="menu"
      tabIndex={-1}
      aria-label="Save modal context menu"
      style={{ top: position.top, left: position.left }}
      className={cn(
        "save-modal-context-menu",
        isDark
          ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
      )}
    >
      {/* 1. Change Theme */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          toggleColorMode();
          setContextMenu(null);
        }}
        className={cn(
          "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors",
          isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
        )}
      >
        {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-600" />}
        <span>Change Theme</span>
      </button>

      {/* 2. Load Profile */}
      {contextMenu.item && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetItem = contextMenu.item;
              setContextMenu(null);
              if (targetItem) void handleRestoreFile(targetItem);
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-blue-400 hover:text-blue-300 cursor-pointer",
              isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
            )}
          >
            <PackageOpen size={14} />
            <span>Load Profile</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetItem = contextMenu.item;
              setContextMenu(null);
              if (targetItem) void handleOpenFolder(targetItem);
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-emerald-400 hover:text-emerald-300 cursor-pointer",
              isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
            )}
          >
            <FolderOpen size={14} />
            <span>Open Folder Location</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetItem = contextMenu.item;
              setContextMenu(null);
              if (targetItem) void handleDeleteFile(targetItem);
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-rose-400 hover:text-rose-300 cursor-pointer",
              isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
            )}
          >
            <Trash2 size={14} />
            <span>Delete Document</span>
          </button>
        </>
      )}

      <div className={cn("my-1 border-t", isDark ? "border-slate-800" : "border-slate-100")} />

      {/* 3. Exit / Close */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setContextMenu(null);
          onClose();
        }}
        className={cn(
          "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-rose-400 hover:text-rose-300",
          isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
        )}
      >
        <X size={14} />
        <span>Close</span>
      </button>
    </div>
  );
};

/**
 * Save As modal: inputs for the new project name (with availability checks) + recent files list.
 */
export const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onSaveAs }) => {
  const {
    colorMode,
    toggleColorMode,
    currentProject,
    newProjectName,
    setNewProjectName,
    recentFiles,
    hasAutosaves,
    isLoading,
    loadingFileId,
    activeLocation,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    isCanvasEmpty,
    nodes,
    handleRowContextMenu,
    handleQuickSaveCurrent,
    handleRestoreFile,
    handleDeleteFile,
    handleOpenFolder,
    handleClearAllAutosaves,
  } = useSaveModal({ isOpen, onClose });

  const currentCanvasResources = React.useMemo(
    () => detectScenarioResources({ nodes }).resources,
    [nodes]
  );

  const position = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0, contextMenuRef);
  const isDark = colorMode === 'dark';

  if (!isOpen) return null;

  const renderRecentFilesBody = () =>
    renderRecentProjectsBody({
      isLoading,
      recentFiles,
      isDark,
      currentProjectId: currentProject?.id,
      activeContextId: contextMenu?.item?.id,
      loadingFileId,
      onContextMenu: handleRowContextMenu,
      onRestoreFile: (f) => { void handleRestoreFile(f); },
      loadingTestId: 'recent-files-loading',
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Architecture & Recent Files"
      icon={Save}
      widthClass="w-[780px]"
      maxHeightClass="h-[75vh]"
    >
      <div className="space-y-5 p-1 font-sans">
        {/* Current Location & Status Header */}
        <SaveModalHeader
          currentProject={currentProject}
          newProjectName={newProjectName}
          activeLocation={activeLocation}
          currentCanvasResources={currentCanvasResources}
          colorMode={colorMode}
        />

        {/* Quick Save / Name Input */}
        <div className="space-y-2">
          <label htmlFor="save-modal-project-name" className={cn("text-[11px] uppercase font-bold tracking-wider block", isDark ? "text-slate-400" : "text-slate-600")}>
            Save Current Architecture
          </label>
          <div className="flex gap-2">
            <input
              id="save-modal-project-name"
              type="text"
              placeholder="Enter architecture name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className={cn(
                "flex-1 px-3 py-2 text-xs outline-none rounded-lg border font-medium transition-all",
                isDark
                  ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500"
                  : "bg-white border-slate-200 text-slate-800 focus:border-blue-400"
              )}
            />
            <button
              type="button"
              onClick={() => { void handleQuickSaveCurrent(); }}
              disabled={isCanvasEmpty || !newProjectName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all"
            >
              <Save size={14} /> Save
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSaveAs();
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all",
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
              )}
            >
              <FilePlus size={14} /> Save As
            </button>
          </div>
        </div>

        {/* Recent Files Table (MS Word Style) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                Recent Projects
              </h4>
              {(isLoading || loadingFileId !== null) && (
                <span
                  data-testid="recent-files-loading-badge"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 animate-pulse"
                >
                  <Loader2 size={10} className="animate-spin" />
                  <span>{loadingFileId !== null ? 'Loading file...' : 'Reading profiles...'}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {hasAutosaves && (
                <button
                  type="button"
                  data-testid="clean-autosaves-btn"
                  onClick={() => { void handleClearAllAutosaves(); }}
                  title="Clean up autosave backups"
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/50 flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={11} />
                  <span>Clean Autosaves</span>
                </button>
              )}
              <span className="text-[10px] text-slate-500 font-mono">Right-click project for menu (Change Theme, Restore, Close)</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border custom-scrollbar">
            <table className="w-full text-left font-sans border-collapse">
              <thead className={cn(
                "sticky top-0 text-[10px] uppercase font-bold tracking-wider select-none z-10 border-b",
                isDark ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-500 border-slate-200"
              )}>
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3 text-right">Date Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs font-medium">
                {renderRecentFilesBody()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dedicated Context Menu for Profile Items (3 Options: Change Theme, Restore, Close) */}
        <SaveModalContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          position={position}
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
          setContextMenu={setContextMenu}
          handleRestoreFile={handleRestoreFile}
          handleOpenFolder={handleOpenFolder}
          handleDeleteFile={handleDeleteFile}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
};
