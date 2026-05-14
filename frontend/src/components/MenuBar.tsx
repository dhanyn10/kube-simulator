import React, { useState, useRef, useEffect } from 'react';
import { FileCode, Save, Upload, FolderOpen, BookOpen, HelpCircle, Info, Bug, ChevronDown, Minus, Square, X as CloseIcon, CheckSquare, Play, Globe, Activity, ExternalLink } from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  const menuItems = [
    {
      label: 'File',
      items: [
        { label: 'Save', icon: Save, onClick: onSaveFile, shortcut: 'Ctrl+S' },
        { label: 'Import', icon: Upload, onClick: onImportFile },
        { label: 'Export', icon: FileCode, onClick: onExportYaml },
      ]
    },
    {
      label: 'Project',
      items: [
        { label: 'Manager', icon: FolderOpen, onClick: onOpenProjects },
        { label: 'Scenarios', icon: BookOpen, onClick: onOpenScenarios },
        { 
          label: 'Save', 
          icon: Save, 
          onClick: async () => {
            if (currentProject && currentProject.id !== -1) {
              const content = JSON.stringify({ nodes, edges });
              // @ts-ignore
              if (window.go?.main?.App?.UpdateProject) {
                // @ts-ignore
                const success = await window.go.main.App.UpdateProject(currentProject.id, content);
                if (success) {
                  useFlowStore.setState({ lastSavedSnapshot: content });
                  alert("Project saved successfully!");
                }
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
      label: 'Monitoring',
      items: [
        {
          label: isMonitoringDetached ? 'Monitoring: Detached' : (isMonitoringOpen ? 'Close Dashboard' : 'Open Dashboard'),
          icon: isMonitoringDetached ? ExternalLink : Activity,
          onClick: () => !isMonitoringDetached && setMonitoringOpen(!isMonitoringOpen)
        },
      ]
    },
    {
      label: 'View',
      items: [
        { 
          label: 'Arrange (L → R)', 
          icon: Play, 
          onClick: () => useFlowStore.getState().autoLayout('LR') 
        },
        { 
          label: 'Arrange (T → B)', 
          icon: ChevronDown, 
          onClick: () => useFlowStore.getState().autoLayout('TB') 
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
        { label: 'Report Issue', icon: Bug, onClick: () => window.open('https://github.com', '_blank') },
      ]
    }
  ];

  const internetNodes = nodes.filter((n: any) => n.type === 'Internet');
  const hasInternet = internetNodes.length > 0;

  // Validation: HPA requires resource limits on workloads
  const hpaNodes = nodes.filter((n: any) => n.type === 'HPA');
  let hasHpaValidationError = false;
  if (hpaNodes.length > 0) {
    hasHpaValidationError = hpaNodes.some((hpa: any) => {
      const outgoingEdges = edges.filter((e: any) => e.source === hpa.id);
      const targets = nodes.filter((n: any) => outgoingEdges.some((e: any) => e.target === n.id));
      return targets.some((target: any) => {
        const data = target.data;
        if (target.type === 'Deployment' || (target.type === 'Pod' && !target.parentId)) {
          return !data.cpuLimit || !data.memoryLimit;
        }
        return false;
      });
    });
  }

  return (
    <div
      ref={menuRef}
      style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
      className={cn(
        "h-10 border-b flex items-center px-4 justify-between z-50 select-none",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
      )}
    >
      <div className="flex items-center gap-1">
        {menuItems.map((menu) => (
          <div key={menu.label} className="relative" style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                activeMenu === menu.label
                  ? (colorMode === 'dark' ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900")
                  : (colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-200")
              )}
            >
              {menu.label}
            </button>

            {activeMenu === menu.label && (
              <div className={cn(
                "absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg border py-1 z-[100]",
                colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              )}>
                  {menu.items.map((item, idx) => (
                    item.type === 'separator' ? (
                      <div key={`sep-${idx}`} className={cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200")} />
                    ) : (
                      <button
                        key={item.label}
                        onClick={() => {
                          item.onClick();
                          if (!item.checked) setActiveMenu(null); // Keep open if it's a toggle
                        }}
                        className={cn(
                          "w-full px-4 py-1.5 text-xs flex items-center justify-between transition-colors group",
                          colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {typeof item.checked === 'boolean' && (
                            <div className={cn(
                              "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                              item.checked 
                                ? "bg-blue-500 border-blue-500 text-white" 
                                : (colorMode === 'dark' ? "border-slate-700" : "border-slate-300")
                            )}>
                              {item.checked && <CloseIcon size={10} className="rotate-45" />}
                            </div>
                          )}
                          <span>{item.label}</span>
                        </div>
                        {(item as any).shortcut && (
                          <span className="text-[10px] opacity-50 font-mono ml-4 group-hover:opacity-100">{(item as any).shortcut}</span>
                        )}
                      </button>
                    )
                  ))}
              </div>
            )}
          </div>
        ))}

        <div className="mx-2 h-4 w-px bg-slate-700/30" />

        {/* Simulation Controls */}
        <div className={cn(
          "flex items-center rounded-lg border p-0.5 shadow-sm",
          colorMode === 'dark' ? "bg-slate-900/50 border-slate-700/50" : "bg-white border-slate-200"
        )} style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setSimulation(!isSimulating)}
            disabled={!hasInternet}
            title={
              !hasInternet
                ? "Add an Internet card to start simulation"
                : hasHpaValidationError
                  ? "HPA requires Resource Limits on target workloads"
                  : (isSimulating ? "Stop Simulation" : "Start Simulation")
            }
            className={cn(
              "h-7 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm",
              !hasInternet
                ? "text-slate-400 cursor-not-allowed bg-transparent"
                : isSimulating
                  ? (hasHpaValidationError ? "bg-red-600 animate-pulse text-white" : "bg-red-500 text-white hover:bg-red-600")
                  : (hasHpaValidationError ? "bg-amber-500/50 text-amber-900 border-amber-500/50" : "bg-emerald-500 text-white hover:bg-emerald-600")
            )}
          >
            {isSimulating ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
            {isSimulating ? "Stop" : "Play"}
          </button>
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
        <h1 className={cn(
          "text-[11px] font-bold uppercase tracking-[0.3em]",
          colorMode === 'dark' ? "text-blue-400" : "text-blue-600"
        )}>
          Kube Simulator
        </h1>
      </div>

      <div className="flex items-center" style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => (window as any).go?.main?.App?.MinimizeWindow?.()}
          className={cn(
            "w-11 h-10 flex items-center justify-center transition-colors text-slate-500",
            colorMode === 'dark' ? "hover:bg-slate-800 hover:text-slate-200" : "hover:bg-slate-200 hover:text-slate-700"
          )}
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => (window as any).go?.main?.App?.MaximizeWindow?.()}
          className={cn(
            "w-11 h-10 flex items-center justify-center transition-colors text-slate-500",
            colorMode === 'dark' ? "hover:bg-slate-800 hover:text-slate-200" : "hover:bg-slate-200 hover:text-slate-700"
          )}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => (window as any).go?.main?.App?.CloseWindow?.()}
          className="w-11 h-10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-slate-500"
        >
          <CloseIcon size={18} />
        </button>
      </div>
    </div>
  );
};
