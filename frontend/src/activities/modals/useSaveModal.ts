import { useState, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { generateTimestampedProjectName } from '@/components/Modals/resource-manager/resourceManagerHelpers';
import { useFitView } from '@/hooks/useFitView';
import { restoreRecentFile, deleteRecentFile, openRecentFileFolder, clearAllAutosaves } from '@/activities/layout/fileBackstageHelpers';
import { useRecentFilesState } from '@/activities/layout/useRecentFilesState';
import { getBackendGateway } from '@/gateway';

export interface UseSaveModalParams {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function useSaveModal({ isOpen, onClose }: UseSaveModalParams) {
  const fitView = useFitView();
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);

  const [newProjectName, setNewProjectName] = useState('');
  const [activeLocation, setActiveLocation] = useState<string>('~/.kube-simulator/app_settings_json');
  const [loadingFileId, setLoadingFileId] = useState<number | string | null>(null);

  const {
    recentFiles,
    isLoading,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    loadRecentFiles,
    handleRowContextMenu,
  } = useRecentFilesState(isOpen);

  const isCanvasEmpty = nodes.length === 0;

  useEffect(() => {
    if (!isOpen) return;

    if (currentProject) {
      setActiveLocation(`~/.kube-simulator/projects/project_${currentProject.id}.infra`);
      setNewProjectName(currentProject.name);
    } else {
      setActiveLocation('~/.kube-simulator/projects');
      setNewProjectName(generateTimestampedProjectName());
    }
  }, [isOpen, currentProject]);

  const handleQuickSaveCurrent = async () => {
    const content = JSON.stringify({ nodes, edges });
    const gateway = getBackendGateway();

    if (currentProject && currentProject.id !== -1) {
      const success = await gateway.updateProject(currentProject.id, content);
      if (success) {
        useFlowStore.setState({ lastSavedSnapshot: content });
        await loadRecentFiles();
        onClose();
        return;
      }
    }

    if (newProjectName.trim()) {
      const id = await gateway.saveProject(newProjectName.trim(), content);
      if (id !== undefined) {
        useFlowStore.setState({
          currentProject: { id, name: newProjectName.trim() },
          lastSavedSnapshot: content,
        });
        await loadRecentFiles();
        onClose();
      }
    }
  };

  const handleRestoreFile = async (item: Parameters<typeof restoreRecentFile>[0]) => {
    setLoadingFileId(item.id);
    try {
      await restoreRecentFile(item, onClose, fitView);
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleDeleteFile = async (item: Parameters<typeof deleteRecentFile>[0]) => {
    await deleteRecentFile(item, loadRecentFiles);
  };

  const handleOpenFolder = async (item: Parameters<typeof openRecentFileFolder>[0]) => {
    await openRecentFileFolder(item);
  };

  const hasAutosaves = recentFiles.some((f) => f.isAutosave);

  const handleClearAllAutosaves = async () => {
    const confirmClear = globalThis.confirm(
      'Clean up all autosave backups? Your saved projects will not be deleted.'
    );
    if (!confirmClear) return;
    await clearAllAutosaves(loadRecentFiles);
  };

  return {
    colorMode,
    toggleColorMode,
    currentProject,
    newProjectName,
    setNewProjectName,
    recentFiles,
    hasAutosaves,
    isLoading,
    loadingFileId,
    activeLocation,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    isCanvasEmpty,
    handleRowContextMenu,
    handleQuickSaveCurrent,
    handleRestoreFile,
    handleDeleteFile,
    handleOpenFolder,
    handleClearAllAutosaves,
  };
}
