import React, { useState, useEffect, useRef } from 'react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { hydrateNodes } from '../../store/nodeHelpers';
import { useFitView } from '../../hooks/useFitView';
import { getCurrentSessionAutosaveKey } from '../../store/useFlowStore';
import { WindowControls } from './WindowControls';
import { BackstageSidebar } from './BackstageSidebar';
import { BackstageHomeTab } from './BackstageHomeTab';
import { BackstageSettingsTab } from './BackstageSettingsTab';
import { BackstageContextMenu } from './BackstageContextMenu';
import {
  BackstageTab,
  RecentFileItem,
  fetchRecentFiles,
  restoreRecentFile,
} from '../../activity/layout/fileBackstageHelpers';

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
  const fitView = useFitView();
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);

  // Settings store hooks
  const isSidebarVisible = useFlowStore((state) => state.isSidebarVisible);
  const isRightSidebarVisible = useFlowStore((state) => state.isRightSidebarVisible);
  const isMonitoringOpen = useFlowStore((state) => state.isMonitoringOpen);
  const isAutofocusEnabled = useFlowStore((state) => state.isAutofocusEnabled);
  const isAutosaveEnabled = useFlowStore((state) => state.isAutosaveEnabled);

  const setSidebarVisible = useFlowStore((state) => state.setSidebarVisible);
  const setRightSidebarVisible = useFlowStore((state) => state.setRightSidebarVisible);
  const setMonitoringOpen = useFlowStore((state) => state.setMonitoringOpen);
  const toggleAutofocus = useFlowStore((state) => state.toggleAutofocus);
  const toggleAutosave = useFlowStore((state) => state.toggleAutosave);

  const canvasBgVariant = useFlowStore((state) => state.canvasBgVariant);
  const canvasBgColor = useFlowStore((state) => state.canvasBgColor);
  const canvasBgOpacity = useFlowStore((state) => state.canvasBgOpacity);

  const setCanvasBgVariant = useFlowStore((state) => state.setCanvasBgVariant);
  const setCanvasBgColor = useFlowStore((state) => state.setCanvasBgColor);
  const setCanvasBgOpacity = useFlowStore((state) => state.setCanvasBgOpacity);

  const [activeTab, setActiveTab] = useState<BackstageTab>('home');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  // Save / Home tab states
  const [newProjectName, setNewProjectName] = useState('');
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecentFileItem | null } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const isCanvasEmpty = nodes.length === 0;

  const loadRecentFiles = async () => {
    const items = await fetchRecentFiles();
    setRecentFiles(items);
  };

  useEffect(() => {
    if (!isOpen) return;
    loadRecentFiles();

    const currentKey = getCurrentSessionAutosaveKey();
    if (currentProject) {
      setNewProjectName(currentProject.name);
    } else {
      setNewProjectName(currentKey);
    }
  }, [isOpen, currentProject]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      globalThis.addEventListener('click', handleClickOutside);
      globalThis.addEventListener('contextmenu', handleClickOutside);
    }
    return () => {
      globalThis.removeEventListener('click', handleClickOutside);
      globalThis.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu]);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRowContextMenu = (e: React.MouseEvent, item: RecentFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Directly update current active project / profile
  const handleQuickSaveCurrent = async () => {
    const isAutosaveOn = useFlowStore.getState().isAutosaveEnabled;
    const content = JSON.stringify({ nodes, edges, timestamp: Date.now() });
    const app = globalThis.go?.main?.App;

    if (currentProject && currentProject.id !== -1 && app?.UpdateProject) {
      if (isAutosaveOn) {
        onClose();
        return;
      }
      const success = await app.UpdateProject(currentProject.id, content);
      if (success) {
        useFlowStore.setState({ lastSavedSnapshot: content });
        await loadRecentFiles();
        onClose();
        return;
      }
    }

    if (isAutosaveOn && app?.SaveSetting) {
      const sessionKey = getCurrentSessionAutosaveKey();
      app.SaveSetting(sessionKey, content);
      app.SaveSetting('auto_saved_profile_latest', sessionKey);
      app.SaveSetting('auto_saved_profile_content', content);
      await loadRecentFiles();
      onClose();
      return;
    }

    const saveName = newProjectName.trim() || getCurrentSessionAutosaveKey();
    if (app?.SaveProject) {
      const id = await app.SaveProject(saveName, content);
      if (id !== undefined) {
        useFlowStore.setState({
          currentProject: { id, name: saveName },
          lastSavedSnapshot: content,
        });
        await loadRecentFiles();
        onClose();
      }
    }
  };

  const handleRestore = async (item: RecentFileItem) => {
    await restoreRecentFile(item, onClose, fitView);
  };

  if (!isOpen) return null;

  return (
    <div
      data-testid="file-backstage-view"
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
