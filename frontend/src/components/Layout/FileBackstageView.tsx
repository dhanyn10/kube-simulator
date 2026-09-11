import React from 'react';
import { cn } from '@/lib/utils';
import { WindowControls } from '@/components/Layout/WindowControls';
import { BackstageSidebar } from '@/components/Layout/BackstageSidebar';
import { BackstageHomeTab } from '@/components/Layout/BackstageHomeTab';
import { BackstageSettingsTab } from '@/components/Layout/BackstageSettingsTab';
import { BackstageContextMenu } from '@/components/Layout/BackstageContextMenu';
import { useFileBackstageView } from '@/activities/layout/useFileBackstageView';

export interface FileBackstageViewProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
  readonly onImportFile: () => void;
  readonly onExportYaml: () => void;
}

/**
 * MS Word 2021 Style Fullscreen File Backstage View
 */
export const FileBackstageView: React.FC<FileBackstageViewProps> = ({
  isOpen,
  onClose,
  onSaveAs,
  onImportFile,
  onExportYaml,
}) => {
  const {
    colorMode,
    toggleColorMode,
    isSidebarVisible,
    isRightSidebarVisible,
    isMonitoringOpen,
    isAutofocusEnabled,
    isAutosaveEnabled,
    setSidebarVisible,
    setRightSidebarVisible,
    setMonitoringOpen,
    toggleAutofocus,
    toggleAutosave,
    canvasBgVariant,
    canvasBgColor,
    canvasBgOpacity,
    setCanvasBgVariant,
    setCanvasBgColor,
    setCanvasBgOpacity,
    activeTab,
    setActiveTab,
    isSettingsExpanded,
    setIsSettingsExpanded,
    newProjectName,
    setNewProjectName,
    recentFiles,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    isCanvasEmpty,
    currentProject,
    handleRowContextMenu,
    handleQuickSaveCurrent,
    handleRestore,
  } = useFileBackstageView({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      data-testid="file-backstage-view"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item: null });
      }}
      className={cn(
        "fixed inset-0 z-[200] flex font-sans animate-in fade-in zoom-in-95 duration-150 select-none",
        colorMode === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      )}
    >
      {/* OS Window Controls - Positioned at top right edge of application window */}
      <div className="absolute top-0 right-0 z-50">
        <WindowControls colorMode={colorMode} />
      </div>

      {/* MS Word Left Sidebar */}
      <BackstageSidebar
        colorMode={colorMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSettingsExpanded={isSettingsExpanded}
        setIsSettingsExpanded={setIsSettingsExpanded}
        isCanvasEmpty={isCanvasEmpty}
        onClose={onClose}
        onQuickSaveCurrent={handleQuickSaveCurrent}
        onSaveAs={onSaveAs}
        onImportFile={onImportFile}
        onExportYaml={onExportYaml}
        toggleColorMode={toggleColorMode}
      />

      {/* Main Backstage Content Panel */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        <div className="max-w-4xl mx-auto space-y-6 pt-2">

          {/* TAB 1: HOME & RECENT FILES */}
          {activeTab === 'home' && (
            <BackstageHomeTab
              colorMode={colorMode}
              isAutosaveEnabled={isAutosaveEnabled}
              toggleAutosave={toggleAutosave}
              newProjectName={newProjectName}
              setNewProjectName={setNewProjectName}
              isCanvasEmpty={isCanvasEmpty}
              currentProjectId={currentProject?.id}
              recentFiles={recentFiles}
              handleQuickSaveCurrent={handleQuickSaveCurrent}
              onClose={onClose}
              onSaveAs={onSaveAs}
              handleRowContextMenu={handleRowContextMenu}
              handleRestoreFile={handleRestore}
            />
          )}

          {/* TAB 2 & 3: SETTINGS VIEW / CANVAS */}
          {activeTab.startsWith('settings-') && (
            <BackstageSettingsTab
              activeTab={activeTab}
              colorMode={colorMode}
              isSidebarVisible={isSidebarVisible}
              isRightSidebarVisible={isRightSidebarVisible}
              isMonitoringOpen={isMonitoringOpen}
              isAutofocusEnabled={isAutofocusEnabled}
              canvasBgVariant={canvasBgVariant}
              canvasBgColor={canvasBgColor}
              canvasBgOpacity={canvasBgOpacity}
              setSidebarVisible={setSidebarVisible}
              setRightSidebarVisible={setRightSidebarVisible}
              setMonitoringOpen={setMonitoringOpen}
              toggleAutofocus={toggleAutofocus}
              setCanvasBgVariant={setCanvasBgVariant}
              setCanvasBgColor={setCanvasBgColor}
              setCanvasBgOpacity={setCanvasBgOpacity}
            />
          )}

        </div>
      </div>

      {/* Profile Context Menu */}
      <BackstageContextMenu
        contextMenu={contextMenu}
        contextMenuRef={contextMenuRef}
        colorMode={colorMode}
        toggleColorMode={toggleColorMode}
        setContextMenu={setContextMenu}
        handleRestoreFile={handleRestore}
        onClose={onClose}
      />
    </div>
  );
};
