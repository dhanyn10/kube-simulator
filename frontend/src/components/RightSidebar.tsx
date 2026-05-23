import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Eye,
  FileCode,
  Check,
  Activity,
  Info,
  Maximize,
  MousePointer2,
  ChevronDown,
  Layout
} from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { NodeConfig } from './NodeConfig';
import { EdgeConfig } from './EdgeConfig';
import { ResourceBudget } from './ResourceBudget';

interface SidebarDropdownProps {
  label: string;
  icon: any;
  items: { label: string; icon?: any; checked?: boolean; onClick: () => void }[];
  colorMode: 'dark' | 'light';
  align?: 'left' | 'right';
}

const SidebarDropdown = ({ label, icon: Icon, items, colorMode, align = 'left' }: SidebarDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
          colorMode === 'dark'
            ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
          isOpen && (colorMode === 'dark' ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700")
        )}
      >
        <Icon size={12} />
        {label}
        <ChevronDown size={10} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full mt-1 w-48 rounded-lg shadow-xl border py-1 z-[100] animate-in fade-in zoom-in-95 duration-100",
          align === 'right' ? "right-0" : "left-0",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                item.onClick();
                // Don't close if it's a toggle
                if (typeof item.checked !== 'boolean') setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-1.5 text-[10px] flex items-center justify-between transition-colors text-left",
                colorMode === 'dark'
                  ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                  : "hover:bg-slate-50 text-slate-700 hover:text-blue-700"
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon && <item.icon size={12} className="opacity-70" />}
                <span className="font-medium">{item.label}</span>
              </div>
              {item.checked && <Check size={12} className="text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const RightSidebar = ({ onExportYaml }: { onExportYaml: () => void }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const configuringEdgeId = useFlowStore((state) => state.configuringEdgeId);

  const visibleWidgets = useFlowStore((state) => state.visibleWidgets);
  const toggleWidget = useFlowStore((state) => state.toggleWidget);

  const selectedNode = nodes.find(n => n.id === configuringNodeId);
  const selectedEdge = edges.find(e => e.id === configuringEdgeId);
  const activeDeploymentId = useFlowStore((state) => state.activeDeploymentId);
  const isElementSelected = !!selectedNode || !!selectedEdge;

  const canvasWidgets = [
    { id: 'hardware-budget', label: 'Hardware Budget', icon: Activity },
    { id: 'object-stats', label: 'Object Statistics', icon: Info },
    { id: 'target-indicator', label: 'Target Indicator', icon: Maximize },
  ];

  const getElementSettings = () => {
    if (!selectedNode) return [];

    const settings: { label: string; checked: boolean; onClick: () => void }[] = [];
    const data = selectedNode.data;
    const displaySettings = data.displaySettings || {};

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
        const toggle = (field: string) => {
            const current = displaySettings[field] !== false;
            const updateNodeData = useFlowStore.getState().updateNodeData;
            updateNodeData(selectedNode.id, {
                displaySettings: { ...displaySettings, [field]: !current }
            });
        };

        settings.push({ label: 'Show Resources', checked: displaySettings.resources !== false, onClick: () => toggle('resources') });
        settings.push({ label: 'Show Image', checked: displaySettings.image !== false, onClick: () => toggle('image') });
        settings.push({ label: 'Show Web Server', checked: displaySettings.webserver !== false, onClick: () => toggle('webserver') });
        settings.push({ label: 'Show Runtime', checked: displaySettings.runtime !== false, onClick: () => toggle('runtime') });
    }

    return settings;
  };

  return (
    <div className={cn(
      "w-72 border-l flex flex-col h-full shrink-0 z-10 transition-colors overflow-hidden",
      colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      {/* Top Menu Bar */}
      <div className={cn(
        "h-10 border-b flex items-center px-3 justify-between shrink-0",
        colorMode === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-50/50 border-slate-200"
      )}>
        <div className="flex items-center gap-1">
          <SidebarDropdown
            label="Canvas"
            icon={Eye}
            colorMode={colorMode}
            align="left"
            items={[
              ...canvasWidgets.map(w => ({
                label: w.label,
                icon: w.icon,
                checked: visibleWidgets.includes(w.id),
                onClick: () => toggleWidget(w.id)
              })),
              { label: 'Open YAML Inspector', icon: FileCode, onClick: onExportYaml }
            ]}
          />
        </div>

        {isElementSelected && getElementSettings().length > 0 && (
          <SidebarDropdown
            label="Settings"
            icon={Layout}
            colorMode={colorMode}
            align="right"
            items={getElementSettings()}
          />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8 overscroll-contain custom-scrollbar">
        {isElementSelected && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800/50">
              <div className={cn(
                "p-2 rounded-lg",
                colorMode === 'dark' ? "bg-slate-800 text-blue-400" : "bg-slate-100 text-blue-600"
              )}>
                <Settings size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  {selectedEdge ? 'Edge' : selectedNode?.type} Config
                </h3>
                <p className="text-[9px] text-slate-500 font-medium">Modify element properties</p>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl border min-h-[300px] resize-y overflow-auto custom-scrollbar",
              colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
            )}>
              {selectedEdge ? (
                <EdgeConfig selectedEdge={selectedEdge} />
              ) : (
                <NodeConfig selectedNode={selectedNode} />
              )}
            </div>
          </div>
        )}

        {visibleWidgets.includes('hardware-budget') && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800/50">
              <div className={cn(
                "p-2 rounded-lg",
                colorMode === 'dark' ? "bg-slate-800 text-emerald-400" : "bg-slate-100 text-emerald-600"
              )}>
                <Activity size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">Hardware Budget</h3>
                <p className="text-[9px] text-slate-500 font-medium">Host resource tracking</p>
              </div>
            </div>
            <div className={cn(
              "p-4 rounded-xl border",
              colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
            )}>
              <ResourceBudget />
            </div>
          </div>
        )}

        {/* Status Indicators (Objects, Targets) */}
        {(visibleWidgets.includes('object-stats') || (visibleWidgets.includes('target-indicator') && activeDeploymentId)) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800/50">
              <div className={cn(
                "p-2 rounded-lg",
                colorMode === 'dark' ? "bg-slate-800 text-violet-400" : "bg-slate-100 text-violet-600"
              )}>
                <Info size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">Indicators</h3>
                <p className="text-[9px] text-slate-500 font-medium">Visual status tracking</p>
              </div>
            </div>

            <div className="space-y-2">
              {visibleWidgets.includes('object-stats') && (
                <div className={cn(
                  "p-3 rounded-xl border flex items-center justify-between",
                  colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
                )}>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Active Objects</span>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono font-bold",
                    colorMode === 'dark' ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
                  )}>
                    {nodes.length}
                  </div>
                </div>
              )}

              {visibleWidgets.includes('target-indicator') && activeDeploymentId && (
                <div className={cn(
                  "p-3 rounded-xl border flex items-center justify-between animate-pulse",
                  colorMode === 'dark' ? "bg-violet-500/5 border-violet-500/20" : "bg-violet-50/50 border-violet-100"
                )}>
                  <span className="text-[10px] font-bold text-violet-500/70 uppercase tracking-tight">Focus Target</span>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]",
                    colorMode === 'dark' ? "bg-violet-500/20 text-violet-400" : "bg-violet-100 text-violet-700"
                  )}>
                    {nodes.find(n => n.id === activeDeploymentId)?.data.label}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
