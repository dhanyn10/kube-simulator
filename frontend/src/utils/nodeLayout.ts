import { Node, applyNodeChanges, NodeChange } from '@xyflow/react';
import { LAYOUT, DEFAULT_DIMENSIONS } from '../constants/layout';

/**
 * Helper to sort nodes for consistent rendering (Deployments always behind Pods)
 */
export const sortNodes = (nodes: Node[]): Node[] => {
  return [...nodes].sort((a, b) => {
    if (a.type === 'Deployment' && b.type === 'Pod') return -1;
    if (a.type === 'Pod' && b.type === 'Deployment') return 1;
    return 0;
  });
};

/**
 * Calculates local positions for pods within a deployment container
 */
export const layoutPodsInDeployment = (deployment: Node, pods: Node[]): Node[] => {
  const deploymentWidth = deployment.width || deployment.measured?.width || DEFAULT_DIMENSIONS.Deployment.width;
  const deployableWidth = Math.max(100, deploymentWidth - (2 * LAYOUT.PADDING_X));

  let currentX = LAYOUT.PADDING_X;
  let currentY = LAYOUT.PADDING_Y;
  let rowMaxHeight = 0;

  return pods.map(pod => {
    const podW = pod.width || pod.measured?.width || DEFAULT_DIMENSIONS.Pod.width;
    const podH = pod.height || pod.measured?.height || DEFAULT_DIMENSIONS.Pod.height;

    if (currentX + podW > deployableWidth + LAYOUT.PADDING_X && currentX > LAYOUT.PADDING_X) {
      currentX = LAYOUT.PADDING_X;
      currentY += rowMaxHeight + LAYOUT.SPACING;
      rowMaxHeight = 0;
    }

    rowMaxHeight = Math.max(rowMaxHeight, podH);
    const newPosition = { x: currentX, y: currentY };
    currentX += podW + LAYOUT.SPACING;

    return { ...pod, position: newPosition };
  });
};

/**
 * Updates a deployment's size and its children's layout
 */
export const updateDeploymentLayoutAndSize = (currentNodes: Node[], deploymentId: string): Node[] => {
  const parentDeployment = currentNodes.find(n => n.id === deploymentId);
  if (!parentDeployment) return currentNodes;

  const siblingPods = currentNodes.filter(n => n.parentId === deploymentId);
  const reLayoutedPods = layoutPodsInDeployment(parentDeployment, siblingPods);

  const maxPodX = Math.max(0, ...reLayoutedPods.map(p => (p.position?.x || 0) + (p.width || p.measured?.width || DEFAULT_DIMENSIONS.Pod.width)));
  const maxPodY = Math.max(0, ...reLayoutedPods.map(p => (p.position?.y || 0) + (p.height || p.measured?.height || DEFAULT_DIMENSIONS.Pod.height)));
  
  const minWidthNeeded = maxPodX + LAYOUT.PADDING_X;
  const minHeightNeeded = maxPodY + LAYOUT.PADDING_Y;

  return currentNodes.map(n => {
    if (n.id === deploymentId) {
      return {
        ...n,
        width: Math.max(n.width || 0, minWidthNeeded),
        height: Math.max(n.height || 0, minHeightNeeded)
      };
    }
    const reLayoutedPod = reLayoutedPods.find(rp => rp.id === n.id);
    return reLayoutedPod || n;
  });
};
