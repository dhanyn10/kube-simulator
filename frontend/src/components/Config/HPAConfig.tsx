
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { Activity, Layers } from 'lucide-react';
import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import {
  clampReplicaRange,
  HPA_DEFAULT_MAX_REPLICAS,
  HPA_TARGET_MAX_PERCENT,
  HPA_TARGET_MIN_PERCENT,
  resolveMissingLimits,
} from '@/activities/config/hpaConfigHelpers';
import { ConfigSection, ConfigLabel, NumberStepper, RangeInput, AdvancedSection } from '@/components/UI/ConfigUI';
import { SelectorGroup } from '@/components/UI/SelectorGroup';

interface HPAConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Configuration component for HorizontalPodAutoscaler (HPA) resources.
 *
 * @param props - Component properties for handling updates and UI toggles.
 */
export const HPAConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: HPAConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const data = selectedNode.data;

  // Find connected scale workload (Deployment, StatefulSet, ReplicaSet)
  const connectedEdge = edges.find(e => e.source === selectedNode.id);
  const targetNode = connectedEdge ? nodes.find(n => n.id === connectedEdge.target) : null;
  const isScaleWorkload = targetNode && ['Deployment', 'StatefulSet', 'ReplicaSet'].includes(targetNode.type || '');
  const targetWorkload = isScaleWorkload ? targetNode : null;

  const workloadData = targetWorkload ? (targetWorkload.data as K8sNodeData) : undefined;
  // Keep in sync with validateHpaTargets(): Play requires limits on the target.
  const hasLimits = Boolean(workloadData?.cpuLimit && workloadData?.memoryLimit);

  const getStatusInfo = () => {
    if (!connectedEdge || !targetWorkload) {
      return {
        container: "bg-slate-500/10 border-slate-500/30 text-slate-500",
        dot: "bg-slate-500",
        text: "NOT CONNECTED"
      };
    }
    if (hasLimits) {
      const label = ((targetWorkload?.data as K8sNodeData)?.label || targetWorkload?.id || '').toUpperCase();
      return {
        container: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
        dot: "bg-emerald-500",
        text: `LINKED TO ${label}`
      };
    }
    return {
      container: "bg-amber-500/10 border-amber-500/30 text-amber-500",
      dot: "bg-amber-500",
      text: "MISSING RESOURCE LIMITS"
    };
  };

  const status = getStatusInfo();

  const handleFixLimits = (workload: Node) => {
    const updates = resolveMissingLimits(workloadData);
    if (Object.keys(updates).length > 0) {
      useFlowStore.getState().updateNodeData(workload.id, updates);
    }
  };

  // The default belongs to node creation (nodeUtils). Here it only covers
  // legacy nodes that never stored a value; 0/empty input is never one of them.
  const minReplicas = data.minReplicas ?? 1;
  const maxReplicas = data.maxReplicas ?? HPA_DEFAULT_MAX_REPLICAS;

  const handleMinChange = (val: number) => {
    // NumberStepper emits 0 when the input is cleared; ignore that transient value.
    if (val < 1) return;
    performUpdate(clampReplicaRange(val, maxReplicas));
  };

  const handleMaxChange = (val: number) => {
    if (val < 1) return;
    performUpdate(clampReplicaRange(minReplicas, val, 'max'));
  };

  return (
    <div className="space-y-4">
      {/* Validation Status */}
      <div className={cn("p-2 rounded border flex items-center gap-2", status.container)}>
        <div className={cn("w-2 h-2 rounded-full animate-pulse", status.dot)} />
        <span className="text-[10px] font-bold">
          {status.text}
        </span>
      </div>

      {!hasLimits && targetWorkload && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-500 leading-relaxed">
          <p>HPA requires CPU/Memory limits on the target {targetWorkload?.type || 'workload'} to function in real-world clusters.</p>
          <button 
            type="button"
            onClick={() => handleFixLimits(targetWorkload)}
            className="inline-flex items-center mt-2.5 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition-all font-bold text-[8px] uppercase tracking-wider"
          >
            Fix automatically
          </button>
        </div>
      )}

      <AdvancedSection colorMode={colorMode}>
        <div className="space-y-8">
          {/* Replicas Range */}
          <ConfigSection
            title="Replicas Range"
            icon={Layers}
            isVisible={data.displaySettings?.replicas}
            onToggle={() => toggleVisibility('replicas')}
            isYamlEnabled={data.yamlSettings?.replicas}
            onYamlToggle={() => toggleYaml('replicas')}
          >
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-1.5">
                <ConfigLabel className="text-[8px] font-normal opacity-70 uppercase tracking-wider">Min</ConfigLabel>
                <NumberStepper
                  value={minReplicas}
                  onChange={handleMinChange}
                  min={1}
                  max={maxReplicas}
                  colorMode={colorMode}
                />
              </div>
              <div className="space-y-1.5">
                <ConfigLabel className="text-[8px] font-normal opacity-70 uppercase tracking-wider">Max</ConfigLabel>
                <NumberStepper
                  value={maxReplicas}
                  onChange={handleMaxChange}
                  min={minReplicas}
                  colorMode={colorMode}
                />
              </div>
            </div>
          </ConfigSection>

          {[
            { field: 'targetCPU', label: 'Target CPU (%)', icon: Activity },
            { field: 'targetMemory', label: 'Target Mem (%)', icon: Activity }
          ].map((item) => (
            <ConfigSection
              key={item.field}
              title={item.label}
              icon={item.icon}
              isVisible={data.displaySettings?.[item.field]}
              onToggle={() => toggleVisibility(item.field)}
              isYamlEnabled={data.yamlSettings?.[item.field]}
              onYamlToggle={() => toggleYaml(item.field)}
              disableYamlToggle={!data[item.field as keyof K8sNodeData]}
            >
              <div className="space-y-4 mt-3">
                <SelectorGroup
                  options={[
                    { label: '20%', value: '20' },
                    { label: '50%', value: '50' },
                    { label: '80%', value: '80' }
                  ]}
                  currentValue={String(data[item.field as keyof K8sNodeData])}
                  onSelect={(val) => performUpdate({ [item.field]: Number(val) })}
                  colorMode={colorMode}
                  activeColorClass="bg-fuchsia-600 border-fuchsia-600 text-white"
                />
                <RangeInput
                  value={data[item.field as keyof K8sNodeData] || 50}
                  onChange={(val: number) => performUpdate({ [item.field]: val })}
                  min={HPA_TARGET_MIN_PERCENT} max={HPA_TARGET_MAX_PERCENT} step={1}
                />
              </div>
            </ConfigSection>
          ))}
        </div>
      </AdvancedSection>
    </div>
  );
};
