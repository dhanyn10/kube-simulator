import { useState, useEffect, useRef } from 'react';
import { useFlowStore } from '@/store';
import { generateTimestampedProjectName } from '@/components/UI/ResourceManager/resourceManagerHelpers';
import { useFitView } from '@/hooks/useFitView';
import {
  fetchRecentFiles,
  restoreRecentFile,
  RecentFileItem,
} from '@/activities/layout/fileBackstageHelpers';

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
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [activeLocation, setActiveLocation] = useState<string>('~/.kube-simulator/app_settings_json');

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

    if (currentProject) {
      setActiveLocation(`~/.kube-simulator/projects/${currentProject.id}/architecture.infra`);
      setNewProjectName(currentProject.name);
    } else {
      setActiveLocation('~/.kube-simulator/app_settings_json');
      setNewProjectName(generateTimestampedProjectName());
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

  const handleRowContextMenu = (e: React.MouseEvent, item: RecentFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

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

  const handleRestoreFile = async (item: RecentFileItem) => {
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
