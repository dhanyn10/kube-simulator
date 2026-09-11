import React from 'react';
import { Clock, Home, Save, FilePlus, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecentFileItem, getTableRowClass, getAutosaveSwitchBgClass } from '@/activities/layout/fileBackstageHelpers';

export interface BackstageHomeTabProps {
  readonly colorMode: 'dark' | 'light';
  readonly isAutosaveEnabled: boolean;
  readonly toggleAutosave: () => void;
  readonly newProjectName: string;
  readonly setNewProjectName: (val: string) => void;
  readonly isCanvasEmpty: boolean;
  readonly currentProjectId?: number | string;
  readonly recentFiles: readonly RecentFileItem[];
  readonly handleQuickSaveCurrent: () => void;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
  readonly handleRowContextMenu: (e: React.MouseEvent, item: RecentFileItem) => void;
  readonly handleRestoreFile: (item: RecentFileItem) => void;
}

/**
 * Home tab content displaying active profile quick save input and recent files list.
 */
export const BackstageHomeTab: React.FC<BackstageHomeTabProps> = ({
  colorMode,
  isAutosaveEnabled,
  toggleAutosave,
  newProjectName,
  setNewProjectName,
  isCanvasEmpty,
  currentProjectId,
  recentFiles,
  handleQuickSaveCurrent,
  onClose,
  onSaveAs,
  handleRowContextMenu,
  handleRestoreFile,
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Home & Recent Profiles</h1>
          <p className="text-xs text-slate-500 mt-0.5">Quickly restore recent architecture files and auto-saved profiles</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 select-none">
            <Clock size={15} className="text-blue-500" />
            <span className="text-xs font-semibold text-slate-400">Autosave:</span>
            <button
              type="button"
              role="switch"
              aria-checked={isAutosaveEnabled}
              onClick={toggleAutosave}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                getAutosaveSwitchBgClass(isAutosaveEnabled, isDark)
              )}
              title={isAutosaveEnabled ? "Autosave is Enabled" : "Autosave is Disabled"}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  isAutosaveEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
            <span className={cn("font-extrabold uppercase text-[10px] tracking-wider", isAutosaveEnabled ? "text-emerald-500" : "text-slate-400")}>
              {isAutosaveEnabled ? "ON" : "OFF"}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Home size={20} />
          </div>
        </div>
      </div>

      {/* Save Input Row */}
      <div className="space-y-2">
        <label htmlFor="backstage-project-name" className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
          Active Profile Name
        </label>
        <div className="flex gap-2">
          <input
            id="backstage-project-name"
            type="text"
            placeholder="Enter project/architecture name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className={cn(
              "flex-1 px-4 py-2.5 text-xs outline-none rounded-xl border font-medium transition-all",
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-500"
                : "bg-white border-slate-200 text-slate-800 focus:border-blue-400"
            )}
          />
          <button
            type="button"
            onClick={handleQuickSaveCurrent}
            disabled={isCanvasEmpty}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-900/10 transition-all cursor-pointer"
          >
            <Save size={15} /> Save Active Profile
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSaveAs();
            }}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer",
              isDark
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
            )}
          >
            <FilePlus size={15} /> Save As File...
          </button>
        </div>
      </div>

      {/* Recent Files Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
            Recent Files & Auto-Saved Profiles
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Right-click profile for context options</span>
        </div>

        <div className={cn(
          "overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border custom-scrollbar",
          isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
        )}>
          <table className="w-full text-left border-collapse">
            <thead className={cn(
              "sticky top-0 text-[10px] uppercase font-bold tracking-wider select-none z-10 border-b",
              isDark ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-500 border-slate-200"
            )}>
              <tr>
                <th className="py-3 px-4">Name & Location</th>
                <th className="py-3 px-4 text-right">Date Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-medium">
              {recentFiles.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-center py-10 text-slate-500">
                    No recent files or auto-saved profiles found
                  </td>
                </tr>
              ) : (
                recentFiles.map((file) => {
                  const rowClass = getTableRowClass(Boolean(file.isAutosave), isDark);
                  const isCurrentActive = currentProjectId === file.id;
                  return (
                    <tr
                      key={String(file.id)}
                      onContextMenu={(e) => handleRowContextMenu(e, file)}
                      onDoubleClick={() => handleRestoreFile(file)}
                      className={cn("transition-colors cursor-pointer select-none", rowClass)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shrink-0 mt-0.5",
                            file.isAutosave ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            {file.isAutosave ? <Clock size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold truncate max-w-[320px]">{file.name}</span>
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
                            </div>
                            <div className={cn(
                              "mt-1 px-2 py-0.5 rounded border inline-flex items-center gap-1.5 text-[10px] font-mono max-w-full",
                              isDark
                                ? "bg-slate-950 border-slate-800 text-slate-400"
                                : "bg-slate-100 border-slate-200 text-slate-600"
                            )}>
                              <span className="opacity-60 font-semibold shrink-0">Location:</span>
                              <span title={file.fullPath} className="truncate hover:text-blue-400 cursor-help">
                                {file.location}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-mono text-slate-400 align-top pt-3.5">
                        {file.updatedAt}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
