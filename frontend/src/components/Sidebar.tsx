import React, { useState } from 'react';
import { Box, Layers, Network, Anchor, Plus, FileCode, Sun, Moon, Search, Globe, FolderOpen, Activity } from 'lucide-react';
import { K8sResourceType } from '../types';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { ProjectManager } from './ProjectManager';

interface SidebarProps {
  onAddNode: (type: K8sResourceType, position?: { x: number, y: number }) => void;
  onExport: () => void;
}

export const Sidebar = ({ onAddNode, onExport }: SidebarProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const currentProject = useFlowStore((state) => state.currentProject);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const setDraggingSidebarItem = useFlowStore((state) => state.setDraggingSidebarItem);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProjectOpen, setIsProjectOpen] = useState(false);

  const items: { type: K8sResourceType; icon: any; label: string; desc: string }[] = [
    { type: 'Pod', icon: Box, label: 'Pod', desc: 'Atomic unit of K8s' },
    { type: 'Service', icon: Network, label: 'Service', desc: 'Network endpoint' },
    { type: 'Deployment', icon: Layers, label: 'Deployment', desc: 'Pod controller' },
    { type: 'Namespace', icon: Anchor, label: 'Namespace', desc: 'Virtual cluster' },
    { type: 'Internet', icon: Globe, label: 'Internet', desc: 'External Component' },
    { type: 'Ingress', icon: Globe, label: 'Ingress', desc: 'External Access' },
    { type: 'HPA', icon: Activity, label: 'HPA', desc: 'Auto-scaling' },
  ];

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const workloadItems = filteredItems.filter(i => i.type === 'Deployment' || i.type === 'Pod');
  const networkingItems = filteredItems.filter(i => i.type === 'Service' || i.type === 'Namespace' || i.type === 'Ingress');
  const scalingItems = filteredItems.filter(i => i.type === 'HPA');
  const othersItems = filteredItems.filter(i => i.type === 'Internet');

  const onDragStart = (event: React.DragEvent, nodeType: K8sResourceType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingSidebarItem(nodeType);
  };

  const onDragEnd = () => {
    setDraggingSidebarItem(null);
  };

  return (
    <div className={cn(
      "w-64 border-r flex flex-col h-full shrink-0 z-10 transition-colors",
      colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className={cn(
        "p-5 border-b flex flex-col gap-4",
        colorMode === 'dark' ? "border-slate-800" : "border-slate-200"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={cn(
              "text-xs font-bold uppercase tracking-[0.2em]",
              colorMode === 'dark' ? "text-blue-400" : "text-blue-600"
            )}>
              InfraStack Architect
            </h1>
            <p className={cn(
              "text-[10px] mt-1 font-medium font-mono",
              colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
            )}>
              Cloud Component Library
            </p>
          </div>

          <button
            onClick={toggleColorMode}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              colorMode === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-200 text-slate-500"
            )}
            title="Toggle Theme"
          >
            {colorMode === 'dark' ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-blue-600" />}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2",
            colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
          )} size={12} />
          <input
            type="text"
            placeholder="Search elements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-8 pr-3 py-1.5 text-[10px] rounded-md border outline-none transition-all font-medium",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
            )}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
        {workloadItems.length > 0 && (
          <section>
            <label className={cn(
              "text-[10px] uppercase font-bold mb-3 block tracking-wider",
              colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
            )}>
              Workloads
            </label>
            <div className="grid gap-2">
              {workloadItems.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => onAddNode(type)}
                  onDragStart={(event) => onDragStart(event, type)}
                  onDragEnd={onDragEnd}
                  draggable
                  className={cn(
                    "group flex items-center gap-3 p-2 rounded-lg border-l-[3px] border cursor-grab transition-all duration-200",
                    colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700/50"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                    "hover:shadow-lg active:cursor-grabbing",
                    type === 'Deployment' ? "border-l-violet-500 hover:border-violet-500" : "border-l-cyan-500 hover:border-cyan-500"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded transition-colors",
                    colorMode === 'dark' ? "bg-slate-900/50" : "bg-slate-100",
                    type === 'Deployment' ? "text-violet-400" : "text-cyan-400"
                  )}>
                    <Icon size={16} />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className={cn(
                      "text-xs font-semibold",
                      colorMode === 'dark' ? "text-slate-200" : "text-slate-800"
                    )}>{label}</div>
                    <div className={cn(
                      "text-[9px] font-medium truncate",
                      colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
                    )}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {networkingItems.length > 0 && (
          <section>
            <label className={cn(
              "text-[10px] uppercase font-bold mb-3 block tracking-wider",
              colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
            )}>
              Networking
            </label>
            <div className="grid gap-2">
              {networkingItems.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => onAddNode(type)}
                  onDragStart={(event) => onDragStart(event, type)}
                  onDragEnd={onDragEnd}
                  draggable
                  className={cn(
                    "group flex items-center gap-3 p-2 rounded-lg border-l-[3px] border cursor-grab transition-all duration-200",
                    colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700/50"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                    "hover:shadow-lg active:cursor-grabbing",
                    type === 'Service' ? "border-l-amber-500 hover:border-amber-500" :
                    type === 'Ingress' ? "border-l-rose-500 hover:border-rose-500" :
                      "border-l-emerald-500 hover:border-emerald-500"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded transition-colors",
                    colorMode === 'dark' ? "bg-slate-900/50" : "bg-slate-100",
                    type === 'Service' ? "text-amber-400" :
                    type === 'Ingress' ? "text-rose-400" :
                      "text-emerald-400"
                  )}>
                    <Icon size={16} />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className={cn(
                      "text-xs font-semibold",
                      colorMode === 'dark' ? "text-slate-200" : "text-slate-800"
                    )}>{label}</div>
                    <div className={cn(
                      "text-[9px] font-medium truncate",
                      colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
                    )}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {scalingItems.length > 0 && (
          <section>
            <label className={cn(
              "text-[10px] uppercase font-bold mb-3 block tracking-wider",
              colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
            )}>
              Scaling
            </label>
            <div className="grid gap-2">
              {scalingItems.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => onAddNode(type)}
                  onDragStart={(event) => onDragStart(event, type)}
                  onDragEnd={onDragEnd}
                  draggable
                  className={cn(
                    "group flex items-center gap-3 p-2 rounded-lg border-l-[3px] border cursor-grab transition-all duration-200",
                    colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700/50"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                    "hover:shadow-lg active:cursor-grabbing",
                    "border-l-fuchsia-500 hover:border-fuchsia-500"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded transition-colors",
                    colorMode === 'dark' ? "bg-slate-900/50" : "bg-slate-100",
                    "text-fuchsia-400"
                  )}>
                    <Icon size={16} />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className={cn(
                      "text-xs font-semibold",
                      colorMode === 'dark' ? "text-slate-200" : "text-slate-800"
                    )}>{label}</div>
                    <div className={cn(
                      "text-[9px] font-medium truncate",
                      colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
                    )}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {othersItems.length > 0 && (
          <section>
            <label className={cn(
              "text-[10px] uppercase font-bold mb-3 block tracking-wider",
              colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
            )}>
              Others
            </label>
            <div className="grid gap-2">
              {othersItems.map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => onAddNode(type)}
                  onDragStart={(event) => onDragStart(event, type)}
                  onDragEnd={onDragEnd}
                  draggable
                  className={cn(
                    "group flex items-center gap-3 p-2 rounded-lg border-l-[3px] border cursor-grab transition-all duration-200",
                    colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700/50"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                    "hover:shadow-lg active:cursor-grabbing",
                    type === 'Internet' ? "border-l-blue-500 hover:border-blue-500" :
                      "border-l-slate-500 hover:border-slate-500"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded transition-colors",
                    colorMode === 'dark' ? "bg-slate-900/50" : "bg-slate-100",
                    type === 'Internet' ? "text-blue-400" :
                      "text-slate-400"
                  )}>
                    <Icon size={16} />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className={cn(
                      "text-xs font-semibold",
                      colorMode === 'dark' ? "text-slate-200" : "text-slate-800"
                    )}>{label}</div>
                    <div className={cn(
                      "text-[9px] font-medium truncate",
                      colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
                    )}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {filteredItems.length === 0 && (
          <div className={cn(
            "text-center py-8",
            colorMode === 'dark' ? "text-slate-600" : "text-slate-400"
          )}>
            <Search size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-[10px] font-medium">No elements found</p>
          </div>
        )}
      </div>

      <div className={cn(
        "p-4 space-y-3",
        colorMode === 'dark' ? "bg-slate-950/50" : "bg-slate-100"
      )}>
        <button
          onClick={() => setIsProjectOpen(true)}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
            colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-blue-400" : "bg-white hover:bg-slate-50 text-blue-600 border border-slate-200"
          )}
        >
          <FolderOpen size={12} />
          Projects
        </button>
        <button
          onClick={onExport}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-2.5 rounded transition-all shadow-lg uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <FileCode size={12} />
          Export YAML
        </button>
      </div>

      <ProjectManager isOpen={isProjectOpen} onClose={() => setIsProjectOpen(false)} />
    </div>
  );
};
