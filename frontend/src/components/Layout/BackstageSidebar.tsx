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
import {
  BackstageTab,
  getSidebarContainerClass,
  getBackButtonClass,
  getHomeItemClass,
  getActionButtonClass,
  getSettingsButtonClass,
  getSubmenuItemClass,
  getThemeToggleClass,
} from '@/activities/layout/fileBackstageHelpers';

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
    <div className={getSidebarContainerClass(isDark)}>
      {/* Back Button (← Arrow) */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          data-testid="file-backstage-back-btn"
          className={getBackButtonClass(isDark)}
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
          className={getHomeItemClass(activeTab, isDark)}
        >
          <Home size={16} />
          <span>Home</span>
        </button>

        {/* Save Item */}
        <button
          type="button"
          onClick={onQuickSaveCurrent}
          disabled={isCanvasEmpty}
          className={getActionButtonClass(isDark)}
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
          className={getActionButtonClass(isDark)}
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
          className={getActionButtonClass(isDark)}
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
          className={getActionButtonClass(isDark)}
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
            className={getSettingsButtonClass(activeTab, isDark)}
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
                className={getSubmenuItemClass(activeTab === 'settings-view', isDark)}
              >
                <Eye size={14} />
                <span>View & Layout</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings-canvas')}
                className={getSubmenuItemClass(activeTab === 'settings-canvas', isDark)}
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
          className={getThemeToggleClass(isDark)}
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
