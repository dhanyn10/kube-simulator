import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { FlowState } from './types';
import { 
  getNodeData, 
  syncPodsInDeployment, 
  layoutPodsInDeployment, 
  getPodMinimumSize, 
  POD_MIN_DIMENSIONS 
} from './helpers';

/**
 * Attaches standard event handlers (onDelete, onRename) to a node data object.
 */
export const attachHandlers = (nodeId: string, get: () => FlowState) => ({
  onDelete: () => {
    const nodeToDelete = get().nodes.find((n: Node) => n.id === nodeId);
    if (nodeToDelete) get().deleteNodes([nodeToDelete]);
  },
  onRename: (newName: string) => {
    const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
    get().updateNodeData(nodeId, { label: cleanName });
  },
});

/**
 * Hydrates nodes with their runtime handlers and ensures initial status.
 */
export const hydrateNodes = (nodes: any[], get: () => FlowState): any[] => {
  let nextNodes = nodes.map(node => {
    const handlers = attachHandlers(node.id, get);
    const data = node.data;

    const isWorkload = node.type === 'Pod' || node.type === 'Deployment';
    const hasRuntime = data.runtime && data.runtime !== 'none' || data.webserver && data.webserver !== 'none';
    const status = data.status || (isWorkload ? (hasRuntime ? 'ready' : 'pending') : 'ready');

    return {
      ...node,
      data: {
        ...data,
        ...handlers,
        status,
        type: node.type,
      }
    };
  });

  // Sync Deployments after all handlers are attached
  const deployments = nextNodes.filter(n => n.type === 'Deployment');
  deployments.forEach(dept => {
    const { updatedDeployment, laidOut } = syncDeployment(dept, nextNodes, 0, get);
    nextNodes = nextNodes.filter(n => n.parentId !== dept.id || n.type !== 'Pod');
    nextNodes = [...nextNodes.map(n => n.id === dept.id ? updatedDeployment : n), ...laidOut];
  });

  return nextNodes;
};

/**
 * Synchronizes deployment state with its child pods.
 */
export const syncDeployment = (
  deployment: Node, 
  currentNodes: Node[], 
  replicasChange: number, 
  get: () => FlowState,
  podToInclude?: Node
) => {
  const data = getNodeData(deployment);
  const updatedDeployment = {
    ...deployment,
    data: { ...data, replicas: Math.max(0, Math.min(1000, (data.replicas || 0) + replicasChange)) }
  };
  
  let pods = currentNodes.filter(n => n.parentId === deployment.id && n.type === 'Pod');
  if (podToInclude) {
      pods = [podToInclude, ...pods.filter(p => p.id !== podToInclude.id)];
  }

  const syncedPods = syncPodsInDeployment(updatedDeployment, pods, pods[0]);

  // Sync Deployment metadata with Pod template
  if (syncedPods.length > 0) {
    const podTemplate = syncedPods[0].data as any;
    updatedDeployment.data = {
      ...updatedDeployment.data,
      status: podTemplate.status,
      runtime: podTemplate.runtime,
      webserver: podTemplate.webserver,
      image: podTemplate.image,
    };
  }

  const withHandlers = syncedPods.map(p => ({ 
    ...p, 
    data: {
      ...p.data,
      ...attachHandlers(p.id, get)
    }
  }));

  const laidOut = layoutPodsInDeployment(updatedDeployment, withHandlers);
  const { width, height } = calculateDeploymentDimensions(updatedDeployment, laidOut);

  const finalDeployment = {
    ...updatedDeployment,
    width,
    height,
    style: { ...updatedDeployment.style, width, height }
  };

  return { updatedDeployment: finalDeployment, laidOut };
};

/**
 * Calculates dimensions for a deployment/group node based on its children.
 */
const calculateDeploymentDimensions = (deployment: Node, laidOut: Node[]) => {
  const data = deployment.data as K8sNodeData;
  const isPodGroup = deployment.type === 'PodGroup';
  const paddingX = 20;
  const headerHeight = isPodGroup ? 30 : 40;
  const minWidth = isPodGroup ? 180 : (POD_MIN_DIMENSIONS.width + paddingX * 2 + 10);
  const minHeight = isPodGroup ? 100 : (POD_MIN_DIMENSIONS.height + headerHeight + 20);

  const maxPodX = Math.max(0, ...laidOut.map(p => {
    const minSize = getPodMinimumSize(p.data);
    return (p.position.x || 0) + Math.max(p.width || 0, p.measured?.width || 0, minSize.width);
  }));
  const maxPodY = Math.max(0, ...laidOut.map(p => {
    const minSize = getPodMinimumSize(p.data);
    return (p.position.y || 0) + Math.max(p.height || 0, p.measured?.height || 0, Number((p.style as any)?.minHeight) || 0, minSize.height);
  }));
  
  let depW = maxPodX + paddingX;
  let depH = maxPodY + 20;

  if (data.isManuallyResized) {
      depW = Math.max(depW, deployment.width || minWidth);
      depH = Math.max(depH, deployment.height || minHeight);
  } else {
      depW = Math.max(minWidth, depW);
      depH = Math.max(minHeight, depH);
  }

  return { width: depW, height: depH };
};

/**
 * Recursively synchronizes container sizes (e.g. Namespace) to fit their children.
 */
export const syncContainerSize = (containerId: string | undefined, currentNodes: Node[]): Node[] => {
  if (!containerId) return currentNodes;
  
  const container = currentNodes.find(n => n.id === containerId);
  if (!container) return currentNodes;

  const children = currentNodes.filter(n => n.parentId === containerId);
  if (children.length === 0) return currentNodes;

  const padding = 40;
  let minX = 0;
  let minY = 0;
  let maxX = Math.max(container.width || 0, container.measured?.width || 320);
  let maxY = Math.max(container.height || 0, container.measured?.height || 160);

  children.forEach(child => {
    if (child.type === 'Internet') return;

    const childMinSize = getChildMinSize(child);
    const childWidth = Math.max(child.width || 0, child.measured?.width || 0, childMinSize.width);
    const childHeight = Math.max(child.height || 0, child.measured?.height || 0, childMinSize.height);
    
    if (child.position.x < padding/2) minX = Math.min(minX, child.position.x - padding);
    if (child.position.y < padding/2) minY = Math.min(minY, child.position.y - padding);
    
    maxX = Math.max(maxX, child.position.x + childWidth + padding);
    maxY = Math.max(maxY, child.position.y + childHeight + padding);
  });

  const shiftX = minX < 0 ? Math.abs(minX) : 0;
  const shiftY = minY < 0 ? Math.abs(minY) : 0;
  const newWidth = maxX + shiftX;
  const newHeight = maxY + shiftY;

  const isSizeChanged = Math.abs(newWidth - (container.width || 0)) > 1 || 
                        Math.abs(newHeight - (container.height || 0)) > 1 || 
                        shiftX > 0 || shiftY > 0;

  if (!isSizeChanged) return currentNodes;

  const nextNodes = currentNodes.map(n => {
    if (n.id === containerId) {
      return {
        ...n,
        position: { x: n.position.x - shiftX, y: n.position.y - shiftY },
        width: newWidth, height: newHeight,
        style: { ...n.style, width: newWidth, height: newHeight }
      };
    }
    if (n.parentId === containerId && (shiftX > 0 || shiftY > 0)) {
      return {
        ...n,
        position: { x: n.position.x + shiftX, y: n.position.y + shiftY }
      };
    }
    return n;
  });

  return container.parentId ? syncContainerSize(container.parentId, nextNodes) : nextNodes;
};

const getChildMinSize = (child: Node) => {
    if (child.type === 'Pod') return getPodMinimumSize(child.data);
    if (['Deployment', 'Namespace', 'PodGroup'].includes(child.type || '')) {
        return { width: child.width || 320, height: child.height || 160 };
    }
    return { width: 160, height: 80 };
};
