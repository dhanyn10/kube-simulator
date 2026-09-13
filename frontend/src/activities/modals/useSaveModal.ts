import { useState, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { generateTimestampedProjectName } from '@/components/UI/ResourceManager/resourceManagerHelpers';
import { useFitView } from '@/hooks/useFitView';
import { restoreRecentFile } from '@/activities/layout/fileBackstageHelpers';
import { useRecentFilesState } from '@/activities/layout/useRecentFilesState';

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

    if (currentProject) {
      setActiveLocation(`~/.kube-simulator/projects/${currentProject.id}/architecture.infra`);
      setNewProjectName(currentProject.name);
    } else {
      setActiveLocation('~/.kube-simulator/app_settings_json');
      setNewProjectName(generateTimestampedProjectName());
    }
  }, [isOpen, currentProject]);

  const handleQuickSaveCurrent = async () => {
    const content = JSON.stringify({ nodes, edges });
    const app = globalThis.go?.main?.App;

    if (currentProject && currentProject.id !== -1 && app?.UpdateProject) {
      const success = await app.UpdateProject(currentProject.id, content);
      if (success) {
        useFlowStore.setState({ lastSavedSnapshot: content });
        await loadRecentFiles();
        onClose();
        return;
      }
    }

    if (newProjectName.trim() && app?.SaveProject) {
      const id = await app.SaveProject(newProjectName.trim(), content);
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
    await restoreRecentFile(item, onClose, fitView);
  };

  return {
    colorMode,
    toggleColorMode,
    currentProject,
    newProjectName,
    setNewProjectName,
    recentFiles,
    activeLocation,
    contextMenu,
    setContextMenu,
    contextMenuRef,
    isCanvasEmpty,
    handleRowContextMenu,
    handleQuickSaveCurrent,
    handleRestoreFile,
  };
}
