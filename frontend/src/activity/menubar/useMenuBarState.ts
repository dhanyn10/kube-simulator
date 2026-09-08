import { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileCode, Save, Upload, FolderOpen, BookOpen, Info, Bug,
  CheckSquare, Square, Activity, ExternalLink, Bell, PlayCircle, Sliders, Terminal
} from 'lucide-react';
import { useFlowStore, FlowState } from '../../store';
import { validateHpaTargets } from '../../store/slices/simulationManager';
import { startTour } from '../../lib/tour';

export interface MenuBarStateOptions {
  readonly onExportYaml: () => void;
  readonly onImportFile: () => void;
  readonly onSaveFile: () => void;
  readonly onOpenProjects: () => void;
  readonly onOpenScenarios: () => void;
  readonly onOpenAbout: () => void;
  readonly onOpenSettings: () => void;
}

export const useMenuBarState = ({
  onExportYaml,
  onImportFile,
  onSaveFile,
  onOpenProjects,
  onOpenScenarios,
  onOpenAbout,
  onOpenSettings,
}: MenuBarStateOptions) => {
  const colorMode = useFlowStore((state: FlowState) => state.colorMode);
  const toggleColorMode = useFlowStore((state: FlowState) => state.toggleColorMode);
  const isAutosaveEnabled = useFlowStore((state: FlowState) => state.isAutosaveEnabled);
  const toggleAutosave = useFlowStore((state: FlowState) => state.toggleAutosave);
  const currentProject = useFlowStore((state: FlowState) => state.currentProject);
  const nodes = useFlowStore((state: FlowState) => state.nodes);
  const edges = useFlowStore((state: FlowState) => state.edges);
  const isSimulating = useFlowStore((state: FlowState) => state.isSimulating);
  const startSimulation = useFlowStore((state: FlowState) => state.startSimulation);
  const stopSimulation = useFlowStore((state: FlowState) => state.stopSimulation);
  const isMonitoringOpen = useFlowStore((state: FlowState) => state.isMonitoringOpen);
  const setMonitoringOpen = useFlowStore((state: FlowState) => state.setMonitoringOpen);
  const isMonitoringDetached = useFlowStore((state: FlowState) => state.isMonitoringDetached);
  const isSidebarVisible = useFlowStore((state: FlowState) => state.isSidebarVisible);
  const isRightSidebarVisible = useFlowStore((state: FlowState) => state.isRightSidebarVisible);
  const isHistoryViewOpen = useFlowStore((state: FlowState) => state.isHistoryViewOpen);
  const setHistoryViewOpen = useFlowStore((state: FlowState) => state.setHistoryViewOpen);
  const isAutofocusEnabled = useFlowStore((state: FlowState) => state.isAutofocusEnabled);
  const setSidebarVisible = useFlowStore((state: FlowState) => state.setSidebarVisible);
  const setRightSidebarVisible = useFlowStore((state: FlowState) => state.setRightSidebarVisible);
  const toggleAutofocus = useFlowStore((state: FlowState) => state.toggleAutofocus);
  const logs = useFlowStore((state: FlowState) => state.logs);
  const setLogModalOpen = useFlowStore((state: FlowState) => state.setLogModalOpen);
  const isTerminalOpen = useFlowStore((state: FlowState) => state.isTerminalOpen);
  const setTerminalOpen = useFlowStore((state: FlowState) => state.setTerminalOpen);
  const simulatedUpdateInfo = useFlowStore((state: FlowState) => state.simulatedUpdateInfo);
  const activeIdentity = useFlowStore((state: FlowState) => state.activeIdentity);
  const setKubeIamModalOpen = useFlowStore((state: FlowState) => state.setKubeIamModalOpen);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [updateAvailableInfo, setUpdateAvailableInfo] = useState<{ version: string; releaseUrl: string } | null>(null);

  const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;
  const menuRef = useRef<HTMLDivElement>(null);

  // Background update check on mount
  useEffect(() => {
    let isMounted = true;
    const checkForUpdatesBg = async () => {
      try {
        const app = globalThis.window?.go?.main?.App;
        if (app?.GetSystemInfo && app?.CheckForUpdates) {
          const sysInfo = await app.GetSystemInfo();
          const currentVer = sysInfo?.version || '';
          const update = await app.CheckForUpdates(currentVer);
          if (isMounted && update?.updateAvailable && update?.latestVersion) {
            setUpdateAvailableInfo({
              version: update.latestVersion,
              releaseUrl: update.releaseUrl || 'https://github.com/dhanyn10/kube-simulator/releases',
            });
          }
        }
      } catch {
        // Ignore background network check errors
      }
    };

    checkForUpdatesBg();
    return () => { isMounted = false; };
  }, []);

  // Sync with simulated admin update info if activated
  const effectiveUpdateInfo = useMemo(() => {
    if (simulatedUpdateInfo) {
      return { version: simulatedUpdateInfo.latestVersion, releaseUrl: simulatedUpdateInfo.releaseUrl };
    }
    return updateAvailableInfo;
  }, [simulatedUpdateInfo, updateAvailableInfo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = useMemo(() => {
    let monitoringLabel = 'Simulation';
    if (isMonitoringDetached) {
      monitoringLabel = 'Monitoring: Detached';
    } else if (isMonitoringOpen) {
      monitoringLabel = 'Close Simulation';
    }

    return [
      {
        label: 'File',
        items: [
          { label: 'Save', icon: Save, onClick: onSaveFile, shortcut: 'Ctrl+S' },
          { label: 'Import', icon: Upload, onClick: onImportFile },
          { label: 'Export', icon: FileCode, onClick: onExportYaml },
          { label: 'Settings', icon: Sliders, onClick: onOpenSettings },
        ]
      },
      {
        label: 'Resource',
        items: [
          { label: 'Resource Manager', icon: FolderOpen, onClick: onOpenProjects },
          { label: 'Scenarios', icon: BookOpen, onClick: onOpenScenarios },
          {
            label: 'Save',
            icon: Save,
            onClick: async () => {
              if (currentProject?.id !== undefined && currentProject.id !== -1) {
                const content = JSON.stringify({ nodes, edges });
                const success = await globalThis.go?.main?.App?.UpdateProject(currentProject.id, content);
                if (success) {
                  useFlowStore.setState({ lastSavedSnapshot: content });
                  alert("Resource architecture saved successfully!");
                }
              } else {
                onOpenProjects(); // Open manager to save as new
              }
            }
          },
          {
            label: isAutosaveEnabled ? 'Autosave: ON' : 'Autosave: OFF',
            icon: isAutosaveEnabled ? CheckSquare : Square,
            onClick: toggleAutosave
          },
        ]
      },
      {
        label: 'View',
        items: [
          {
            label: monitoringLabel,
            icon: isMonitoringDetached ? ExternalLink : Activity,
            onClick: () => !isMonitoringDetached && setMonitoringOpen(!isMonitoringOpen)
          },
          {
            label: 'Components',
            checked: isSidebarVisible,
            onClick: () => setSidebarVisible(!isSidebarVisible)
          },
          {
            label: 'Utilities',
            checked: isRightSidebarVisible && !isHistoryViewOpen,
            onClick: () => {
              if (isHistoryViewOpen) {
                setHistoryViewOpen(false);
              } else {
                setRightSidebarVisible(!isRightSidebarVisible);
              }
            }
          },
          {
            label: 'Autofocus',
            checked: isAutofocusEnabled,
            onClick: toggleAutofocus
          },
          {
            label: 'Logs',
            icon: Bell,
            onClick: () => setLogModalOpen(true)
          },
          {
            label: 'History',
            icon: Sliders,
            onClick: () => {
              if (!isRightSidebarVisible) {
                setRightSidebarVisible(true);
              }
              setHistoryViewOpen(true);
            }
          },
          {
            label: 'Terminal',
            icon: Terminal,
            onClick: () => setTerminalOpen(!isTerminalOpen)
          }
        ]
      },
      {
        label: 'Help',
        items: [
          { label: 'Take a Tour', icon: PlayCircle, onClick: () => startTour(colorMode) },
          { label: 'About', icon: Info, onClick: onOpenAbout },
          { label: 'Report Issue', icon: Bug, onClick: () => BrowserOpenURL('https://github.com/dhanyn10/kube-simulator/issues') },
        ]
      }
    ];
  }, [
    onSaveFile, onImportFile, onExportYaml, onOpenProjects, onOpenScenarios, onOpenAbout, onOpenSettings,
    currentProject, nodes, edges, isAutosaveEnabled, toggleAutosave, colorMode,
    isMonitoringDetached, isMonitoringOpen, setMonitoringOpen,
    isSidebarVisible, isRightSidebarVisible, isHistoryViewOpen, setHistoryViewOpen,
    isAutofocusEnabled, setSidebarVisible, setRightSidebarVisible, toggleAutofocus,
    setLogModalOpen, isTerminalOpen, setTerminalOpen
  ]);

  const hasInternet = useMemo(() => nodes.some((n: any) => n.type === 'Internet'), [nodes]);

  const hasHpaValidationError = useMemo(() => !validateHpaTargets(nodes, edges), [nodes, edges]);

  return {
    colorMode,
    toggleColorMode,
    isSimulating,
    startSimulation,
    stopSimulation,
    hasInternet,
    hasHpaValidationError,
    activeIdentity,
    setKubeIamModalOpen,
    effectiveUpdateInfo,
    errorCount,
    setLogModalOpen,
    activeMenu,
    setActiveMenu,
    menuRef,
    menuItems,
  };
};
