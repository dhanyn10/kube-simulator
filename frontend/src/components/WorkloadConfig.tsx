import React from 'react';
import { useFlowStore } from '../store';
import { cn, parseCPU, parseMemory, validateResourceLimits } from '../lib/utils';
import { Box, Code, Layers, Server, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { RUNTIMES, WEBSERVERS, CPU_OPTIONS, MEMORY_OPTIONS } from '../constants/config';
import { SelectorGroup } from './SelectorGroup';
import { ConfigInput, ConfigSection, ConfigLabel, NumberStepper } from './ConfigUI';

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
    ? podReplicaGroup.reduce((acc: number, pod: any) => acc + (Number(pod.data.replicas) || 1), 0)
    : data.replicas || (selectedNode.type === 'Pod' ? 1 : 0);

  const updateReplicas = (replicas: number) => {
    const parentId = selectedNode.parentId;
    const targetId = (selectedNode.type === 'Pod' && parentId) ? parentId : selectedNode.id;
    updateNodeData(targetId, { replicas });
  };

  const edges = useFlowStore((state) => state.edges);
  const isTargetedByHPA = edges.some(e => e.target === selectedNode.id && nodes.find(n => n.id === e.source)?.type === 'HPA');
  const hasRequests = data.cpuRequest && data.memoryRequest;
  const { isCpuError, isMemError } = validateResourceLimits(data);

  return (
    <div className="space-y-4">
      {/* Replicas */}
      <ConfigSection title="Replicas" icon={Layers}>
        <NumberStepper
          value={replicaValue}
          onChange={updateReplicas}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Resource Requests & Limits */}
      <div className="space-y-3 p-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-500/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Resource Settings</span>
          <button onClick={() => toggleVisibility('resources')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.resources !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>

        {isTargetedByHPA && !hasRequests && (
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] text-amber-500 leading-tight mb-2">
            ⚠️ HPA detected. CPU/Memory <strong>Requests</strong> are required for autoscaling to function.
          </div>
        )}

        {/* Resource Mapping */}
        {[
          {
            field: 'cpuRequest',
            label: 'CPU Request',
            options: CPU_OPTIONS,
            iconColor: 'text-emerald-500',
            activeColor: 'bg-emerald-600 border-emerald-600',
            shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]'
          },
          {
            field: 'cpuLimit',
            label: 'CPU Limit',
            options: CPU_OPTIONS,
            iconColor: 'text-violet-500',
            activeColor: isCpuError ? 'bg-red-600 border-red-600' : 'bg-violet-600 border-violet-600',
            hasError: isCpuError,
            validate: (val: string) => parseCPU(val) < parseCPU(data.cpuRequest)
          },
          { type: 'separator' },
          {
            field: 'memoryRequest',
            label: 'Memory Request',
            options: MEMORY_OPTIONS,
            iconColor: 'text-emerald-500',
            activeColor: 'bg-emerald-600 border-emerald-600',
            shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]'
          },
          {
            field: 'memoryLimit',
            label: 'Memory Limit',
            options: MEMORY_OPTIONS,
            iconColor: 'text-violet-500',
            activeColor: isMemError ? 'bg-red-600 border-red-600' : 'bg-violet-600 border-violet-600',
            hasError: isMemError,
            validate: (val: string) => parseMemory(val) < parseMemory(data.memoryRequest)
          }
        ].map((item: any, idx) => (
          item.type === 'separator' ? (
            <div key={`sep-${idx}`} className="h-px bg-slate-700/30 my-2" />
          ) : (
            <div key={item.field} className={cn("space-y-1.5", item.field.includes('Limit') && "opacity-80")}>
              <div className="flex items-center justify-between">
                <ConfigLabel>
                  <Layers size={10} className={item.iconColor} /> {item.label}
                </ConfigLabel>
                {item.hasError && (
                  <div className="group relative flex items-center">
                    <AlertCircle size={12} className="text-red-500 cursor-help workload-resource-warning" />
                    <div className={cn(
                      "absolute right-full mr-2 px-2 py-1 rounded text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50",
                      colorMode === 'dark' ? "bg-red-950 text-red-200 border border-red-900" : "bg-red-100 text-red-800 border border-red-200"
                    )}>
                      Limit must be greater than or equal to Request
                    </div>
                  </div>
                )}
              </div>
              <SelectorGroup
                options={item.options}
                currentValue={data[item.field]}
                onSelect={(val) => performUpdate({ [item.field]: val })}
                colorMode={colorMode}
                activeColorClass={item.activeColor}
                activeShadowClass={item.shadow}
                validateOption={item.validate}
              />
            </div>
          )
        ))}
      </div>

      {/* Container Image */}
      <ConfigSection
        title="Container Image"
        icon={Box}
        isVisible={data.displaySettings?.image}
        onToggle={() => toggleVisibility('image')}
      >
        <ConfigInput
          placeholder="e.g. nginx:latest"
          value={data.image || ''}
          onChange={(e: any) => performUpdate({ image: e.target.value })}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Web Server */}
      <ConfigSection
        title="Web Server"
        icon={Server}
        isVisible={data.displaySettings?.webserver}
        onToggle={() => toggleVisibility('webserver')}
      >
        <SelectorGroup
          options={WEBSERVERS}
          currentValue={data.webserver}
          onSelect={(val) => performUpdate({ webserver: val })}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Runtime */}
      <ConfigSection
        title="App Runtime"
        icon={Code}
        isVisible={data.displaySettings?.runtime}
        onToggle={() => toggleVisibility('runtime')}
      >
        <select
          value={data.runtime || 'none'}
          onChange={(e) => performUpdate({ runtime: e.target.value, framework: '' })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        >
          {Object.entries(RUNTIMES).map(([id, rt]) => (
            <option key={id} value={id}>{rt.label}</option>
          ))}
        </select>
      </ConfigSection>

      {/* Framework */}
      {data.runtime && data.runtime !== 'none' && (
        <div className="animate-in fade-in slide-in-from-top-1">
          <ConfigSection title="Framework" icon={Box}>
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
          </ConfigSection>
        </div>
      )}
    </div>
  );
};
