import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Box, Code, Layers, Minus, Plus, Server, Eye, EyeOff } from 'lucide-react';
import { RUNTIMES, WEBSERVERS, CPU_OPTIONS, MEMORY_OPTIONS } from '../constants/config';

interface WorkloadConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const WorkloadConfig = ({ selectedNode, performUpdate, toggleVisibility }: WorkloadConfigProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const data = selectedNode.data;
  const selectedPodLabel = selectedNode.data.label;
  const podReplicaGroup = selectedNode.type === 'Pod' && selectedNode.parentId
    ? nodes.filter(n =>
        n.type === 'Pod' &&
        n.parentId === selectedNode.parentId &&
        n.data.label === selectedPodLabel
      )
    : [];
  const replicaValue = podReplicaGroup.length > 0
    ? podReplicaGroup.reduce((acc, pod) => acc + (pod.data.replicas || 1), 0)
    : data.replicas || (selectedNode.type === 'Pod' ? 1 : 0);

  const updateReplicas = (replicas: number) => {
    if (selectedNode.type === 'Pod' && selectedNode.parentId) {
      const state = useFlowStore.getState();
      const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parent?.type === 'Deployment' || parent?.type === 'PodGroup') {
        updateNodeData(selectedNode.parentId, { replicas });
      } else {
        updateNodeData(selectedNode.id, { replicas });
      }
    } else {
      updateNodeData(selectedNode.id, { replicas });
    }
  };

  return (
    <div className="space-y-4">
      {/* Replicas */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Layers size={10} /> Replicas
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateReplicas(Math.max(1, replicaValue - 1))}
            className={cn(
              "p-2 rounded border outline-none transition-colors hover:bg-opacity-80",
              colorMode === 'dark'
                ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                : "bg-slate-100 border-slate-300 hover:bg-slate-200"
            )}
          >
            <Minus size={12} />
          </button>
          <input
            type="number"
            min="1"
            value={replicaValue}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                updateReplicas(parseInt(value) || 1);
              }
            }}
            className={cn(
              "flex-1 text-[10px] p-2 rounded border outline-none text-center",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            )}
          />
          <button
            onClick={() => updateReplicas(replicaValue + 1)}
            className={cn(
              "p-2 rounded border outline-none transition-colors hover:bg-opacity-80",
              colorMode === 'dark'
                ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                : "bg-slate-100 border-slate-300 hover:bg-slate-200"
            )}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Resource Limits */}
      <div className="space-y-3 p-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-500/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Resource Settings</span>
          <button onClick={() => toggleVisibility('resources')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.resources !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Layers size={10} /> CPU Limit
          </label>
          <div className="flex flex-wrap gap-1">
            {CPU_OPTIONS.map((cpu) => (
              <button
                key={cpu.value}
                onClick={() => performUpdate({ cpuLimit: cpu.value })}
                className={cn(
                  "text-[9px] px-2 py-1 rounded border transition-all",
                  data.cpuLimit === cpu.value
                    ? "bg-violet-600 border-violet-600 text-white"
                    : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
                )}
              >
                {cpu.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Layers size={10} /> Memory Limit
          </label>
          <div className="flex flex-wrap gap-1">
            {MEMORY_OPTIONS.map((mem) => (
              <button
                key={mem.value}
                onClick={() => performUpdate({ memoryLimit: mem.value })}
                className={cn(
                  "text-[9px] px-2 py-1 rounded border transition-all",
                  data.memoryLimit === mem.value
                    ? "bg-violet-600 border-violet-600 text-white"
                    : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
                )}
              >
                {mem.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Image Visibility Toggle */}
      <div className="flex items-center justify-between py-1 border-t border-dashed border-slate-700/30">
        <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Box size={10} /> Show Image
        </span>
        <button onClick={() => toggleVisibility('image')} className="text-slate-500 hover:text-blue-500 transition-colors">
          {(data.displaySettings?.image !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
        </button>
      </div>

      {/* Web Server */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Server size={10} /> Web Server
          </label>
          <button onClick={() => toggleVisibility('webserver')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.webserver !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {WEBSERVERS.map((ws) => (
            <button
              key={ws.id}
              onClick={() => performUpdate({ webserver: ws.id })}
              className={cn(
                "text-[9px] py-1 rounded border transition-all",
                data.webserver === ws.id
                  ? "bg-blue-600 border-blue-600 text-white"
                  : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
              )}
            >
              {ws.label}
            </button>
          ))}
        </div>
      </div>

      {/* Runtime */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Code size={10} /> App Runtime
          </label>
          <button onClick={() => toggleVisibility('runtime')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.runtime !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <select
          value={data.runtime || 'none'}
          onChange={(e) => performUpdate({ runtime: e.target.value, framework: '' })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
          )}
        >
          {Object.entries(RUNTIMES).map(([id, rt]) => (
            <option key={id} value={id}>{rt.label}</option>
          ))}
        </select>
      </div>

      {/* Framework */}
      {data.runtime && data.runtime !== 'none' && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Box size={10} /> Framework
          </label>
          <div className="flex flex-wrap gap-1">
            {RUNTIMES[data.runtime as keyof typeof RUNTIMES]?.frameworks.map((fw) => (
              <button
                key={fw}
                onClick={() => performUpdate({ framework: fw })}
                className={cn(
                  "text-[8px] px-2 py-1 rounded-full border transition-all",
                  data.framework === fw
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : (colorMode === 'dark' ? "bg-slate-950 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300")
                )}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
