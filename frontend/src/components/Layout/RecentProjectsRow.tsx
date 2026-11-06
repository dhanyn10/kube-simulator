import React from 'react';
import { Clock, FileText, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecentFileItem, getSaveRowBgClass } from '@/activities/layout/fileBackstageHelpers';

export const getRowHighlightClass = (isContextMenuActive: boolean, isDark: boolean): string => {
  if (!isContextMenuActive) return '';
  return isDark
    ? "bg-blue-900/40 ring-1 ring-blue-500/50"
    : "bg-blue-100/80 ring-1 ring-blue-400/50";
};

export const getProjectIconBadgeClass = (isFileLoading: boolean, isAutosave?: boolean): string => {
  if (isFileLoading) return "bg-blue-500/20 text-blue-400";
  if (isAutosave) return "bg-amber-500/10 text-amber-500";
  return "bg-blue-500/10 text-blue-500";
};

export const ProjectFileIcon: React.FC<{ readonly isFileLoading: boolean; readonly isAutosave?: boolean }> = ({
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

export interface RecentProjectsLoadingRowProps {
  readonly isDark: boolean;
  readonly testId?: string;
}

export const RecentProjectsLoadingRow: React.FC<RecentProjectsLoadingRowProps> = ({
  isDark,
  testId = 'recent-files-loading',
}) => (
  <tr data-testid={testId}>
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

export const RecentProjectsEmptyRow: React.FC = () => (
  <tr>
    <td colSpan={2} className="text-center py-8 text-slate-500">
      No recent files or auto-saved profiles found
    </td>
  </tr>
);

export interface RecentProjectsTableRowProps {
  readonly file: RecentFileItem;
  readonly isDark: boolean;
  readonly isContextMenuActive: boolean;
  readonly isCurrentActive: boolean;
  readonly isFileLoading?: boolean;
  readonly onContextMenu: (e: React.MouseEvent, file: RecentFileItem) => void;
  readonly onRestoreFile: (file: RecentFileItem) => void;
}

export const RecentProjectsTableRow: React.FC<RecentProjectsTableRowProps> = ({
  file,
  isDark,
  isContextMenuActive,
  isCurrentActive,
  isFileLoading = false,
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

export interface RenderRecentProjectsBodyParams {
  readonly isLoading?: boolean;
  readonly recentFiles: readonly RecentFileItem[];
  readonly isDark: boolean;
  readonly currentProjectId?: number | string;
  readonly activeContextId?: number | string;
  readonly loadingFileId?: number | string | null;
  readonly onContextMenu: (e: React.MouseEvent, file: RecentFileItem) => void;
  readonly onRestoreFile: (file: RecentFileItem) => void;
  readonly loadingTestId?: string;
}

export const renderRecentProjectsBody = ({
  isLoading,
  recentFiles,
  isDark,
  currentProjectId,
  activeContextId,
  loadingFileId,
  onContextMenu,
  onRestoreFile,
  loadingTestId,
}: RenderRecentProjectsBodyParams): React.ReactNode => {
  if (isLoading && recentFiles.length === 0) {
    return <RecentProjectsLoadingRow isDark={isDark} testId={loadingTestId} />;
  }
  if (recentFiles.length === 0) {
    return <RecentProjectsEmptyRow />;
  }
  return recentFiles.map((file) => (
    <RecentProjectsTableRow
      key={String(file.id)}
      file={file}
      isDark={isDark}
      isContextMenuActive={activeContextId === file.id}
      isCurrentActive={currentProjectId === file.id}
      isFileLoading={loadingFileId === file.id}
      onContextMenu={onContextMenu}
      onRestoreFile={onRestoreFile}
    />
  ));
};
