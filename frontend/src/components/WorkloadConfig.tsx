import { useFlowStore } from '../store';
import { Layers } from 'lucide-react';
import { ConfigSection, NumberStepper } from './ConfigUI';
import { WorkloadAdvancedConfig } from './Workload/WorkloadAdvancedConfig';

interface WorkloadConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Calculates the total replicas for a given node,
 * considering pod groups and controllers.
 */
const getReplicaValue = (selectedNode: any, nodes: any[]): number => {
  const { data, type, parentId } = selectedNode;
  if (type === 'Pod' && parentId) {
    const podReplicaGroup = nodes.filter(
      (n) => n.type === 'Pod' && n.parentId === parentId && n.data.label === data.label
    );
    if (podReplicaGroup.length > 0) {
      return podReplicaGroup.reduce((acc: number, pod: any) => acc + (Number(pod.data.replicas) || 1), 0);
    }
  }
  return data.replicas || (type === 'Pod' ? 1 : 0);
};

/**
 * Determines the target ID for updating replicas,
 * typically the parent controller if it exists.
 */
const getUpdateReplicasTargetId = (selectedNode: any, nodes: any[]): string => {
  if (selectedNode.type !== 'Pod' || !selectedNode.parentId) {
    return selectedNode.id;
  }
  const parent = nodes.find((n) => n.id === selectedNode.parentId);
  const isController = parent?.type === 'Deployment' || parent?.type === 'ReplicaSet' || parent?.type === 'PodGroup';
  return isController ? selectedNode.parentId! : selectedNode.id;
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
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const replicaValue = getReplicaValue(selectedNode, nodes);

  const updateReplicas = (replicas: number) => {
    const targetId = getUpdateReplicasTargetId(selectedNode, nodes);
    updateNodeData(targetId, { replicas });
  };

  return (
    <div className="space-y-4">
      {/* Replicas Configuration */}
      <ConfigSection title="Replicas" icon={Layers}>
        <NumberStepper
          value={replicaValue}
          onChange={updateReplicas}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Advanced Settings for Pods */}
      {selectedNode.type === 'Pod' && (
        <WorkloadAdvancedConfig
          selectedNode={selectedNode}
          performUpdate={performUpdate}
          toggleVisibility={toggleVisibility}
          toggleYaml={toggleYaml}
        />
      )}
    </div>
  );
};
