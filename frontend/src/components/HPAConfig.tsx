import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Layers, Activity, Minus, Plus, Eye, EyeOff } from 'lucide-react';
import { K8sNodeData } from '../types';

interface HPAConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const HPAConfig = ({ selectedNode, performUpdate, toggleVisibility }: HPAConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const data = selectedNode.data;

  // Find connected deployment
  const connectedEdge = edges.find(e => e.source === selectedNode.id);
  const targetNode = connectedEdge ? nodes.find(n => n.id === connectedEdge.target) : null;
  const targetDeployment = targetNode?.type === 'Deployment' ? targetNode : null;

  const hasRequests = targetDeployment
    ? (targetDeployment.data as K8sNodeData).cpuRequest && (targetDeployment.data as K8sNodeData).memoryRequest
    : false;

  return (
    <div className="space-y-3 p-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-500/5">
      {/* Validation Status */}
      <div className={cn(
        "p-2 rounded border mb-2 flex items-center gap-2",
        !connectedEdge 
          ? "bg-slate-500/10 border-slate-500/30 text-slate-500" 
          : hasRequests 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            : "bg-amber-500/10 border-amber-500/30 text-amber-500"
      )}>
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          !connectedEdge ? "bg-slate-500" : hasRequests ? "bg-emerald-500" : "bg-amber-500"
        )} />
        <span className="text-[10px] font-bold">
          {!connectedEdge 
            ? "NOT CONNECTED" 
            : hasRequests 
              ? `LINKED TO ${(targetDeployment?.data as K8sNodeData).label.toUpperCase()}` 
              : "MISSING RESOURCE REQUESTS"}
        </span>
      </div>

      {!hasRequests && connectedEdge && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-500 leading-tight mb-2">
          HPA requires CPU/Memory requests on the target Deployment to function in real-world clusters.
          <button 
            onClick={() => {
              if (targetDeployment) {
                useFlowStore.getState().updateNodeData(targetDeployment.id, {
                  cpuRequest: '100m',
                  memoryRequest: '128Mi'
                });
              }
            }}
            className="block mt-1 underline font-bold hover:text-amber-400"
          >
            Fix automatically
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Layers size={10} /> Replicas Range
          </label>
          <button onClick={() => toggleVisibility('replicas')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.replicas !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <label className="text-[8px] text-slate-500 uppercase">Min Replicas</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => performUpdate({ minReplicas: Math.max(1, (data.minReplicas || 1) - 1) })}
            className={cn(
              "p-1.5 rounded border transition-colors",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
            )}
          >
            <Minus size={10} />
          </button>
          <span className="flex-1 text-center font-mono text-[10px]">{data.minReplicas || 1}</span>
          <button
            onClick={() => performUpdate({ minReplicas: (data.minReplicas || 1) + 1 })}
            className={cn(
              "p-1.5 rounded border transition-colors",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
            )}
          >
            <Plus size={10} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[8px] text-slate-500 uppercase">Max Replicas</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => performUpdate({ maxReplicas: Math.max(1, (data.maxReplicas || 1) - 1) })}
            className={cn(
              "p-1.5 rounded border transition-colors",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
            )}
          >
            <Minus size={10} />
          </button>
          <span className="flex-1 text-center font-mono text-[10px]">{data.maxReplicas || 1}</span>
          <button
            onClick={() => performUpdate({ maxReplicas: (data.maxReplicas || 1) + 1 })}
            className={cn(
              "p-1.5 rounded border transition-colors",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
            )}
          >
            <Plus size={10} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Activity size={10} /> Target CPU (%)
          </label>
          <button onClick={() => toggleVisibility('targetCPU')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.targetCPU !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="5"
          value={data.targetCPU || 50}
          onChange={(e) => performUpdate({ targetCPU: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[8px] font-mono text-slate-500">
          <span>10%</span>
          <span className="text-blue-500 font-bold">{data.targetCPU || 50}%</span>
          <span>90%</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Activity size={10} /> Target Mem (%)
          </label>
          <button onClick={() => toggleVisibility('targetMemory')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.targetMemory !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="5"
          value={data.targetMemory || 50}
          onChange={(e) => performUpdate({ targetMemory: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[8px] font-mono text-slate-500">
          <span>10%</span>
          <span className="text-blue-500 font-bold">{data.targetMemory || 50}%</span>
          <span>90%</span>
        </div>
      </div>
    </div>
  );
};
