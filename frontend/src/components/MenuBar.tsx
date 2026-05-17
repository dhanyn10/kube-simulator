import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileCode, Save, Upload, FolderOpen, BookOpen, Info, Bug, CheckSquare, Square, Activity, ExternalLink } from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { WindowControls } from './WindowControls';
import { SimulationControls } from './SimulationControls';
import { MenuBarDropdown } from './MenuBarDropdown';
import { validateHpaTargets } from '../store/slices/simulationManager';

interface MenuBarProps {
  onExportYaml: () => void;
  onImportFile: () => void;
  onSaveFile: () => void;
  onOpenProjects: () => void;
  onOpenScenarios: () => void;
}

export const MenuBar = ({
  onExportYaml,
  onImportFile,
  onSaveFile,
  onOpenProjects,
  onOpenScenarios
}: MenuBarProps) => {
  const colorMode = useFlowStore((state: any) => state.colorMode);
  const isAutosaveEnabled = useFlowStore((state: any) => state.isAutosaveEnabled);
  const toggleAutosave = useFlowStore((state: any) => state.toggleAutosave);
  const currentProject = useFlowStore((state: any) => state.currentProject);
  const nodes = useFlowStore((state: any) => state.nodes);
  const edges = useFlowStore((state: any) => state.edges);
  const isSimulating = useFlowStore((state: any) => state.isSimulating);
  const setSimulation = useFlowStore((state: any) => state.setSimulation);
  const isMonitoringOpen = useFlowStore((state: any) => state.isMonitoringOpen);
  const setMonitoringOpen = useFlowStore((state: any) => state.setMonitoringOpen);
  const isMonitoringDetached = useFlowStore((state: any) => state.isMonitoringDetached);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      monitoringLabel = 'Close Monitoring Simulation';
    }

    return [
      {
        label: 'File',
        items: [
          { label: 'Save', icon: Save, onClick: onSaveFile, shortcut: 'Ctrl+S' },
          { label: 'Import', icon: Upload, onClick: onImportFile },
          { label: 'Export', icon: FileCode, onClick: onExportYaml },
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
          { type: 'separator' },
          {
            label: 'Canvas Settings...',
            icon: Activity,
            onClick: () => useFlowStore.getState().setCanvasConfigOpen(true)
          },
        ]
      },
      {
        label: 'Help',
        items: [
          { label: 'About', icon: Info, onClick: () => alert('Kube Simulator v1.0.0') },
          { label: 'Report Issue', icon: Bug, onClick: () => globalThis.open('https://github.com', '_blank') },
        ]
      }
    ];
  }, [onSaveFile, onImportFile, onExportYaml, onOpenProjects, onOpenScenarios, currentProject, nodes, edges, isAutosaveEnabled, toggleAutosave, isMonitoringDetached, isMonitoringOpen, setMonitoringOpen]);

  const hasInternet = useMemo(() => nodes.some((n: any) => n.type === 'Internet'), [nodes]);

  const hasHpaValidationError = useMemo(() => !validateHpaTargets(nodes, edges), [nodes, edges]);

  return (
    <div
      ref={menuRef}
      style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      className={cn(
        "h-10 border-b flex items-center px-4 justify-between z-50 select-none relative",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
      )}
    >
      <div className="flex items-center gap-1">
        {menuItems.map((menu) => (
          <MenuBarDropdown
            key={menu.label}
            menu={menu as any}
            activeMenu={activeMenu}
            setActiveMenu={setActiveMenu}
            colorMode={colorMode}
          />
        ))}

        <div className="mx-2 h-4 w-px bg-slate-700/30" />

        <SimulationControls
          isSimulating={isSimulating}
          setSimulation={setSimulation}
          hasInternet={hasInternet}
          hasHpaValidationError={hasHpaValidationError}
          colorMode={colorMode}
        />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
        <h1
          data-testid="app-title"
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.3em]",
            colorMode === 'dark' ? "text-blue-400" : "text-blue-600"
          )}
        >
          Kube Simulator
        </h1>
      </div>

      <WindowControls colorMode={colorMode} />
    </div>
  );
};
