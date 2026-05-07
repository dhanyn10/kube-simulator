import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Settings, X } from 'lucide-react';
import { NodeConfig } from './NodeConfig';
import { EdgeConfig } from './EdgeConfig';

export const ConfigPanel = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const colorMode = useFlowStore((state) => state.colorMode);
  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const setConfiguringNodeId = useFlowStore((state) => state.setConfiguringNodeId);
  const configuringEdgeId = useFlowStore((state) => state.configuringEdgeId);
  const setConfiguringEdgeId = useFlowStore((state) => state.setConfiguringEdgeId);

  // Find the element being configured
  const selectedNode = nodes.find(n => n.id === configuringNodeId);
  const selectedEdge = edges.find(e => e.id === configuringEdgeId);

  if (!selectedNode && !selectedEdge) return null;

  const handleClose = () => {
    setConfiguringNodeId(null);
    setConfiguringEdgeId(null);
  };

  const isEdge = !!selectedEdge;
  const title = isEdge ? 'Edge Configuration' : `${selectedNode?.type} Configuration`;
  const IconColor = isEdge ? "text-blue-500" : (selectedNode?.type === 'Deployment' ? "text-violet-500" : "text-blue-500");

  return (
    <div className={cn(
      "fixed right-4 top-24 w-64 rounded-xl border shadow-2xl z-[50] p-4 animate-in slide-in-from-right flex flex-col resize-y overflow-hidden min-h-[200px] max-h-[70vh]",
      colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className="flex items-center justify-between mb-4 border-b pb-2 shrink-0">
        <div className="flex items-center gap-2">
            <Settings size={14} className={IconColor} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">
                {title}
            </h3>
        </div>
        <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-500/10 rounded-full transition-colors"
        >
            <X size={14} className="text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {isEdge ? (
          <EdgeConfig selectedEdge={selectedEdge} />
        ) : (
          <NodeConfig selectedNode={selectedNode} />
        )}

        {isEdge && (
          <div className="mt-8 pt-4 border-t text-center text-emerald-500">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
              Connection Styled
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
