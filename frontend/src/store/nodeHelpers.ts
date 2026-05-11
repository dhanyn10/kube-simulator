import { Node } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { FlowState } from './types';
import { 
  getNodeData, 
  syncPodsInDeployment, 
  layoutPodsInDeployment, 
  getPodMinimumSize, 
  POD_MIN_DIMENSIONS 
} from './helpers';

export const setupPodHandlers = (podId: string, get: () => FlowState) => ({
  onDelete: () => {
    const nodeToDelete = get().nodes.find((n: Node) => n.id === podId);
    if (nodeToDelete) get().deleteNodes([nodeToDelete]);
  },
  onRename: (newName: string) => {
    const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
    get().updateNodeData(podId, { label: cleanName });
  },
});

export const hydrateNodes = (nodes: any[], get: () => FlowState): any[] => {
  let nextNodes = nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      status: node.data.status || (
        (node.type === 'Pod' || node.type === 'Deployment') 
          ? (node.data.runtime && node.data.runtime !== 'none' || node.data.webserver && node.data.webserver !== 'none' ? 'ready' : 'pending')
          : 'ready'
      ),
      type: node.type,
      onDelete: () => {
        const nodeToDelete = get().nodes.find((n: any) => n.id === node.id);
        if (nodeToDelete) get().deleteNodes([nodeToDelete]);
      },
      onRename: (newName: string) => {
        const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
        get().updateNodeData(node.id, { label: cleanName });
      },
    }
  }));

  // Sync Deployments after all handlers are attached
  const deployments = nextNodes.filter(n => n.type === 'Deployment');
  deployments.forEach(dept => {
    const { updatedDeployment, laidOut } = syncDeployment(dept, nextNodes, 0, get);
    nextNodes = nextNodes.filter(n => n.parentId !== dept.id || n.type !== 'Pod');
    nextNodes = [...nextNodes.map(n => n.id === dept.id ? updatedDeployment : n), ...laidOut];
  });

  return nextNodes;
};

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
    data: { ...data, replicas: Math.max(0, (data.replicas || 0) + replicasChange) }
  };
  
  // Get all pods for this deployment, excluding the one we might be re-adding (to avoid duplicates)
  let pods = currentNodes.filter(n => n.parentId === deployment.id && n.type === 'Pod');
  if (podToInclude) {
      pods = [podToInclude, ...pods.filter(p => p.id !== podToInclude.id)];
  }

  const syncedPods = syncPodsInDeployment(updatedDeployment, pods, pods[0]);

  // Sync Deployment data with Pod template
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
  
  // If not manually resized, we can shrink to content. 
  // If manually resized, we still grow if content exceeds current size, but don't shrink below user's set width.
  let depW = maxPodX + paddingX;
  let depH = maxPodY + (isPodGroup ? 20 : 20); // padding bottom

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

export const syncContainerSize = (containerId: string | undefined, currentNodes: Node[]): Node[] => {
  if (!containerId) return currentNodes;
  
  const container = currentNodes.find(n => n.id === containerId);
  if (!container) return currentNodes;

  const children = currentNodes.filter(n => n.parentId === containerId);
  if (children.length === 0) return currentNodes;

  const padding = 40;
  
  let minX = 0;
  let minY = 0;
  // Start with current size or measured size
  let maxX = Math.max(container.width || 0, container.measured?.width || 320);
  let maxY = Math.max(container.height || 0, container.measured?.height || 160);

  children.forEach(child => {
    if (child.type === 'Internet') return;

    let childMinSize = { width: 160, height: 80 };
    if (child.type === 'Pod') {
      childMinSize = getPodMinimumSize(child.data);
    } else if (child.type === 'Deployment' || child.type === 'Namespace' || child.type === 'PodGroup') {
      childMinSize = { width: child.width || 320, height: child.height || 160 };
    }
    
    const childWidth = Math.max(child.width || 0, child.measured?.width || 0, childMinSize.width);
    const childHeight = Math.max(child.height || 0, child.measured?.height || 0, childMinSize.height);
    
    // Detect if child is pushing any boundary
    if (child.position.x < padding/2) minX = Math.min(minX, child.position.x - padding);
    if (child.position.y < padding/2) minY = Math.min(minY, child.position.y - padding);
    
    const rightEdge = child.position.x + childWidth + padding;
    const bottomEdge = child.position.y + childHeight + padding;
    
    if (rightEdge > maxX) maxX = rightEdge;
    if (bottomEdge > maxY) maxY = bottomEdge;
  });

  const shiftX = minX < 0 ? Math.abs(minX) : 0;
  const shiftY = minY < 0 ? Math.abs(minY) : 0;
  
  const newWidth = maxX + shiftX;
  const newHeight = maxY + shiftY;

  // Small epsilon to avoid jitter
  const isSizeChanged = Math.abs(newWidth - (container.width || 0)) > 1 || 
                        Math.abs(newHeight - (container.height || 0)) > 1 || 
                        shiftX > 0 || shiftY > 0;

  if (!isSizeChanged) return currentNodes;

  const nextNodes = currentNodes.map(n => {
    if (n.id === containerId) {
      return {
        ...n,
        position: {
          x: n.position.x - shiftX,
          y: n.position.y - shiftY
        },
        width: newWidth,
        height: newHeight,
        style: { ...n.style, width: newWidth, height: newHeight }
      };
    }
    // Shift ALL children if the origin moved, to keep absolute positions same
    if (n.parentId === containerId && (shiftX > 0 || shiftY > 0)) {
      return {
        ...n,
        position: {
          x: n.position.x + shiftX,
          y: n.position.y + shiftY
        }
      };
    }
    return n;
  });

  // Recursively notify grandparent
  if (container.parentId) {
    return syncContainerSize(container.parentId, nextNodes);
  }

  return nextNodes;
};
