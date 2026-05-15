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

const calculatePodWidth = (data: any, badges: string[]) => {
  const horizontalPadding = 24;
  const isMegaPod = data.replicas === 100;
  const baseWidth = isMegaPod ? POD_MIN_DIMENSIONS.width * 2 : POD_MIN_DIMENSIONS.width;
  const headerContentWidth = 36 + (data.replicas > 1 ? String(data.replicas).length * 5 + 18 : 0);
  const labelWidth = String(data.label || '').length * 7 + 16;
  const badgeWidth = badges.length > 0 ? badges.reduce((t, b) => t + b.length * 5 + 14, 0) + (badges.length - 1) * 4 : 0;
  const readableImageWidth = String(data.image || '').length > 0 ? Math.min(320, Math.max(148, String(data.image || '').length * 5.5 + 16)) : 0;
  return Math.ceil(Math.max(baseWidth, headerContentWidth + 44 + horizontalPadding, labelWidth + horizontalPadding, badgeWidth + horizontalPadding, readableImageWidth + horizontalPadding));
};

const calculatePodHeight = (data: any, width: number, badges: string[], isMegaPod: boolean) => {
  const showDashedProgress = data.type === 'Pod' && ((data.parentReplicas || 0) > 3 || ((data.replicas || 1) > 1 && !data.parentId));
  let height = 72;
  if (showDashedProgress) height += isMegaPod ? 120 : 14;
  if (data.displaySettings?.resources !== false && (data.cpuLimit || data.memoryLimit)) height += 38;
  if (badges.length > 0) height += 20;
  if (data.image && data.displaySettings?.image !== false) {
    const charsPerLine = Math.max(10, Math.floor((width - 24) / 5.5));
    height += Math.ceil(String(data.image).length / charsPerLine) * 12 + 8;
  }
  const baseHeight = isMegaPod ? POD_MIN_DIMENSIONS.height * 2 : POD_MIN_DIMENSIONS.height;
  return Math.max(baseHeight, Math.ceil(height));
};

export const getPodMinimumSize = (data: any = {}) => {
  const badges = [data.runtime, data.webserver].filter(v => v && v !== 'none').map(String);
  const width = calculatePodWidth(data, badges);
  const height = calculatePodHeight(data, width, badges, data.replicas === 100);
  return { width, height };
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
  } else if (totalReplicas <= 100) {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = Math.min(remaining, 10);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  } else {
    let remaining = totalReplicas;
    while (remaining > 0) {
      if (remaining >= 100) {
        targetPodReplicas.push(100);
        remaining -= 100;
      } else {
        // Break down the remainder into chunks of 10 for visual consistency
        const count = Math.min(remaining, 10);
        targetPodReplicas.push(count);
        remaining -= count;
      }
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
    cpuLimit: templatePod?.data?.cpuLimit ?? deployment.data.cpuLimit,
    memoryLimit: templatePod?.data?.memoryLimit ?? deployment.data.memoryLimit,
    cpuRequest: templatePod?.data?.cpuRequest ?? deployment.data.cpuRequest,
    memoryRequest: templatePod?.data?.memoryRequest ?? deployment.data.memoryRequest,
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

      const podData = { 
        ...existingPod.data, 
        ...commonData, 
        replicas, 
        parentReplicas: totalReplicas 
      };

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
      const id = `pod-${crypto.randomUUID().split('-')[0]}`;
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
  const paddingX = 24;
  const paddingY = 48; // Account for deployment header
  const deploymentWidth = deployment.width || deployment.measured?.width || 320;
  const deployableWidth = Math.max(100, deploymentWidth - (2 * paddingX));

  let currentX = paddingX;
  let currentY = paddingY;
  let rowMaxHeight = 0;
  let prevPodSpacing = 20;

  const updatedPods = pods.map((pod, idx) => {
    const isMegaPod = pod.data?.replicas === 100;
    const mySpacing = isMegaPod ? 56 : 20;
    
    const minSize = getPodMinimumSize(pod.data);
    const podW = Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width);
    const podH = Math.max(
      pod.height || 0,
      pod.measured?.height || 0,
      Number((pod.style as any)?.minHeight) || 0,
      minSize.height
    );

    // If we're not at the start of a row, ensure the gap between the previous pod and this one 
    // is at least the maximum of their spacing requirements.
    if (idx > 0 && currentX > paddingX) {
      const gapRequired = Math.max(prevPodSpacing, mySpacing);
      // 'currentX' already includes 'prevPodSpacing' from the previous iteration's 'currentX += podW + mySpacing'
      if (gapRequired > prevPodSpacing) {
        currentX += (gapRequired - prevPodSpacing);
      }
    }

    // If the current pod doesn't fit in the current row, move to next row
    if (currentX + podW > deployableWidth + paddingX && currentX > paddingX) {
      currentX = paddingX; // Reset X for new row
      // For vertical spacing, we also use the max requirement
      const verticalGap = Math.max(prevPodSpacing, mySpacing);
      currentY += rowMaxHeight + verticalGap; 
      rowMaxHeight = 0; // Reset max height for new row
    }

    // Update max height for the current row
    rowMaxHeight = Math.max(rowMaxHeight, podH);

    const newPosition = { x: currentX, y: currentY };
    currentX += podW + mySpacing; 
    prevPodSpacing = mySpacing;

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
      if (!depPods.some(p => p.id === node.id)) {
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

const getEffectiveSize = (node: Node) => {
  if (node.type === 'Pod') {
    const minSize = getPodMinimumSize(node.data);
    return {
      width: Math.max(node.width || 0, node.measured?.width || 0, minSize.width),
      height: Math.max(node.height || 0, node.measured?.height || 0, minSize.height)
    };
  }
  const defaultW = node.type === 'Deployment' ? 320 : (node.type === 'Namespace' ? 600 : 160);
  const defaultH = node.type === 'Deployment' ? 160 : (node.type === 'Namespace' ? 400 : 80);
  return {
    width: Math.max(node.width || 0, node.measured?.width || 0, defaultW),
    height: Math.max(node.height || 0, node.measured?.height || 0, defaultH)
  };
};

const resolvePairOverlap = (nodeA: Node, nodeB: Node, fixedNodeId?: string, padding = 32): boolean => {
  const sizeA = getEffectiveSize(nodeA);
  const sizeB = getEffectiveSize(nodeB);

  const bA = { x: nodeA.position.x, y: nodeA.position.y, w: sizeA.width, h: sizeA.height, centerX: nodeA.position.x + sizeA.width / 2, centerY: nodeA.position.y + sizeA.height / 2 };
  const bB = { x: nodeB.position.x, y: nodeB.position.y, w: sizeB.width, h: sizeB.height, centerX: nodeB.position.x + sizeB.width / 2, centerY: nodeB.position.y + sizeB.height / 2 };

  const isOverlapping = bA.x < bB.x + bB.w + padding && bA.x + bA.w + padding > bB.x && bA.y < bB.y + bB.h + padding && bA.y + bA.h + padding > bB.y;
  if (!isOverlapping) return false;

  const dx = bB.centerX - bA.centerX;
  const dy = bB.centerY - bA.centerY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > absDy) {
    const totalW = (bA.w + bB.w) / 2 + padding;
    const overlapDist = totalW - absDx;
    const dir = dx >= 0 ? 1 : -1;
    if (nodeA.id === fixedNodeId) { nodeB.position.x += overlapDist * dir; nodeB.position.y = bA.centerY - bB.h / 2; }
    else if (nodeB.id === fixedNodeId) { nodeA.position.x -= overlapDist * dir; nodeA.position.y = bB.centerY - bA.h / 2; }
    else { nodeA.position.x -= (overlapDist / 2) * dir; nodeB.position.x += (overlapDist / 2) * dir; const midY = (bA.centerY + bB.centerY) / 2; nodeA.position.y = midY - bA.h / 2; nodeB.position.y = midY - bB.h / 2; }
  } else {
    const totalH = (bA.h + bB.h) / 2 + padding;
    const overlapDist = totalH - absDy;
    const dir = dy >= 0 ? 1 : -1;
    if (nodeA.id === fixedNodeId) { nodeB.position.y += overlapDist * dir; nodeB.position.x = bA.centerX - bB.w / 2; }
    else if (nodeB.id === fixedNodeId) { nodeA.position.y -= overlapDist * dir; nodeA.position.x = bB.centerX - bA.w / 2; }
    else { nodeA.position.y -= (overlapDist / 2) * dir; nodeB.position.y += (overlapDist / 2) * dir; const midX = (bA.centerX + bB.centerX) / 2; nodeA.position.x = midX - bA.w / 2; nodeB.position.x = midX - bB.w / 2; }
  }
  return true;
};

export const resolveGlobalCollisions = (nodes: Node[], fixedNodeId?: string, iterations = 3): Node[] => {
  let nextNodes = nodes.map(n => ({ ...n, position: { ...n.position } }));
  const PADDING = 32;

  for (let iter = 0; iter < iterations; iter++) {
    let collisionDetected = false;
    const groups = new Map<string | undefined, string[]>();
    nextNodes.forEach(n => { const p = n.parentId; if (!groups.has(p)) groups.set(p, []); groups.get(p)!.push(n.id); });

    for (const [parentId, siblingIds] of groups.entries()) {
      const parentNode = parentId ? nextNodes.find(n => n.id === parentId) : null;
      if (parentNode?.type === 'Deployment' || parentNode?.type === 'PodGroup') continue;

      for (let i = 0; i < siblingIds.length; i++) {
        for (let j = i + 1; j < siblingIds.length; j++) {
          const nodeA = nextNodes.find(n => n.id === siblingIds[i])!;
          const nodeB = nextNodes.find(n => n.id === siblingIds[j])!;
          if (resolvePairOverlap(nodeA, nodeB, fixedNodeId, PADDING)) collisionDetected = true;
        }
      }
    }
    if (!collisionDetected) break;
  }
  return nextNodes;
};
