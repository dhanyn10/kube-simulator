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
    get().updateNodeData(podId, { label: cleanName });
  },
});

export const hydrateNodes = (nodes: Node[], get: () => any): Node[] => {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onDelete: () => {
        const nodeToDelete = get().nodes.find((n: Node) => n.id === node.id);
        if (nodeToDelete) get().deleteNodes([nodeToDelete]);
      },
      onRename: (newName: string) => {
        const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
        get().updateNodeData(node.id, { label: cleanName });
      },
    }
  }));
};

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

  const syncedPods = syncPodsInDeployment(updatedDeployment, pods, pods[0]);
  const withHandlers = syncedPods.map(p => ({ 
    ...p, 
    data: {
      ...p.data,
      onDelete: () => {
        const nodeToDelete = get().nodes.find((n: Node) => n.id === p.id);
        if (nodeToDelete) get().deleteNodes([nodeToDelete]);
      },
      onRename: (newName: string) => {
        const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
        get().updateNodeData(p.id, { label: cleanName });
      },
    }
  }));
  const laidOut = layoutPodsInDeployment(updatedDeployment, withHandlers);
  
  // Dynamic sizing: Calculate required space for pods plus padding
  const paddingX = 20;
  const headerHeight = 40;
  const minWidth = 320;
  const minHeight = 160;

  const maxPodX = Math.max(0, ...laidOut.map(p => (p.position.x || 0) + (p.width || 160)));
  const maxPodY = Math.max(0, ...laidOut.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 130)));
  
  // If not manually resized, we can shrink to content. 
  // If manually resized, we still grow if content exceeds current size, but don't shrink below user's set width.
  let depW = maxPodX + paddingX;
  let depH = maxPodY + 20; // 20px bottom padding

  if (data.isManuallyResized) {
      depW = Math.max(depW, updatedDeployment.width || minWidth);
      depH = Math.max(depH, updatedDeployment.height || minHeight);
  } else {
      depW = Math.max(minWidth, depW);
      depH = Math.max(minHeight, depH);
  }

  const finalDeployment = {
    ...updatedDeployment,
    width: depW,
    height: depH,
    style: { ...updatedDeployment.style, width: depW, height: depH }
  };

  return { updatedDeployment: finalDeployment, laidOut };
};
