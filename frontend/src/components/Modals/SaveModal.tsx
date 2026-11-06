import React from 'react';
import { Save, Folder, Clock, FileText, Check, FilePlus, Sun, Moon, PackageOpen, FolderOpen, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modals/Modal';
import { useSaveModal } from '@/activities/modals/useSaveModal';
import { useContextMenuPosition } from '@/lib/contextMenuUtils';
import {
  formatDateModified,
  getSaveRowBgClass,
  getHeaderProfileName,
  RecentFileItem,
} from '@/activities/layout/fileBackstageHelpers';

export interface SaveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
}

const RecentFilesPreloader: React.FC<{ readonly isDark: boolean }> = ({ isDark }) => (
  <tr data-testid="recent-files-loading">
    <td colSpan={2} className="py-8 px-4 text-center select-none">
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
          <Loader2 size={18} className="text-blue-400 absolute animate-spin" />
        </div>
        <div className="space-y-1">
          <p className={cn("text-xs font-semibold", isDark ? "text-slate-200" : "text-slate-700")}>
            Reading current profiles...
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Scanning saved architectures and recent backups
          </p>
        </div>
        <div className="w-full max-w-xs space-y-1.5 pt-1 opacity-70">
          <div className={cn("h-5 rounded-md animate-pulse", isDark ? "bg-slate-800" : "bg-slate-200")} />
          <div className={cn("h-5 rounded-md animate-pulse", isDark ? "bg-slate-800/60" : "bg-slate-200/60")} />
          <div className={cn("h-5 rounded-md animate-pulse", isDark ? "bg-slate-800/30" : "bg-slate-200/30")} />
        </div>
      </div>
    </td>
  </tr>
);

const SaveModalEmptyRow: React.FC = () => (
  <tr>
    <td colSpan={2} className="text-center py-8 text-slate-500">
      No recent files or auto-saved profiles found
    </td>
  </tr>
);

const getRowHighlightClass = (isContextMenuActive: boolean, isDark: boolean): string => {
  if (!isContextMenuActive) return '';
  return isDark
    ? "bg-blue-900/40 ring-1 ring-blue-500/50"
    : "bg-blue-100/80 ring-1 ring-blue-400/50";
};

const getProjectIconBadgeClass = (isFileLoading: boolean, isAutosave?: boolean): string => {
  if (isFileLoading) return "bg-blue-500/20 text-blue-400";
  if (isAutosave) return "bg-amber-500/10 text-amber-500";
  return "bg-blue-500/10 text-blue-500";
};

const ProjectFileIcon: React.FC<{ readonly isFileLoading: boolean; readonly isAutosave?: boolean }> = ({
  isFileLoading,
  isAutosave,
}) => {
  if (isFileLoading) {
    return <Loader2 size={15} className="animate-spin text-blue-400" />;
  }
  if (isAutosave) {
    return <Clock size={15} />;
  }
  return <FileText size={15} />;
};

interface SaveModalProjectRowProps {
  readonly file: RecentFileItem;
  readonly isDark: boolean;
  readonly isContextMenuActive: boolean;
  readonly isCurrentActive: boolean;
  readonly isFileLoading: boolean;
  readonly onContextMenu: (e: React.MouseEvent, file: RecentFileItem) => void;
  readonly onRestoreFile: (file: RecentFileItem) => void;
}

const SaveModalProjectRow: React.FC<SaveModalProjectRowProps> = ({
  file,
  isDark,
  isContextMenuActive,
  isCurrentActive,
  isFileLoading,
  onContextMenu,
  onRestoreFile,
}) => (
  <tr
    onContextMenu={(e) => onContextMenu(e, file)}
    onDoubleClick={() => { void onRestoreFile(file); }}
    className={cn(
      "transition-colors group cursor-pointer select-none",
      getSaveRowBgClass(Boolean(file.isAutosave), isDark),
      getRowHighlightClass(isContextMenuActive, isDark),
      isFileLoading && "opacity-75 pointer-events-none"
    )}
  >
    {/* Name Column with Sub-block for Location */}
    <td className="py-2.5 px-3">
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "p-1.5 rounded-md shrink-0 mt-0.5",
          getProjectIconBadgeClass(isFileLoading, file.isAutosave)
        )}>
          <ProjectFileIcon isFileLoading={isFileLoading} isAutosave={file.isAutosave} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200 truncate max-w-[280px]">{file.name}</span>
            {file.isAutosave && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                Auto-Save
              </span>
            )}
            {isCurrentActive && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                <Check size={9} /> Active
              </span>
            )}
            {isFileLoading && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 flex items-center gap-1">
                <Loader2 size={9} className="animate-spin" /> Loading...
              </span>
            )}
          </div>
          {/* Sub-block displaying clean location path */}
          <div className={cn(
            "mt-1 px-2 py-0.5 rounded border inline-flex items-center gap-1.5 text-[10px] font-mono max-w-full",
            isDark
              ? "bg-slate-900/80 border-slate-800 text-slate-400"
              : "bg-slate-100 border-slate-200 text-slate-600"
          )}>
            <span className="text-slate-500 font-semibold shrink-0">Location:</span>
            <span
              title={file.fullPath}
              className="truncate hover:text-blue-400 cursor-help"
            >
              {file.location}
            </span>
          </div>
        </div>
      </div>
    </td>

    {/* Date Modified Column */}
    <td className="py-2.5 px-3 text-right text-[11px] font-mono text-slate-300 whitespace-nowrap align-top pt-2">
      <div className="flex items-center justify-end gap-2.5">
        <span>{file.updatedAt}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onRestoreFile(file);
          }}
          className={cn(
            "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer shadow-sm",
            isDark
              ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
          )}
        >
          Open
        </button>
      </div>
    </td>
  </tr>
);

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
    handleRowContextMenu,
    handleQuickSaveCurrent,
    handleRestoreFile,
    handleDeleteFile,
    handleOpenFolder,
    handleClearAllAutosaves,
  } = useSaveModal({ isOpen, onClose });

  const position = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0, contextMenuRef);

  if (!isOpen) return null;

  const renderRecentFilesBody = () => {
    if (isLoading && recentFiles.length === 0) {
      return <RecentFilesPreloader isDark={colorMode === 'dark'} />;
    }
    if (recentFiles.length === 0) {
      return <SaveModalEmptyRow />;
    }
    return recentFiles.map((file) => (
      <SaveModalProjectRow
        key={String(file.id)}
        file={file}
        isDark={colorMode === 'dark'}
        isContextMenuActive={contextMenu?.item?.id === file.id}
        isCurrentActive={currentProject?.id === file.id}
        isFileLoading={loadingFileId === file.id}
        onContextMenu={handleRowContextMenu}
        onRestoreFile={(f) => { void handleRestoreFile(f); }}
      />
    ));
  };

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
        <div className={cn(
          "p-3.5 rounded-xl border flex items-center justify-between",
          colorMode === 'dark' ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Folder size={18} />
            </div>
            <div>
              <div className="text-xs font-bold tracking-tight text-slate-200 font-mono">
                {getHeaderProfileName(currentProject, newProjectName)}
              </div>
              <p
                title={activeLocation}
                className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 cursor-help"
              >
                <span>Location:</span>
                <span className="text-blue-400 font-bold truncate max-w-[360px]">{activeLocation}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Date Modified</span>
            <span className="text-[11px] font-mono font-medium text-slate-300">{formatDateModified(Date.now())}</span>
          </div>
        </div>

        {/* Quick Save / Name Input */}
        <div className="space-y-2">
          <label htmlFor="save-modal-project-name" className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
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
                colorMode === 'dark'
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
                colorMode === 'dark'
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
                colorMode === 'dark' ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-500 border-slate-200"
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
        {contextMenu && (
          <div
            ref={contextMenuRef}
            style={{ top: position.top, left: position.left }}
            className={cn(
              "save-modal-context-menu",
              colorMode === 'dark'
                ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
            )}
          >
            {/* 1. Change Theme */}
            <button
              type="button"
              onClick={() => {
                toggleColorMode();
                setContextMenu(null);
              }}
              className={cn(
                "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors",
                colorMode === 'dark' ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
              )}
            >
              {colorMode === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-600" />}
              <span>Change Theme</span>
            </button>

            {/* 2. Load Profile */}
            {contextMenu.item && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const targetItem = contextMenu.item;
                    setContextMenu(null);
                    if (targetItem) void handleRestoreFile(targetItem);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-blue-400 hover:text-blue-300 cursor-pointer",
                    colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
                  )}
                >
                  <PackageOpen size={14} />
                  <span>Load Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetItem = contextMenu.item;
                    setContextMenu(null);
                    if (targetItem) void handleOpenFolder(targetItem);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-emerald-400 hover:text-emerald-300 cursor-pointer",
                    colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
                  )}
                >
                  <FolderOpen size={14} />
                  <span>Open Folder Location</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetItem = contextMenu.item;
                    setContextMenu(null);
                    if (targetItem) void handleDeleteFile(targetItem);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-rose-400 hover:text-rose-300 cursor-pointer",
                    colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
                  )}
                >
                  <Trash2 size={14} />
                  <span>Delete Document</span>
                </button>
              </>
            )}

            <div className={cn("my-1 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")} />

            {/* 3. Exit / Close */}
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                onClose();
              }}
              className={cn(
                "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-rose-400 hover:text-rose-300",
                colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
              )}
            >
              <X size={14} />
              <span>Close</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
