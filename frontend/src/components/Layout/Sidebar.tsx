import React, { useState } from 'react';
import { Box, Layers, Network, Anchor, Search, Globe, ChevronDown, ChevronRight, Activity, Database, Settings, Lock, ShieldCheck } from 'lucide-react';
import { K8sResourceType } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { SidebarContextMenu, useSidebarContextMenu } from '../UI/SidebarContextMenu';
import './Sidebar.css';

interface SidebarProps {
  onAddNode: (type: K8sResourceType, position?: { x: number, y: number }) => void;
}

const ITEM_STYLES: Record<string, { border: string, text: string }> = {
  Deployment: { border: "border-l-violet-500 hover:border-violet-500", text: "text-violet-400" },
  Pod: { border: "border-l-cyan-500 hover:border-cyan-500", text: "text-cyan-400" },
  Service: { border: "border-l-amber-500 hover:border-amber-500", text: "text-amber-400" },
  Ingress: { border: "border-l-rose-500 hover:border-rose-500", text: "text-rose-400" },
  HPA: { border: "border-l-fuchsia-500 hover:border-fuchsia-500", text: "text-fuchsia-400" },
  Internet: { border: "border-l-blue-500 hover:border-blue-500", text: "text-blue-400" },
  PVC: { border: "border-l-orange-500 hover:border-orange-500", text: "text-orange-400" },
  Namespace: { border: "border-l-emerald-500 hover:border-emerald-500", text: "text-emerald-400" },
  ConfigMap: { border: "border-l-teal-500 hover:border-teal-500", text: "text-teal-400" },
  Secret: { border: "border-l-rose-400 hover:border-rose-400", text: "text-rose-400" },
  Role: { border: "border-l-indigo-500 hover:border-indigo-500", text: "text-indigo-400" },
};

const SECTIONS = [
  { id: 'workloads', title: 'Workloads', filter: (type: string) => type === 'Deployment' || type === 'Pod' },
  { id: 'networking', title: 'Networking', filter: (type: string) => type === 'Service' || type === 'Namespace' || type === 'Ingress' },
  { id: 'security', title: 'Security & Access', filter: (type: string) => type === 'Role' },
  { id: 'configuration', title: 'Configuration', filter: (type: string) => type === 'ConfigMap' || type === 'Secret' },
  { id: 'scaling', title: 'Scaling', filter: (type: string) => type === 'HPA' },
  { id: 'others', title: 'Others', filter: (type: string) => type === 'Internet' || type === 'PVC' },
];

const SidebarSection = ({ 
  title, 
  items, 
  isExpanded, 
  onToggle, 
  onAddNode, 
  onDragStart, 
  onDragEnd, 
  colorMode 
}: { 
  title: string; 
  items: any[]; 
  isExpanded: boolean; 
  onToggle: () => void; 
  onAddNode: (type: K8sResourceType) => void;
  onDragStart: (event: React.DragEvent, type: K8sResourceType) => void;
  onDragEnd: () => void;
  colorMode: string;
}) => {
  if (items.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "sidebar-section-toggle-btn",
          colorMode === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
        )}
      >
        {title}
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      <div className={cn(
        "grid gap-2 mt-1 overflow-hidden transition-all", 
        isExpanded ? "max-h-[500px] opacity-100 visible" : "max-h-0 opacity-0 invisible"
      )}>
        {items.map(({ type, icon: Icon, label, desc }) => {
          const style = ITEM_STYLES[type] || ITEM_STYLES.Namespace;
          
          return (
            <button
              type="button"
              key={type}
              onClick={() => onAddNode(type)}
              onDragStart={(event) => onDragStart(event, type)}
              onDragEnd={onDragEnd}
              draggable
              className={cn(
                "sidebar-item-card group",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:bg-slate-700/50" : "bg-white border-slate-200 hover:bg-slate-50",
                style.border
              )}
            >
              <div className={cn(
                "p-1.5 rounded transition-colors",
                colorMode === 'dark' ? "bg-slate-900/50" : "bg-slate-100",
                style.text
              )}>
                <Icon size={16} />
              </div>
              <div className="text-left overflow-hidden">
                <div className={cn("text-xs font-semibold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                  {label}
                </div>
                <div className={cn("text-[9px] font-medium truncate", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
                  {desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export const Sidebar = ({ onAddNode }: SidebarProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const setSidebarVisible = useFlowStore((state) => state.setSidebarVisible);
  const setDraggingSidebarItem = useFlowStore((state) => state.setDraggingSidebarItem);
  const { contextMenu, handleContextMenu, closeContextMenu } = useSidebarContextMenu();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    workloads: true,
    networking: false,
    configuration: false,
    scaling: false,
    others: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const isCurrentlyExpanded = prev[section];
      const newState = { workloads: false, networking: false, configuration: false, scaling: false, others: false };
      newState[section as keyof typeof newState] = !isCurrentlyExpanded;
      return newState;
    });
  };

  const items: { type: K8sResourceType; icon: any; label: string; desc: string }[] = [
    { type: 'Pod', icon: Box, label: 'Pod', desc: 'Atomic unit of K8s' },
    { type: 'Service', icon: Network, label: 'Service', desc: 'Network endpoint' },
    { type: 'Deployment', icon: Layers, label: 'Deployment', desc: 'Pod controller' },
    { type: 'Namespace', icon: Anchor, label: 'Namespace', desc: 'Virtual cluster' },
    { type: 'Internet', icon: Globe, label: 'Internet', desc: 'External Component' },
    { type: 'Ingress', icon: Globe, label: 'Ingress', desc: 'External Access' },
    { type: 'HPA', icon: Activity, label: 'HPA', desc: 'Auto-scaling' },
    { type: 'PVC', icon: Database, label: 'PVC', desc: 'Storage Claim' },
    { type: 'Role', icon: ShieldCheck, label: 'Role', desc: 'RBAC Access Role' },
    { type: 'ConfigMap', icon: Settings, label: 'ConfigMap', desc: 'General Config' },
    { type: 'Secret', icon: Lock, label: 'Secret', desc: 'Sensitive Data' },
  ];

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onDragStart = (event: React.DragEvent, nodeType: K8sResourceType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingSidebarItem(nodeType);
  };

  const onDragEnd = () => {
    setDraggingSidebarItem(null);
    useFlowStore.setState((state) => ({
      nodes: state.nodes.map((n) => (n.data?.isHovered ? { ...n, data: { ...n.data, isHovered: false } } : n)),
    }));
  };

  return (
    <div
      id="sidebar-components"
      onContextMenu={handleContextMenu}
      className={cn(
        "sidebar-container w-64 border-r relative",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}
    >
      {contextMenu && (
        <SidebarContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
          onCloseSidebar={() => setSidebarVisible(false)}
          onCloseContextMenu={closeContextMenu}
          testId="left-sidebar-context-menu"
          changeThemeTestId="left-sidebar-change-theme"
          closeTestId="left-sidebar-close"
        />
      )}
      <div className={cn("sidebar-header-area", colorMode === 'dark' ? "border-slate-800" : "border-slate-200")}>
        <div className="flex items-center justify-between">
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
            Components
          </p>
        </div>
        <div className="relative">
          <Search className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} size={12} />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "sidebar-search-input",
              colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
            )}
          />
        </div>
      </div>

      <div className="sidebar-content-scroll">
        {SECTIONS.map(section => (
          <SidebarSection 
            key={section.id}
            title={section.title} 
            items={filteredItems.filter(i => section.filter(i.type))}
            isExpanded={expandedSections[section.id]}
            onToggle={() => toggleSection(section.id)}
            onAddNode={onAddNode}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            colorMode={colorMode}
          />
        ))}

        {filteredItems.length === 0 && (
          <div className={cn("text-center py-8", colorMode === 'dark' ? "text-slate-600" : "text-slate-400")}>
            <Search size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-[10px] font-medium">No elements found</p>
          </div>
        )}
      </div>
    </div>
  );
};
