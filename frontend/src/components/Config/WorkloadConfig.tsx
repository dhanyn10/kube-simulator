import React, { useState } from 'react';
import { useFlowStore } from '@/store';
import { AlertTriangle, Box, Layers, RotateCcw, Server, Activity, Boxes, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfigSection, NumberStepper } from '@/components/UI/ConfigUI';
import { ImageDropdown } from '@/components/UI/ImageDropdown';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { useWorkloadConfigHandler } from '@/activities/config';
import { getAssignedWorker } from '@/lib/workerNodeHelpers';
import { WorkloadPodsModal } from '@/components/Modals';

interface WorkloadConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

const WORKLOAD_TYPES = [
  { id: 'Deployment', label: 'Deployment' },
  { id: 'StatefulSet', label: 'StatefulSet' }
] as const;

const RESTART_POLICIES = [
  { id: 'Always', label: 'Always' },
  { id: 'OnFailure', label: 'On Failure' },
  { id: 'Never', label: 'Never' }
] as const;

export const isControllerPodNode = (node: any): boolean => {
  if (!node) return false;
  return Boolean(
    node.parentId ||
    node.data?.parentId ||
    (node.data?.replicas && node.data.replicas > 1) ||
    (node.data?.parentReplicas && node.data.parentReplicas > 1) ||
    node.data?.workloadType === 'StatefulSet'
  );
};

interface WorkloadRestartPolicySectionProps {
  readonly selectedNode: any;
  readonly isControllerPod: boolean;
  readonly colorMode: string;
  readonly toggleVisibility: (field: string) => void;
  readonly toggleYaml: (field: string) => void;
  readonly performUpdate: (updates: any) => void;
}

export const WorkloadRestartPolicySection: React.FC<WorkloadRestartPolicySectionProps> = ({
  selectedNode,
  isControllerPod,
  colorMode,
  toggleVisibility,
  toggleYaml,
  performUpdate,
}) => {
  const data = selectedNode.data || {};
  const currentVal = isControllerPod ? 'Always' : (data.restartPolicy || 'Always');

  return (
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
        currentValue={currentVal}
        onSelect={(val) => {
          performUpdate({ restartPolicy: val });
        }}
        disabledOption={(val) => isControllerPod && val !== 'Always'}
        colorMode={colorMode}
      />
      {isControllerPod && (
        <div
          data-testid="controller-restart-policy-hint"
          className={cn(
            "text-[10px] mt-1.5 px-2 py-1 rounded border flex items-center gap-1.5",
            colorMode === 'dark'
              ? "bg-blue-950/40 border-blue-800/60 text-blue-300"
              : "bg-blue-50 border-blue-200 text-blue-700"
          )}
        >
          <Info size={12} className="shrink-0 text-blue-400" />
          <span>Controllers require restartPolicy: Always</span>
        </div>
      )}
    </ConfigSection>
  );
};

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
  const { replicaValue, updateReplicas, pvcInfo, hpaInfo } = useWorkloadConfigHandler(selectedNode);
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false);

  const data = selectedNode.data;

  const isControllerPod = isControllerPodNode(selectedNode);

  return (
    <div className="space-y-4">
      {/* Workload Type Selector */}
      {(selectedNode.type === 'Deployment' || selectedNode.type === 'StatefulSet') && (
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
            currentValue={data.workloadType || (selectedNode.type === 'StatefulSet' ? 'StatefulSet' : 'Deployment')}
            onSelect={(val) => performUpdate({ workloadType: val })}
            colorMode={colorMode}
          />
        </ConfigSection>
      )}

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
        <div className="relative">
          <NumberStepper
            value={replicaValue}
            onChange={updateReplicas}
            colorMode={colorMode}
            disabled={hpaInfo.isControlled}
          />
          {hpaInfo.isControlled && (
            <div
              data-testid="hpa-replica-overlay"
              className={cn(
                "absolute inset-0 rounded backdrop-blur-[2px] flex items-center justify-center gap-1.5 px-2.5 z-10 border transition-all cursor-not-allowed select-none",
                colorMode === 'dark'
                  ? "bg-slate-900/85 border-fuchsia-500/40 text-fuchsia-300 shadow-[0_0_12px_rgba(217,70,239,0.15)]"
                  : "bg-fuchsia-50/90 border-fuchsia-300 text-fuchsia-800 shadow-[0_0_12px_rgba(217,70,239,0.1)]"
              )}
            >
              <Activity size={12} className="text-fuchsia-500 shrink-0 animate-pulse" />
              <span className="text-[10px] font-bold tracking-tight">
                Managed by HPA
              </span>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* Button for Replicas > 3 to open Pod List & Setup Modal */}
      {replicaValue > 3 && (
        <button
          type="button"
          data-testid="open-workload-pods-modal-btn"
          onClick={() => setIsPodsModalOpen(true)}
          className={cn(
            "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all shadow-sm group",
            colorMode === 'dark'
              ? "bg-slate-900/90 border-blue-500/40 text-blue-300 hover:border-blue-400 hover:bg-slate-800/90 hover:text-blue-200"
              : "bg-blue-50/80 border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-100/70 hover:text-blue-900"
          )}
        >
          <div className="flex items-center gap-2">
            <Boxes size={15} className="text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="font-bold leading-tight">Pod List & Setup</div>
              <div className="text-[10px] opacity-75 font-mono">{replicaValue} replicas breakdown</div>
            </div>
          </div>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0",
              colorMode === 'dark' ? "bg-blue-500/20 text-blue-300" : "bg-blue-200/60 text-blue-800"
            )}
          >
            {replicaValue} Pods
          </span>
        </button>
      )}

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
          {selectedNode.type === 'Pod' && (
            <WorkloadRestartPolicySection
              selectedNode={selectedNode}
              isControllerPod={isControllerPod}
              colorMode={colorMode}
              toggleVisibility={toggleVisibility}
              toggleYaml={toggleYaml}
              performUpdate={performUpdate}
            />
          )}

          {/* Assigned Worker Node - hidden when replicas > 3 */}
          {replicaValue <= 3 && (
            <ConfigSection
              title="Worker Node"
              icon={Server}
              isVisible={data.displaySettings?.assignedNode}
              onToggle={() => toggleVisibility('assignedNode')}
            >
              <SelectorGroup
                options={[
                  { id: 'worker-1', label: 'worker-1' },
                  { id: 'worker-2', label: 'worker-2' },
                  { id: 'worker-3', label: 'worker-3' },
                ]}
                currentValue={getAssignedWorker(data, selectedNode.id)}
                onSelect={(val) => performUpdate({ assignedNode: val })}
                colorMode={colorMode}
              />
            </ConfigSection>
          )}
        </>
      )}

      {/* Workload Pods Modal */}
      {isPodsModalOpen && (
        <WorkloadPodsModal
          isOpen={isPodsModalOpen}
          onClose={() => setIsPodsModalOpen(false)}
          selectedNode={selectedNode}
        />
      )}
    </div>
  );
};