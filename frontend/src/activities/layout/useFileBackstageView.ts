import { useState, useEffect, useRef } from 'react';
import { useFlowStore } from '@/store';
import { useFitView } from '@/hooks/useFitView';
import { getCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import {
  BackstageTab,
  RecentFileItem,
  fetchRecentFiles,
  restoreRecentFile,
} from './fileBackstageHelpers';

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
  };
}
