import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Layers, Activity } from 'lucide-react';
import { K8sNodeData } from '../types';
import { ConfigSection, ConfigLabel, NumberStepper, RangeInput } from './ConfigUI';
import { SelectorGroup } from './SelectorGroup';

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

      <ConfigSection
        title="Replicas Range"
        icon={Layers}
        isVisible={data.displaySettings?.replicas}
        onToggle={() => toggleVisibility('replicas')}
      >
        <ConfigLabel className="text-[8px] font-normal">Min Replicas</ConfigLabel>
        <NumberStepper
          value={data.minReplicas || 1}
          onChange={(val: number) => performUpdate({ minReplicas: val })}
          colorMode={colorMode}
        />
        <ConfigLabel className="text-[8px] font-normal mt-2">Max Replicas</ConfigLabel>
        <NumberStepper
          value={data.maxReplicas || 1}
          onChange={(val: number) => performUpdate({ maxReplicas: val })}
          colorMode={colorMode}
        />
      </ConfigSection>

      <ConfigSection
        title="Target CPU (%)"
        icon={Activity}
        isVisible={data.displaySettings?.targetCPU}
        onToggle={() => toggleVisibility('targetCPU')}
      >
        <SelectorGroup
          options={[
            { label: '20%', value: '20' },
            { label: '50%', value: '50' },
            { label: '80%', value: '80' }
          ]}
          currentValue={String(data.targetCPU)}
          onSelect={(val) => performUpdate({ targetCPU: Number(val) })}
          colorMode={colorMode}
          activeColorClass="bg-fuchsia-600 border-fuchsia-600 text-white"
        />
        <RangeInput
          value={data.targetCPU || 50}
          onChange={(val: number) => performUpdate({ targetCPU: val })}
          min={10} max={90} step={5}
        />
      </ConfigSection>

      <ConfigSection
        title="Target Mem (%)"
        icon={Activity}
        isVisible={data.displaySettings?.targetMemory}
        onToggle={() => toggleVisibility('targetMemory')}
      >
        <SelectorGroup
          options={[
            { label: '20%', value: '20' },
            { label: '50%', value: '50' },
            { label: '80%', value: '80' }
          ]}
          currentValue={String(data.targetMemory)}
          onSelect={(val) => performUpdate({ targetMemory: Number(val) })}
          colorMode={colorMode}
          activeColorClass="bg-fuchsia-600 border-fuchsia-600 text-white"
        />
        <RangeInput
          value={data.targetMemory || 50}
          onChange={(val: number) => performUpdate({ targetMemory: val })}
          min={10} max={90} step={5}
        />
      </ConfigSection>
    </div>
  );
};
