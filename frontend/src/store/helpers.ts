import { Node } from '@xyflow/react';

export const POD_MIN_DIMENSIONS = {
  width: 168,
  height: 92,
};

export const getPodMinimumSize = (data: any = {}) => {
  const label = String(data.label || '');
  const image = String(data.image || '');
  const badges = [data.runtime, data.webserver]
    .filter(value => value && value !== 'none')
    .map(String);
  const replicas = data.replicas || 1;
  const showsReplicaBadge = replicas > 1;
  const totalDeploymentReplicas = data.parentReplicas || 0;
  const showDashedProgress = data.type === 'Pod' && totalDeploymentReplicas > 3;

  const horizontalPadding = 24;
  const contentPadding = 16;
  const headerToolsWidth = 44;
  const headerContentWidth = 36 + (showsReplicaBadge ? String(replicas).length * 5 + 18 : 0);
  const labelWidth = label.length * 7 + contentPadding;
  const badgeWidth = badges.length > 0
    ? badges.reduce((total, badge) => total + badge.length * 5 + 14, 0) + Math.max(0, badges.length - 1) * 4
    : 0;
  const readableImageWidth = image.length > 0
    ? Math.min(320, Math.max(148, image.length * 5.5 + contentPadding))
    : 0;

  const width = Math.ceil(Math.max(
    POD_MIN_DIMENSIONS.width,
    headerContentWidth + headerToolsWidth + horizontalPadding,
    labelWidth + horizontalPadding,
    badgeWidth + horizontalPadding,
    readableImageWidth + horizontalPadding
  ));

  // Dynamic height calculation
  // Base height: Padding(24) + Header(24) + Gap(8) + Label(16) + Gap(8) = 80
  let height = 80;

  if (showDashedProgress) height += 12; // Progress bar + gap
  if (badges.length > 0) height += 18; // Badges + gap

  if (image) {
    const imageContainerWidth = width - horizontalPadding;
    const charsPerLine = Math.max(10, Math.floor(imageContainerWidth / 5.5));
    const lines = Math.ceil(image.length / charsPerLine);
    height += lines * 12 + 4; // 12px per line + small padding
  }

  return { width, height: Math.max(POD_MIN_DIMENSIONS.height, Math.ceil(height)) };
};

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
      const minSize = getPodMinimumSize({ ...existingPod.data, ...commonData, replicas });
      const width = existingPod.data?.isManuallyResized
        ? Math.max(existingPod.width || 0, existingPod.measured?.width || 0, minSize.width)
        : minSize.width;
      const minHeight = existingPod.data?.isManuallyResized
        ? Math.max(existingPod.height || 0, existingPod.measured?.height || 0, minSize.height)
        : minSize.height;

      newPods.push({
        ...existingPod,
        width,
        height: undefined,
        style: { width, minHeight },
        measured: undefined,
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
      const minSize = getPodMinimumSize({ ...commonData, replicas });
      newPods.push({
        id,
        type: 'Pod',
        position: { x: 0, y: 0 },
        parentId: deploymentId,
        width: minSize.width,
        height: undefined,
        style: { width: minSize.width, minHeight: minSize.height },
        measured: undefined,
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
  const spacing = 16;
  
  const deploymentWidth = deployment.width || deployment.measured?.width || 320;
  const deployableWidth = Math.max(100, deploymentWidth - (2 * paddingX));

  let currentX = paddingX;
  let currentY = paddingY;
  let rowMaxHeight = 0;

  const updatedPods = pods.map(pod => {
    const minSize = getPodMinimumSize(pod.data);
    const podW = Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width);
    const podH = Math.max(
      pod.height || 0,
      pod.measured?.height || 0,
      Number((pod.style as any)?.minHeight) || 0,
      minSize.height
    );

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
      width: podW,
      height: pod.height,
      style: { ...(pod.style || {}), width: podW, minHeight: Math.max(Number((pod.style as any)?.minHeight) || 0, minSize.height) },
      measured: pod.measured,
      position: newPosition,
    };
  });

  return updatedPods;
};
