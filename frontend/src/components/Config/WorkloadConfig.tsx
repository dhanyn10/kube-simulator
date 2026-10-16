import { useFlowStore } from '@/store';
import { AlertTriangle, Box, Layers, RotateCcw, Server } from 'lucide-react';
import { ConfigSection, NumberStepper } from '@/components/UI/ConfigUI';
import { ImageDropdown } from '@/components/UI/ImageDropdown';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { useWorkloadConfigHandler } from '@/activities/config';

interface WorkloadConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Main configuration component for Workload resources (Pods and Deployments).
 *
 * @param props - Component properties
 */
export const WorkloadConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml
}: WorkloadConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const { replicaValue, updateReplicas, pvcInfo } = useWorkloadConfigHandler(selectedNode);

  const data = selectedNode.data;

  const WORKLOAD_TYPES = [
    { id: 'Deployment', label: 'Deployment' },
    { id: 'StatefulSet', label: 'StatefulSet' }
  ] as const;

  const RESTART_POLICIES = [
    { id: 'Always', label: 'Always' },
    { id: 'OnFailure', label: 'On Failure' },
    { id: 'Never', label: 'Never' }
  ] as const;

  return (
    <div className="space-y-4">
      {/* Workload Type Selector */}
      <ConfigSection
        title="Workload Type"
        icon={Server}
        isVisible={data.displaySettings?.workloadType}
        onToggle={() => toggleVisibility('workloadType')}
        isYamlEnabled={data.yamlSettings?.workloadType}
        onYamlToggle={() => toggleYaml('workloadType')}
        disableYamlToggle={Boolean(data.workloadType) === false}
      >
        <SelectorGroup
          options={WORKLOAD_TYPES}
          currentValue={data.workloadType || 'Deployment'}
          onSelect={(val) => performUpdate({ workloadType: val })}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* StatefulSet Recommendation Callout Banner */}
      {pvcInfo.isMultiReplicaRwoPvc && (data.workloadType || 'Deployment') !== 'StatefulSet' && (
        <div className="p-2.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[9px] space-y-1">
          <div className="font-bold flex items-center gap-1">
            <AlertTriangle size={12} className="text-amber-400 shrink-0" />
            <span>Stateful Workload Recommendation</span>
          </div>
          <p className="leading-snug text-amber-200/90">
            Connected to ReadWriteOnce volume &quot;{pvcInfo.connectedPvcName}&quot; with {replicaValue} replicas. Deployments cause Multi-Attach errors because multiple pods cannot mount the same RWO volume simultaneously.
          </p>
          <button
            type="button"
            onClick={() => performUpdate({ workloadType: 'StatefulSet' })}
            className="mt-1 px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors text-[8px] flex items-center gap-1"
          >
            Switch to StatefulSet Mode
          </button>
        </div>
      )}

      {/* Replicas Configuration */}
      <ConfigSection title="Replicas" icon={Layers}>
        <NumberStepper
          value={replicaValue}
          onChange={updateReplicas}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Pod Specific Main Settings */}
      {selectedNode.type === 'Pod' && (
        <>
          {/* Container Image */}
          <ConfigSection
            title="Container Image"
            icon={Box}
            isVisible={data.displaySettings?.image}
            onToggle={() => toggleVisibility('image')}
            isYamlEnabled={data.yamlSettings?.image}
            onYamlToggle={() => toggleYaml('image')}
            disableYamlToggle={Boolean(data.image) === false}
          >
            <ImageDropdown
              value={data.image || ''}
              onChange={(val) => performUpdate({ image: val, status: val ? 'ready' : 'pending' })}
              colorMode={colorMode}
            />
          </ConfigSection>

          {/* Restart Policy */}
          <ConfigSection
            title="Restart Policy"
            icon={RotateCcw}
            isVisible={data.displaySettings?.restartPolicy}
            onToggle={() => toggleVisibility('restartPolicy')}
            isYamlEnabled={data.yamlSettings?.restartPolicy}
            onYamlToggle={() => toggleYaml('restartPolicy')}
            disableYamlToggle={Boolean(data.restartPolicy) === false}
          >
            <SelectorGroup
              options={RESTART_POLICIES}
              currentValue={data.restartPolicy || 'Always'}
              onSelect={(val) => performUpdate({ restartPolicy: val })}
              colorMode={colorMode}
            />
          </ConfigSection>
        </>
      )}
    </div>
  );
};
