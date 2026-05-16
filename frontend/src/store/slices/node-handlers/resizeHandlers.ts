import { Node } from '@xyflow/react';
import { 
  getPodMinimumSize, 
  POD_MIN_DIMENSIONS,
  layoutPodsInDeployment
} from '../../helpers';
import { FlowState } from '../../types';

/**
 * Gets the minimum allowed size for a node during resize.
 */
const getMinNodeSize = (node: Node) => {
  if (node.type === 'Pod') return getPodMinimumSize(node.data);
  return { width: node.width || 0, height: node.height || 0 };
};

/**
 * Calculates the bounding box required to fit all child pods within a container.
 */
const calculateMinContainerBounds = (pods: Node[]) => {
  const maxX = Math.max(0, ...pods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
  const maxY = Math.max(0, ...pods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || Number((p.style as any)?.minHeight) || POD_MIN_DIMENSIONS.height)));
  return { width: maxX + 20, height: maxY + 40 };
};

/**
 * Updates a container's size to ensure it fits its children.
 */
const syncContainerSizeToBounds = (nodes: Node[], containerId: string, bounds: { width: number, height: number }) => {
  return nodes.map(n => {
    if (n.id !== containerId) return n;
    const finalW = Math.max(n.width || 0, bounds.width);
    const finalH = Math.max(n.height || 0, bounds.height);
    return { ...n, width: finalW, height: finalH, style: { ...n.style, width: finalW, height: finalH } };
  });
};

/**
 * Handles logic for when a Pod is resized.
 */
const applyPodResize = (nodes: Node[], resizedNode: Node, get: () => FlowState) => {
  const parentId = resizedNode.parentId;
  if (!parentId) return nodes;

  const parentDeployment = nodes.find(n => n.id === parentId);
  if (!parentDeployment) return nodes;

  const minHeight = Number((resizedNode.style as any)?.minHeight) || POD_MIN_DIMENSIONS.height;
  
  // 1. Sync all sibling pods to the same size
  let nextNodes = nodes.map(n => {
    if (n.parentId !== parentId) return n;
    return {
      ...n,
      width: resizedNode.width,
      height: undefined,
      style: { ...(n.style || {}), width: resizedNode.width, minHeight },
      measured: undefined
    };
  });

  // 2. Re-layout pods in the deployment
  const siblingPods = nextNodes.filter(n => n.parentId === parentId);
  const laidOut = layoutPodsInDeployment(parentDeployment, siblingPods);
  nextNodes = nextNodes.map(n => laidOut.find(p => p.id === n.id) || n);

  // 3. Sync deployment size to fit the new layout
  return syncContainerSizeToBounds(nextNodes, parentId, calculateMinContainerBounds(laidOut));
};

/**
 * Handles logic for when a Deployment is resized.
 */
const applyDeploymentResize = (nodes: Node[], resizedNode: Node) => {
  const childPods = nodes.filter(n => n.parentId === resizedNode.id);
  const laidOut = layoutPodsInDeployment(resizedNode, childPods);
  
  // 1. Apply new layout to children
  let nextNodes = nodes.map(n => laidOut.find(p => p.id === n.id) || n);

  // 2. Enforce minimum size to fit children
  return syncContainerSizeToBounds(nextNodes, resizedNode.id, calculateMinContainerBounds(laidOut));
};

export const resizeHandlers = (set: any, get: () => FlowState) => ({
  onNodeResize: (event: any, node: Node) => {
    set((state: FlowState) => {
      const currentNode = state.nodes.find((n: Node) => n.id === node.id);
      if (!currentNode) return state;

      const minSize = getMinNodeSize(currentNode);
      const nextW = Math.max(node.width || 0, minSize.width);
      const nextH = Math.max(node.height || 0, minSize.height);

      // Apply initial resize to the target node
      let nextNodes = state.nodes.map((n: Node) => n.id === node.id ? {
          ...n,
          width: nextW,
          height: n.type === 'Pod' ? undefined : nextH,
          style: n.type === 'Pod' ? { ...(n.style || {}), width: nextW, minHeight: nextH } : { width: nextW, height: nextH },
          measured: n.type === 'Pod' ? undefined : { width: nextW, height: nextH },
          data: { ...n.data, isManuallyResized: true }
      } : n);
      
      const resized = nextNodes.find(n => n.id === node.id)!;
      
      if (resized.type === 'Pod') {
        nextNodes = applyPodResize(nextNodes, resized, get);
      } else if (resized.type === 'Deployment') {
        nextNodes = applyDeploymentResize(nextNodes, resized);
      }

      return { nodes: nextNodes };
    });
  },

  onNodeResizeStop: (event: any, node: Node) => {
    set({
      lastActionId: `resize-${Date.now()}`,
      lastActionName: 'Resize Element'
    });
  },
});
