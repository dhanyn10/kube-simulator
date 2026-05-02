import { Node } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { 
  getNodeData, 
  syncPodsInDeployment, 
  layoutPodsInDeployment, 
  getPodMinimumSize, 
  POD_MIN_DIMENSIONS 
} from './helpers';

export const setupPodHandlers = (podId: string, get: () => any) => ({
  onDelete: () => {
    const nodeToDelete = get().nodes.find((n: Node) => n.id === podId);
    if (nodeToDelete) get().deleteNodes([nodeToDelete]);
  },
  onRename: (newName: string) => {
    const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
    get().updateNodeData(podId, { label: cleanName, isAutoNamed: false });
  },
});

export const syncDeployment = (
  deployment: Node, 
  currentNodes: Node[], 
  replicasChange: number, 
  get: () => any,
  podToInclude?: Node
) => {
  const data = getNodeData(deployment);
  const updatedDeployment = {
    ...deployment,
    data: { ...data, replicas: Math.max(0, (data.replicas || 0) + replicasChange) }
  };
  
  // Get all pods for this deployment, excluding the one we might be re-adding (to avoid duplicates)
  let pods = currentNodes.filter(n => n.parentId === deployment.id && n.type === 'Pod');
  if (podToInclude) {
      pods = [podToInclude, ...pods.filter(p => p.id !== podToInclude.id)];
  }

  const syncedPods = syncPodsInDeployment(updatedDeployment, pods);
  const withHandlers = syncedPods.map(p => ({ 
    ...p, 
    data: { ...p.data, ...setupPodHandlers(p.id, get) } 
  }));
  const laidOut = layoutPodsInDeployment(updatedDeployment, withHandlers);
  
  // Ensure deployment is large enough
  const maxPodX = Math.max(0, ...laidOut.map(p => (p.position.x || 0) + (p.width || 160)));
  const maxPodY = Math.max(0, ...laidOut.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 130)));
  const depW = Math.max(updatedDeployment.width || 0, maxPodX + 20);
  const depH = Math.max(updatedDeployment.height || 0, maxPodY + 40);

  const finalDeployment = {
    ...updatedDeployment,
    width: depW,
    height: depH,
    style: { ...updatedDeployment.style, width: depW, height: depH }
  };

  return { updatedDeployment: finalDeployment, laidOut };
};
