import { useState, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { useFitView } from '@/hooks/useFitView';
import { getCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import {
  BackstageTab,
  restoreRecentFile,
  deleteRecentFile,
  openRecentFileFolder,
} from './fileBackstageHelpers';
import { useRecentFilesState } from './useRecentFilesState';

export interface UseFileBackstageViewParams {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface QuickSaveContext {
  app: any;
  content: string;
  onClose: () => void;
  loadRecentFiles: () => Promise<void>;
}

const tryUpdateExistingProject = async (
  ctx: QuickSaveContext,
  currentProject: { id: number; name: string } | null,
  isAutosaveOn: boolean
): Promise<boolean> => {
  if (!currentProject || currentProject.id === -1 || !ctx.app?.UpdateProject) {
    return false;
  }
  if (isAutosaveOn) {
    ctx.onClose();
    return true;
  }
  const success = await ctx.app.UpdateProject(currentProject.id, ctx.content);
  if (success) {
    useFlowStore.setState({ lastSavedSnapshot: ctx.content });
    await ctx.loadRecentFiles();
    ctx.onClose();
    return true;
  }
  return false;
};

const trySaveProjectRecord = async (
  ctx: QuickSaveContext,
  saveName: string
): Promise<boolean> => {
  if (!ctx.app?.SaveProject) return false;
  const id = await ctx.app.SaveProject(saveName, ctx.content);
  if (id !== undefined) {
    useFlowStore.setState({
      currentProject: { id, name: saveName },
      lastSavedSnapshot: ctx.content,
    });
    await ctx.loadRecentFiles();
    ctx.onClose();
    return true;
  }
  return false;
};

const trySaveAutosaveSettings = async (
  ctx: QuickSaveContext,
  sessionKey: string
): Promise<boolean> => {
  if (!ctx.app?.SaveSetting) return false;
  await ctx.app.SaveSetting(sessionKey, ctx.content);
  await ctx.app.SaveSetting('auto_saved_profile_latest', sessionKey);
  await ctx.app.SaveSetting('auto_saved_profile_content', ctx.content);
  await ctx.loadRecentFiles();
  ctx.onClose();
  return true;
};

const executeQuickSave = async (
  ctx: QuickSaveContext,
  currentProject: { id: number; name: string } | null,
  newProjectName: string,
  isAutosaveOn: boolean
): Promise<void> => {
  if (await tryUpdateExistingProject(ctx, currentProject, isAutosaveOn)) {
    return;
  }

  const trimmedName = newProjectName.trim();
  const currentSessionKey = getCurrentSessionAutosaveKey();
  const isCustomProjectName = Boolean(trimmedName && trimmedName !== currentSessionKey);

  if (isCustomProjectName && (await trySaveProjectRecord(ctx, trimmedName))) {
    return;
  }

  if (isAutosaveOn && (await trySaveAutosaveSettings(ctx, currentSessionKey))) {
    return;
  }

  const saveName = trimmedName || currentSessionKey;
  await trySaveProjectRecord(ctx, saveName);
};

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

    await executeQuickSave(
      { app, content, onClose, loadRecentFiles },
      currentProject,
      newProjectName,
      isAutosaveOn
    );
  };

  const handleRestore = async (item: Parameters<typeof restoreRecentFile>[0]) => {
    await restoreRecentFile(item, onClose, fitView);
  };

  const handleDeleteFile = async (item: Parameters<typeof deleteRecentFile>[0]) => {
    await deleteRecentFile(item, loadRecentFiles);
  };

  const handleOpenFolder = async (item: Parameters<typeof openRecentFileFolder>[0]) => {
    await openRecentFileFolder(item);
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
    handleOpenFolder,
  };
}
