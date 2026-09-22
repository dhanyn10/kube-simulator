import React, { useState } from 'react';
import { Box, Layers, Network, Anchor, Search, Globe, ChevronDown, ChevronRight, Activity, Database, Settings, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { K8sResourceType } from '@/types';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { SidebarContextMenu, useSidebarContextMenu } from '../UI/SidebarContextMenu';
import {
  ITEM_STYLES,
  SIDEBAR_SECTIONS,
  toggleSidebarAccordionSection,
  filterSidebarItems
} from '@/activities/layout';

interface SidebarProps {
  readonly onAddNode: (type: K8sResourceType, position?: { x: number; y: number }) => void;
}

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
  readonly title: string;
  readonly items: any[];
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onAddNode: (type: K8sResourceType) => void;
  readonly onDragStart: (event: React.DragEvent, type: K8sResourceType) => void;
  readonly onDragEnd: () => void;
  readonly colorMode: string;
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
          const isNonDraggable = type === 'IAM';

          return (
            <button
              type="button"
              key={type}
              id={`sidebar-item-${type}`}
              onClick={() => onAddNode(type)}
              onDragStart={(event) => {
                if (isNonDraggable) {
                  event.preventDefault();
                  onAddNode(type);
                } else {
                  onDragStart(event, type);
                }
              }}
              onDragEnd={onDragEnd}
              draggable={!isNonDraggable}
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
  const isTerminalOpen = useFlowStore((state) => state.isTerminalOpen);
  const setSidebarVisible = useFlowStore((state) => state.setSidebarVisible);
  const setDraggingSidebarItem = useFlowStore((state) => state.setDraggingSidebarItem);
  const setKubeIamModalOpen = useFlowStore((state) => state.setKubeIamModalOpen);
  const { contextMenu, handleContextMenu, closeContextMenu } = useSidebarContextMenu();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'useful-resources': true,
    workloads: true,
    networking: false,
    configuration: false,
    scaling: false,
    others: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => toggleSidebarAccordionSection(prev, section));
  };

  const items: { type: K8sResourceType; icon: any; label: string; desc: string }[] = [
    { type: 'IAM', icon: UserCheck, label: 'Kube IAM', desc: 'IAM User Management' },
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

  const trimmedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredItems = filterSidebarItems(items, searchTerm);

  const nodes = useFlowStore((state) => state.nodes);
  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const addLog = useFlowStore((state) => state.addLog);

  const handleAddNode = (type: K8sResourceType) => {
    if (type === 'IAM') {
      setKubeIamModalOpen(true);
      return;
    }

    if (type === 'Role') {
      const targetNode = nodes.find((n) => n.selected || n.id === configuringNodeId);
      if (targetNode) {
        setRoleModalTargetNode({ id: targetNode.id, label: targetNode.data?.label || targetNode.id });
      } else {
        addLog(
          'warn',
          "[Sidebar Action] 'Role' is an attached resource. Drag it onto a target card (e.g. Pod, Deployment, Service) or select a card first.",
          'UI'
        );
      }
      return;
    }

    onAddNode(type);
  };

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
        "sidebar-container w-64 border-r relative transition-all duration-300",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        isTerminalOpen ? "h-[calc(100vh-2.5rem-16rem)]" : "h-[calc(100vh-2.5rem)]"
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

      <div className="sidebar-content-scroll custom-scrollbar">
        {SIDEBAR_SECTIONS.map((section) => {
          const sectionItems = filteredItems.filter((i) => section.filter(i.type));
          const isExpanded = trimmedSearchTerm !== '' ? sectionItems.length > 0 : Boolean(expandedSections[section.id]);

          return (
            <SidebarSection
              key={section.id}
              title={section.title}
              items={sectionItems}
              isExpanded={isExpanded}
              onToggle={() => toggleSection(section.id)}
              onAddNode={handleAddNode}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              colorMode={colorMode}
            />
          );
        })}

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
