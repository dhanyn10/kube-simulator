import { Node } from '@xyflow/react';

export const sortNodes = (nodes: Node[]): Node[] => {
  return [...nodes].sort((a, b) => {
    if (a.type === 'Deployment' && b.type === 'Pod') return -1;
    if (a.type === 'Pod' && b.type === 'Deployment') return 1;
    return 0;
  });
};

// Helper function to sync pods within a deployment based on replica count
export const syncPodsInDeployment = (deployment: Node, currentPods: Node[], dataTemplate?: Node): Node[] => {
  const totalReplicas = deployment.data.replicas || 0;
  const deploymentId = deployment.id;

  // 1. Determine target pod counts and their replica values
  const targetPodReplicas: number[] = [];
  if (totalReplicas <= 3) {
    for (let i = 0; i < totalReplicas; i++) {
      targetPodReplicas.push(1);
    }
  } else {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = Math.min(remaining, 10);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  }

  // 2. Map existing pods or create new ones
  // We try to keep as many existing pods as possible to preserve their IDs and positions if relevant
  // Although layoutPodsInDeployment will override positions.
  const newPods: Node[] = [];

  // Get template data from the provided dataTemplate, or first existing pod, otherwise use deployment defaults
  const templatePod = dataTemplate || currentPods[0];
  const commonData = templatePod ? {
    image: templatePod.data.image,
    webserver: templatePod.data.webserver,
    runtime: templatePod.data.runtime,
    framework: templatePod.data.framework,
    status: templatePod.data.status,
    label: templatePod.data.label,
    isAutoNamed: templatePod.data.isAutoNamed,
  } : {
    image: deployment.data.image,
    webserver: deployment.data.webserver || 'none',
    runtime: deployment.data.runtime || 'none',
    framework: deployment.data.framework,
    status: deployment.data.status || 'pending',
    label: 'new-app-pod',
    isAutoNamed: true,
  };

  targetPodReplicas.forEach((replicas, index) => {
    const existingPod = currentPods[index];
    if (existingPod) {
      newPods.push({
        ...existingPod,
        style: { ...existingPod.style, width: existingPod.width || 160 },
        extent: 'parent',
        data: {
          ...existingPod.data,
          ...commonData,
          replicas,
          parentReplicas: totalReplicas,
          label: commonData.label,
        }
      });
    } else {
      const id = `pod-${Math.random().toString(36).substr(2, 9)}`;
      newPods.push({
        id,
        type: 'Pod',
        position: { x: 0, y: 0 },
        parentId: deploymentId,
        width: 160,
        style: { width: 160 },
        extent: 'parent',
        data: {
          type: 'Pod',
          replicas,
          parentReplicas: totalReplicas,
          ...commonData,
          onDelete: () => {}, // Will be set in slice
          onRename: () => {}, // Will be set in slice
        }
      });
    }
  });

  return newPods;
};

// Helper function to layout pods within a deployment
export const layoutPodsInDeployment = (deployment: Node, pods: Node[]): Node[] => {
  const paddingX = 20;
  const paddingY = 40; // Account for deployment header
  const spacing = 10;
  
  const deploymentWidth = deployment.width || deployment.measured?.width || 320;
  const deployableWidth = Math.max(100, deploymentWidth - (2 * paddingX));

  let currentX = paddingX;
  let currentY = paddingY;
  let rowMaxHeight = 0;

  const updatedPods = pods.map(pod => {
    const podW = pod.width || pod.measured?.width || 160;
    const podH = pod.height || pod.measured?.height || 130; // Use measured height for layout if available

    // If the current pod doesn't fit in the current row, move to next row
    if (currentX + podW > deployableWidth + paddingX && currentX > paddingX) {
      currentX = paddingX; // Reset X for new row
      currentY += rowMaxHeight + spacing; // Move Y down by max height of previous row + spacing
      rowMaxHeight = 0; // Reset max height for new row
    }

    // Update max height for the current row
    rowMaxHeight = Math.max(rowMaxHeight, podH);

    const newPosition = { x: currentX, y: currentY };
    currentX += podW + spacing; // Advance X for next pod

    return {
      ...pod,
      position: newPosition,
    };
  });

  return updatedPods;
};
