import React from 'react';
import {
  ArrowLeft,
  Home,
  Save,
  FilePlus,
  Upload,
  FileCode,
  Sliders,
  ChevronDown,
  ChevronRight,
  Eye,
  Grid,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BackstageTab } from '@/activity/layout/fileBackstageHelpers';

export interface BackstageSidebarProps {
  readonly colorMode: 'dark' | 'light';
  readonly activeTab: BackstageTab;
  readonly setActiveTab: (tab: BackstageTab) => void;
  readonly isSettingsExpanded: boolean;
  readonly setIsSettingsExpanded: (val: boolean) => void;
  readonly isCanvasEmpty: boolean;
  readonly onClose: () => void;
  readonly onQuickSaveCurrent: () => void;
  readonly onSaveAs: () => void;
  readonly onImportFile: () => void;
  readonly onExportYaml: () => void;
  readonly toggleColorMode: () => void;
}

/**
 * Sidebar navigation component for MS Word 2021 style FileBackstageView overlay.
 */
export const BackstageSidebar: React.FC<BackstageSidebarProps> = ({
  colorMode,
  activeTab,
  setActiveTab,
  isSettingsExpanded,
  setIsSettingsExpanded,
  isCanvasEmpty,
  onClose,
  onQuickSaveCurrent,
  onSaveAs,
  onImportFile,
  onExportYaml,
  toggleColorMode,
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div
      className={cn(
        "w-64 border-r flex flex-col shrink-0 shadow-lg select-none",
        isDark ? "bg-slate-900 border-slate-800" : "bg-blue-900 text-white border-blue-800"
      )}
    >
      {/* Back Button (← Arrow) */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          data-testid="file-backstage-back-btn"
          className={cn(
            "p-2.5 rounded-full transition-colors flex items-center justify-center cursor-pointer",
            isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-white/20 hover:bg-white/30 text-white"
          )}
          title="Return to Canvas (Esc)"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-extrabold text-sm tracking-wide uppercase">File Menu</h2>
          <p className="text-[10px] opacity-70 font-medium">Kube Simulator</p>
        </div>
      </div>

      {/* Sidebar Nav Items */}
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {/* Home Item */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
            activeTab === 'home'
              ? isDark ? "bg-blue-600 text-white" : "bg-white text-blue-900 font-extrabold shadow-md"
              : isDark ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
          )}
        >
          <Home size={16} />
          <span>Home</span>
        </button>

        {/* Save Item */}
        <button
          type="button"
          onClick={onQuickSaveCurrent}
          disabled={isCanvasEmpty}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer disabled:opacity-50",
            isDark ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
          )}
        >
          <Save size={16} />
          <span>Save</span>
        </button>

        {/* Save As... Item */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onSaveAs();
          }}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
            isDark ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
          )}
        >
          <FilePlus size={16} />
          <span>Save As...</span>
        </button>

        {/* Import Item */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onImportFile();
          }}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
            isDark ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
          )}
        >
          <Upload size={16} />
          <span>Import</span>
        </button>

        {/* Export YAML Item */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onExportYaml();
          }}
          className={cn(
            "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
            isDark ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
          )}
        >
          <FileCode size={16} />
          <span>Export YAML</span>
        </button>

        <div className={cn("my-2 border-t", isDark ? "border-slate-800" : "border-white/15")} />

        {/* Settings Section with Submenus */}
        <div>
          <button
            type="button"
            onClick={() => {
              setIsSettingsExpanded(!isSettingsExpanded);
              if (activeTab === 'home') {
                setActiveTab('settings-view');
              }
            }}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer",
              activeTab.startsWith('settings-')
                ? isDark ? "bg-slate-800 text-blue-400" : "bg-white/20 text-white"
                : isDark ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
            )}
          >
            <div className="flex items-center gap-3">
              <Sliders size={16} />
              <span>Settings</span>
            </div>
            {isSettingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Submenu Items */}
          {isSettingsExpanded && (
            <div className="ml-5 mt-1 pl-2 border-l border-white/20 space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('settings-view')}
                className={cn(
                  "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer",
                  activeTab === 'settings-view'
                    ? isDark ? "bg-blue-600 text-white" : "bg-white text-blue-900 shadow-sm"
                    : isDark ? "text-slate-400 hover:text-white" : "text-blue-100 hover:bg-white/10"
                )}
              >
                <Eye size={14} />
                <span>View & Layout</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings-canvas')}
                className={cn(
                  "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer",
                  activeTab === 'settings-canvas'
                    ? isDark ? "bg-blue-600 text-white" : "bg-white text-blue-900 shadow-sm"
                    : isDark ? "text-slate-400 hover:text-white" : "text-blue-100 hover:bg-white/10"
                )}
              >
                <Grid size={14} />
                <span>Canvas Grid</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer Theme Toggle */}
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={toggleColorMode}
          className={cn(
            "w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer",
            isDark ? "bg-slate-800 text-amber-400 hover:bg-slate-700" : "bg-white/20 text-white hover:bg-white/30"
          )}
        >
          <span className="flex items-center gap-2">
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            <span>Theme Mode</span>
          </span>
          <span className="uppercase text-[10px] font-extrabold opacity-80">{colorMode}</span>
        </button>
      </div>
    </div>
  );
};
