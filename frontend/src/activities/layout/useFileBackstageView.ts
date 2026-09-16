import { useState, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { useFitView } from '@/hooks/useFitView';
import { getCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import {
  BackstageTab,
  restoreRecentFile,
  deleteRecentFile,
} from './fileBackstageHelpers';
import { useRecentFilesState } from './useRecentFilesState';

export interface UseFileBackstageViewParams {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function useFileBackstageView({ isOpen, onClose }: UseFileBackstageViewParams) {
  const fitView = useFitView();
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);

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

  const [newProjectName, setNewProjectName] = useState('');

  const {
    recentFiles,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    loadRecentFiles,
    handleRowContextMenu,
  } = useRecentFilesState(isOpen);

  const isCanvasEmpty = nodes.length === 0;

  useEffect(() => {
    if (!isOpen) return;

    const currentKey = getCurrentSessionAutosaveKey();
    if (currentProject) {
      setNewProjectName(currentProject.name);
    } else {
      setNewProjectName(currentKey);
    }
  }, [isOpen, currentProject]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleRestore = async (item: Parameters<typeof restoreRecentFile>[0]) => {
    await restoreRecentFile(item, onClose, fitView);
  };

  const handleDeleteFile = async (item: Parameters<typeof deleteRecentFile>[0]) => {
    await deleteRecentFile(item, loadRecentFiles);
  };

  return {
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
    handleDeleteFile,
  };
}
