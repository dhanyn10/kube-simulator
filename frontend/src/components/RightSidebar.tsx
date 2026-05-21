import React, { useState, useMemo } from 'react';
import {
  Settings,
  Eye,
  FileCode,
  ChevronDown,
  ChevronRight,
  Check,
  Activity,
  Info,
  Maximize,
  MousePointer2
} from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { NodeConfig } from './NodeConfig';
import { EdgeConfig } from './EdgeConfig';
import { ResourceBudget } from './ResourceBudget';

export const RightSidebar = ({ onExportYaml }: { onExportYaml: () => void }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const configuringEdgeId = useFlowStore((state) => state.configuringEdgeId);
  const setConfiguringNodeId = useFlowStore((state) => state.setConfiguringNodeId);
  const setConfiguringEdgeId = useFlowStore((state) => state.setConfiguringEdgeId);

  const visibleWidgets = useFlowStore((state) => state.visibleWidgets);
  const toggleWidget = useFlowStore((state) => state.toggleWidget);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    config: true,
    view: true,
    inspector: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedNode = nodes.find(n => n.id === configuringNodeId);
  const selectedEdge = edges.find(e => e.id === configuringEdgeId);
  const isElementSelected = !!selectedNode || !!selectedEdge;

  const widgets = [
    { id: 'hardware-budget', label: 'Hardware Budget', icon: Activity },
    { id: 'object-stats', label: 'Object Statistics', icon: Info },
    { id: 'inspector-btn', label: 'YAML Inspector', icon: FileCode },
    { id: 'target-indicator', label: 'Target Indicator', icon: Maximize },
  ];

  return (
    <div className={cn(
      "w-64 border-l flex flex-col h-full shrink-0 z-10 transition-colors overflow-hidden",
      colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      {/* Header */}
      <div className={cn("p-5 border-b", colorMode === 'dark' ? "border-slate-800" : "border-slate-200")}>
        <p className={cn("text-[10px] font-bold uppercase tracking-widest", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
          Inspector & Config
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 overscroll-contain custom-scrollbar">

        {/* Element Configuration Section */}
        <section>
          <button
            onClick={() => toggleSection('config')}
            className={cn(
              "w-full flex items-center justify-between text-[10px] uppercase font-bold py-2 px-1 tracking-wider transition-colors",
              colorMode === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="flex items-center gap-2">
              <Settings size={12} />
              Configuration
            </div>
            {expandedSections.config ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          <div className={cn(
            "mt-2 overflow-hidden transition-all",
            expandedSections.config ? "max-h-[2000px] opacity-100 visible" : "max-h-0 opacity-0 invisible"
          )}>
            {!isElementSelected ? (
              <div className={cn(
                "p-8 border-2 border-dashed rounded-xl text-center",
                colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-100 text-slate-400"
              )}>
                <MousePointer2 size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-[10px] font-medium">Select an element to configure</p>
              </div>
            ) : (
              <div className={cn(
                "p-3 rounded-xl border",
                colorMode === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-50/50 border-slate-100"
              )}>
                {selectedEdge ? (
                  <EdgeConfig selectedEdge={selectedEdge} />
                ) : (
                  <NodeConfig selectedNode={selectedNode} />
                )}
              </div>
            )}
          </div>
        </section>

        {/* View Settings Section */}
        <section>
          <button
            onClick={() => toggleSection('view')}
            className={cn(
              "w-full flex items-center justify-between text-[10px] uppercase font-bold py-2 px-1 tracking-wider transition-colors",
              colorMode === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="flex items-center gap-2">
              <Eye size={12} />
              Canvas View
            </div>
            {expandedSections.view ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          <div className={cn(
            "mt-2 space-y-1 overflow-hidden transition-all",
            expandedSections.view ? "max-h-[500px] opacity-100 visible" : "max-h-0 opacity-0 invisible"
          )}>
            {widgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors group",
                  colorMode === 'dark' ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-1.5 rounded transition-colors",
                    visibleWidgets.includes(widget.id)
                      ? "bg-blue-500 text-white"
                      : (colorMode === 'dark' ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400")
                  )}>
                    <widget.icon size={14} />
                  </div>
                  <span className="text-xs font-medium">{widget.label}</span>
                </div>
                {visibleWidgets.includes(widget.id) && <Check size={14} className="text-blue-500" />}
              </button>
            ))}
          </div>
        </section>

        {/* Inspector Section */}
        <section>
          <button
            onClick={() => toggleSection('inspector')}
            className={cn(
              "w-full flex items-center justify-between text-[10px] uppercase font-bold py-2 px-1 tracking-wider transition-colors",
              colorMode === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="flex items-center gap-2">
              <FileCode size={12} />
              Inspector
            </div>
            {expandedSections.inspector ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          <div className={cn(
            "mt-2 overflow-hidden transition-all",
            expandedSections.inspector ? "max-h-[500px] opacity-100 visible" : "max-h-0 opacity-0 invisible"
          )}>
            <button
              onClick={onExportYaml}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
              )}
            >
              <div className="p-2 rounded-lg bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                <FileCode size={16} />
              </div>
              <div>
                <div className="text-xs font-bold">Open YAML Inspector</div>
                <p className="text-[10px] text-slate-500">View live export for selected nodes</p>
              </div>
            </button>
          </div>
        </section>

      </div>

      {visibleWidgets.includes('hardware-budget') && (
        <div className={cn("p-4 border-t shrink-0", colorMode === 'dark' ? "border-slate-800" : "border-slate-200")}>
          <ResourceBudget />
        </div>
      )}
    </div>
  );
};
