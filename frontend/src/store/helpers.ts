import { Node } from '@xyflow/react';
import { K8sNodeData } from '../types';

export const getNodeData = (node: Node): K8sNodeData => {
  return (node.data as unknown as K8sNodeData) || ({} as K8sNodeData);
};

export const isAllowed = (parentType: string, childType: string): boolean => {
  if (parentType === 'Deployment') return childType === 'Pod';
  if (parentType === 'Namespace') return ['Pod', 'Deployment', 'Service', 'Internet', 'Ingress', 'HPA'].includes(childType);
  return false;
};

export const getAbsPos = (nodeId: string, currentNodes: Node[], draggedNode?: Node): { x: number, y: number } => {
  const n = (draggedNode && nodeId === draggedNode.id) ? draggedNode : currentNodes.find(i => i.id === nodeId);
  if (!n || !n.position) return { x: 0, y: 0 };
  if (!n.parentId) return n.position;
  const pAbs = getAbsPos(n.parentId, currentNodes, draggedNode);
  return { x: n.position.x + pAbs.x, y: n.position.y + pAbs.y };
};

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
  // Match visibility logic with BaseNode
  const showDashedProgress = data.type === 'Pod' && (totalDeploymentReplicas > 3 || (replicas > 1 && !data.parentId));

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
  // Base height: Header(24) + Gap(8) + Label(16) + Padding(24) = ~72
  let height = 72;

  if (showDashedProgress) height += 14; // Progress bar + gap
  
  // Resources block
  if (data.displaySettings?.resources !== false && (data.cpuLimit || data.memoryLimit)) {
    height += 38; 
  }

  if (badges.length > 0) height += 20; // Badges + gap

  if (image && data.displaySettings?.image !== false) {
    const imageContainerWidth = width - horizontalPadding;
    const charsPerLine = Math.max(10, Math.floor(imageContainerWidth / 5.5));
    const lines = Math.ceil(image.length / charsPerLine);
    height += lines * 12 + 8; 
  }

  return { width, height: Math.max(POD_MIN_DIMENSIONS.height, Math.ceil(height)) };
};

export const sortNodes = (nodes: Node[]): Node[] => {
  const priority: Record<string, number> = {
    Namespace: 0,
    Deployment: 1,
    PodGroup: 1,
    Pod: 2,
    Service: 3,
    Internet: 3,
    Ingress: 3,
    HPA: 3,
  };

  return [...nodes].sort((a, b) => {
    const aPrio = priority[a.type || ''] ?? 5;
    const bPrio = priority[b.type || ''] ?? 5;
    return aPrio - bPrio;
  });
};

// Helper function to sync pods within a deployment based on replica count
export const syncPodsInDeployment = (deployment: Node, currentPods: Node[], dataTemplate?: Node): Node[] => {
  const data = deployment.data as unknown as K8sNodeData;
  const totalReplicas = data.replicas || 0;
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
  
  const commonData = {
    image: templatePod?.data?.image ?? deployment.data.image,
    webserver: templatePod?.data?.webserver ?? deployment.data.webserver ?? 'none',
    runtime: templatePod?.data?.runtime ?? deployment.data.runtime ?? 'none',
    framework: templatePod?.data?.framework ?? deployment.data.framework,
    status: templatePod?.data?.status ?? deployment.data.status ?? 'pending',
    label: templatePod?.data?.label ?? deployment.data.label ?? 'new-app-pod',
    isAutoNamed: templatePod?.data?.isAutoNamed ?? deployment.data.isAutoNamed ?? true,
    displaySettings: dataTemplate ? dataTemplate.data.displaySettings : (deployment.data.displaySettings || templatePod?.data?.displaySettings),
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

      const isSameLabel = existingPod.data.label === commonData.label;
      const podData = isSameLabel 
        ? { ...existingPod.data, ...commonData, replicas, parentReplicas: totalReplicas }
        : { ...existingPod.data, replicas, parentReplicas: totalReplicas };

      newPods.push({
        ...existingPod,
        parentId: deploymentId,
        width,
        height: undefined,
        style: { width, minHeight },
        measured: undefined,
        extent: 'parent',
        data: podData
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

export const calculateAlignmentGuides = (
  node: Node,
  nodes: Node[],
  nodeAbs: { x: number, y: number },
  isDetaching: boolean,
  hoveredDeploymentId: string | null = null
) => {
  const SNAP_THRESHOLD = 8;
  const SNAP_TOLERANCE = 4;
  const verticalGuides = new Map<number, any>();
  const horizontalGuides = new Map<number, any>();
  const vSnap = new Map<number, boolean>();
  const hSnap = new Map<number, boolean>();

  const nodeWidth = node.width || node.measured?.width || 160;
  const nodeHeight = node.height || node.measured?.height || 80;

  // If a pod is being dragged over a deployment, show guides for its auto-layout slot
  if (node.type === 'Pod' && hoveredDeploymentId && !isDetaching) {
    const deployment = nodes.find(n => n.id === hoveredDeploymentId);
    if (deployment) {
      const depPods = nodes.filter(n => n.parentId === deployment.id && n.type === 'Pod');
      let layoutNodes = depPods;
      if (!depPods.find(p => p.id === node.id)) {
        layoutNodes = [...depPods, node];
      }
      
      const laidOut = layoutPodsInDeployment(deployment, layoutNodes);
      const targetPod = laidOut.find(p => p.id === node.id);
      
      if (targetPod) {
        const depAbs = getAbsPos(deployment.id, nodes);
        const targetAbsX = depAbs.x + targetPod.position.x;
        const targetAbsY = depAbs.y + targetPod.position.y;
        
        verticalGuides.set(targetAbsX, { position: targetAbsX });
        horizontalGuides.set(targetAbsY, { position: targetAbsY });
        vSnap.set(targetAbsX, true); // Force snap
        hSnap.set(targetAbsY, true); // Force snap
      }
      return {
        verticalGuides: Array.from(verticalGuides.values()),
        horizontalGuides: Array.from(horizontalGuides.values()),
        vSnap,
        hSnap
      };
    }
  }

  // Detect if we should show guides for this node
  const shouldShowGuides = true;

  if (shouldShowGuides) {
    const nodeLeftX = nodeAbs.x;
    const nodeCenterX = nodeAbs.x + nodeWidth / 2;
    const nodeRightX = nodeAbs.x + nodeWidth;
    const nodeTopY = nodeAbs.y;
    const nodeCenterY = nodeAbs.y + nodeHeight / 2;
    const nodeBottomY = nodeAbs.y + nodeHeight;

    for (const otherNode of nodes.filter(n => n.id !== node.id)) {
      const otherAbs = getAbsPos(otherNode.id, nodes);
      const otherWidth = otherNode.width || otherNode.measured?.width || 160;
      const otherHeight = otherNode.height || otherNode.measured?.height || 80;

      const otherLeftX = otherAbs.x;
      const otherRightX = otherAbs.x + otherWidth;
      const otherTopY = otherAbs.y;
      const otherBottomY = otherAbs.y + otherHeight;

      const otherPointsX = [
        otherLeftX,
        otherAbs.x + otherWidth / 2,
        otherRightX
      ];
      const otherPointsY = [
        otherTopY,
        otherAbs.y + otherHeight / 2,
        otherBottomY
      ];

      const nodePointsX = [
        { pos: nodeLeftX, type: 'edge' },
        { pos: nodeCenterX, type: 'center' },
        { pos: nodeRightX, type: 'edge' }
      ];
      const nodePointsY = [
        { pos: nodeTopY, type: 'edge' },
        { pos: nodeCenterY, type: 'center' },
        { pos: nodeBottomY, type: 'edge' }
      ];

      // Check X alignment (Vertical lines)
      for (const nP of nodePointsX) {
        for (const oP of otherPointsX) {
          if (Math.abs(nP.pos - oP) < SNAP_THRESHOLD) {
            verticalGuides.set(oP, {
              position: oP,
              targetNodeId: otherNode.id,
              type: nP.type === 'center' ? 'center' : 'edge',
              // Store bounds to draw a segment later
              minY: Math.min(nodeTopY, otherTopY),
              maxY: Math.max(nodeBottomY, otherBottomY)
            });
            if (Math.abs(nP.pos - oP) < SNAP_TOLERANCE) {
              vSnap.set(oP, true);
            }
          }
        }
      }

      // Check Y alignment (Horizontal lines)
      for (const nP of nodePointsY) {
        for (const oP of otherPointsY) {
          if (Math.abs(nP.pos - oP) < SNAP_THRESHOLD) {
            horizontalGuides.set(oP, {
              position: oP,
              targetNodeId: otherNode.id,
              type: nP.type === 'center' ? 'center' : 'edge',
              minX: Math.min(nodeLeftX, otherLeftX),
              maxX: Math.max(nodeRightX, otherRightX)
            });
            if (Math.abs(nP.pos - oP) < SNAP_TOLERANCE) {
              hSnap.set(oP, true);
            }
          }
        }
      }
    }
  }

  // Convert back to arrays
  const vGuides = Array.from(verticalGuides.values());
  const hGuides = Array.from(horizontalGuides.values());

  return { verticalGuides: vGuides, horizontalGuides: hGuides, vSnap, hSnap };
};
