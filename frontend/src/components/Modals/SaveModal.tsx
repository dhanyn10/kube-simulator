import React from 'react';
import { Save, Folder, Clock, FileText, Check, FilePlus, Sun, Moon, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modals/Modal';
import { useSaveModal } from '@/activities/modals/useSaveModal';
import {
  formatDateModified,
  RecentFileItem,
  getSaveRowBgClass,
  getHeaderProfileName,
} from '@/activities/layout/fileBackstageHelpers';

export interface SaveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onSaveAs }) => {
  const {
    colorMode,
    toggleColorMode,
    currentProject,
    newProjectName,
    setNewProjectName,
    recentFiles,
    activeLocation,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    isCanvasEmpty,
    handleRowContextMenu,
    handleQuickSaveCurrent,
    handleRestoreFile,
  } = useSaveModal({ isOpen, onClose });

  if (!isOpen) return null;

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
              onClick={handleQuickSaveCurrent}
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
              <FilePlus size={14} /> Save As...
            </button>
          </div>
        </div>

        {/* Recent Files Table (MS Word Style) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              Recent Files & Auto-Saved Profiles
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">Right-click profile for menu (Change Theme, Restore, Exit)</span>
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
                {recentFiles.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-8 text-slate-500">
                      No recent files or auto-saved profiles found
                    </td>
                  </tr>
                ) : (
                  recentFiles.map((file) => (
                    <tr
                      key={String(file.id)}
                      onContextMenu={(e) => handleRowContextMenu(e, file)}
                      onDoubleClick={() => handleRestoreFile(file)}
                      className={cn(
                        "transition-colors group cursor-pointer select-none",
                        getSaveRowBgClass(Boolean(file.isAutosave), colorMode === 'dark')
                      )}
                    >
                      {/* Name Column with Sub-block for Location */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            "p-1.5 rounded-md shrink-0 mt-0.5",
                            file.isAutosave ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            {file.isAutosave ? <Clock size={15} /> : <FileText size={15} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200 truncate max-w-[280px]">{file.name}</span>
                              {file.isAutosave && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                  Auto-Save
                                </span>
                              )}
                              {currentProject?.id === file.id && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                                  <Check size={9} /> Active
                                </span>
                              )}
                            </div>
                            {/* Sub-block displaying clean location path */}
                            <div className={cn(
                              "mt-1 px-2 py-0.5 rounded border inline-flex items-center gap-1.5 text-[10px] font-mono max-w-full",
                              colorMode === 'dark'
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
                      <td className="py-2.5 px-3 text-right text-[11px] font-mono text-slate-300 whitespace-nowrap align-top pt-3">
                        {file.updatedAt}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dedicated Context Menu for Profile Items (3 Options: Change Theme, Restore, Exit) */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className={cn(
              "fixed z-[250] min-w-[170px] py-1 rounded-lg border shadow-xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100",
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
              <button
                type="button"
                onClick={() => {
                  const targetItem = contextMenu.item;
                  setContextMenu(null);
                  if (targetItem) handleRestoreFile(targetItem);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-blue-400 hover:text-blue-300",
                  colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
                )}
              >
                <RotateCcw size={14} />
                <span>Load Profile</span>
              </button>
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
              <span>Exit</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
