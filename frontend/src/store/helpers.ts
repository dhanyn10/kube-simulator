import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { getAlignmentCandidates, getPodSpacing, getReplicaThresholds, AlignmentCandidate } from './layoutHelpers';
import { getPodMinimumSize } from '../lib/podSizing';

export const getNodeData = (node: Node): K8sNodeData => {
  return (node.data as unknown as K8sNodeData) || ({} as K8sNodeData);
};

export const isAllowed = (parentType: string, childType: string): boolean => {
  if (parentType === 'Deployment') return childType === 'Pod';
  if (parentType === 'Namespace') return ['Pod', 'Deployment', 'Service', 'Internet', 'Ingress', 'HPA'].includes(childType);
  return false;
};

export const getAbsPos = (nodeId: string, currentNodes: Node[], draggedNode?: Node): { x: number, y: number } => {
  const n = (draggedNode?.id === nodeId) ? draggedNode : currentNodes.find(i => i.id === nodeId);
  if (!n?.position) return { x: 0, y: 0 };
  if (!n.parentId) return n.position;
  const pAbs = getAbsPos(n.parentId, currentNodes, draggedNode);
  return { x: n.position.x + pAbs.x, y: n.position.y + pAbs.y };
};


export const sortNodes = (nodes: Node[]): Node[] => {
  const priority: Record<string, number> = {
    Namespace: 0,
    Deployment: 1,
    ReplicaSet: 1,
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

const selectValue = <T>(templateVal: T | undefined, deployVal: T | undefined, fallbackVal?: T): T | undefined => {
  if (templateVal !== undefined && templateVal !== null) {
    return templateVal;
  }
  if (deployVal !== undefined && deployVal !== null) {
    return deployVal;
  }
  return fallbackVal;
};

// Helper to extract common pod data from deployment or template
const getCommonPodData = (deployment: Node, currentPods: Node[], dataTemplate?: Node) => {
  const templatePod = dataTemplate || currentPods[0];
  const d = deployment.data as unknown as K8sNodeData;
  const t = templatePod?.data as unknown as K8sNodeData | undefined;

  const displaySettings = dataTemplate ? dataTemplate.data.displaySettings : (d?.displaySettings ?? t?.displaySettings);

  return {
    image: selectValue(t?.image, d.image),
    webserver: selectValue(t?.webserver, d.webserver, 'none'),
    runtime: selectValue(t?.runtime, d.runtime, 'none'),
    framework: selectValue(t?.framework, d.framework),
    status: selectValue(t?.status, d.status, 'pending'),
    label: selectValue(t?.label, d.label, 'new-app-pod'),
    isAutoNamed: selectValue(t?.isAutoNamed, d.isAutoNamed, true),
    cpuLimit: selectValue(t?.cpuLimit, d.cpuLimit),
    memoryLimit: selectValue(t?.memoryLimit, d.memoryLimit),
    cpuRequest: selectValue(t?.cpuRequest, d.cpuRequest),
    memoryRequest: selectValue(t?.memoryRequest, d.memoryRequest),
    displaySettings,
  };
};

// Helper to update an existing pod node
const updatePodNode = (existingPod: Node, commonData: any, replicas: number, totalReplicas: number, deploymentId: string): Node => {
  const minSize = getPodMinimumSize({ ...existingPod.data, ...commonData, replicas });
  const width = existingPod.data?.isManuallyResized
    ? Math.max(existingPod.width || 0, existingPod.measured?.width || 0, minSize.width)
    : minSize.width;
  const minHeight = existingPod.data?.isManuallyResized
    ? Math.max(existingPod.height || 0, existingPod.measured?.height || 0, minSize.height)
    : minSize.height;

  return {
    ...existingPod,
    parentId: deploymentId,
    width,
    height: undefined,
    style: { width, minHeight },
    measured: undefined,
    extent: 'parent',
    data: { 
      ...existingPod.data, 
      ...commonData, 
      replicas, 
      parentReplicas: totalReplicas 
    }
  };
};

// Helper to create a new pod node
const createPodNode = (commonData: any, replicas: number, totalReplicas: number, deploymentId: string): Node => {
  const id = `pod-${crypto.randomUUID().split('-')[0]}`;
  const minSize = getPodMinimumSize({ ...commonData, replicas });
  return {
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
      onDelete: () => {},
      onRename: () => {},
    }
  };
};

// Helper function to sync pods within a deployment based on replica count
export const syncPodsInDeployment = (deployment: Node, currentPods: Node[], dataTemplate?: Node): Node[] => {
  const data = deployment.data as unknown as K8sNodeData;
  const totalReplicas = data.replicas || 0;
  const targetPodReplicas = getReplicaThresholds(totalReplicas);
  const commonData = getCommonPodData(deployment, currentPods, dataTemplate);

  return targetPodReplicas.map((replicas, index) => {
    const existingPod = currentPods[index];
    return existingPod 
      ? updatePodNode(existingPod, commonData, replicas, totalReplicas, deployment.id)
      : createPodNode(commonData, replicas, totalReplicas, deployment.id);
  });
};

interface PodLayoutState {
  currentX: number;
  currentY: number;
  rowMaxHeight: number;
  prevPodSpacing: number;
}

const getPodDimensions = (pod: Node) => {
  const minSize = getPodMinimumSize(pod.data);
  const podW = Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width);
  const podH = Math.max(
    pod.height || 0,
    pod.measured?.height || 0,
    Number((pod.style as any)?.minHeight) || 0,
    minSize.height
  );
  return { podW, podH, minHeight: minSize.height };
};

const getUpdatedLayoutPosition = (
  idx: number,
  paddingX: number,
  deployableWidth: number,
  podW: number,
  podH: number,
  mySpacing: number,
  state: PodLayoutState
): { pos: { x: number; y: number }; nextState: PodLayoutState } => {
  let { currentX, currentY, rowMaxHeight, prevPodSpacing } = state;

  // Apply horizontal spacing adjustment if we're continuing on the same row
  if (idx > 0 && currentX > paddingX) {
    const gapRequired = Math.max(prevPodSpacing, mySpacing);
    if (gapRequired > prevPodSpacing) {
      currentX += (gapRequired - prevPodSpacing);
    }
  }

  // Wrap to the next row if the current pod exceeds deployment width limits
  const isExceedingWidth = currentX + podW > deployableWidth + paddingX;
  if (isExceedingWidth && currentX > paddingX) {
    currentX = paddingX;
    currentY += rowMaxHeight + Math.max(prevPodSpacing, mySpacing);
    rowMaxHeight = 0;
  }

  rowMaxHeight = Math.max(rowMaxHeight, podH);
  const pos = { x: currentX, y: currentY };

  // Advance layout cursor for the next pod
  currentX += podW + mySpacing;

  return {
    pos,
    nextState: {
      currentX,
      currentY,
      rowMaxHeight,
      prevPodSpacing: mySpacing,
    },
  };
};

// Helper function to layout pods within a deployment
export const layoutPodsInDeployment = (deployment: Node, pods: Node[]): Node[] => {
  const paddingX = 24;
  const paddingY = 48; // Account for deployment header
  const deploymentWidth = deployment.width || deployment.measured?.width || 320;
  const deployableWidth = Math.max(100, deploymentWidth - (2 * paddingX));

  let state: PodLayoutState = {
    currentX: paddingX,
    currentY: paddingY,
    rowMaxHeight: 0,
    prevPodSpacing: 20,
  };

  return pods.map((pod, idx) => {
    const isMegaPod = pod.data?.replicas === 100;
    const mySpacing = getPodSpacing(isMegaPod);
    const { podW, podH, minHeight } = getPodDimensions(pod);

    const { pos, nextState } = getUpdatedLayoutPosition(
      idx,
      paddingX,
      deployableWidth,
      podW,
      podH,
      mySpacing,
      state
    );
    state = nextState;

    return {
      ...pod,
      width: podW,
      style: {
        ...(pod.style || {}),
        width: podW,
        minHeight: Math.max(Number((pod.style as any)?.minHeight) || 0, minHeight),
      },
      position: pos,
    };
  });
};

// Helper to get alignment guides for a pod being dragged over a deployment
const getDeploymentSlotGuides = (node: Node, nodes: Node[], hoveredDeploymentId: string, nodeAbs: { x: number, y: number }) => {
  const deployment = nodes.find(n => n.id === hoveredDeploymentId);
  if (!deployment) return null;

  const depPods = nodes.filter(n => n.parentId === deployment.id && n.type === 'Pod');
  const layoutNodes = depPods.some(p => p.id === node.id) ? depPods : [...depPods, node];
  
  const laidOut = layoutPodsInDeployment(deployment, layoutNodes);
  const targetPod = laidOut.find(p => p.id === node.id);
  if (!targetPod) return null;

  const depAbs = getAbsPos(deployment.id, nodes);
  const targetAbsX = depAbs.x + targetPod.position.x;
  const targetAbsY = depAbs.y + targetPod.position.y;

  const { width: nodeW, height: nodeH } = getEffectiveSize(node);
  const distV = Math.abs(nodeAbs.x - targetAbsX);
  const distH = Math.abs(nodeAbs.y - targetAbsY);

  const verticalGuides = distV < 24 ? [{
    position: targetAbsX,
    targetNodeId: deployment.id,
    sourceType: 'edge',
    targetType: 'edge',
    targetCenterPos: targetAbsY + nodeH / 2,
    minY: Math.min(targetAbsY, depAbs.y),
    maxY: Math.max(targetAbsY + nodeH, depAbs.y + (deployment.height || 300))
  }] : [];

  const horizontalGuides = distH < 24 ? [{
    position: targetAbsY,
    targetNodeId: deployment.id,
    sourceType: 'edge',
    targetType: 'edge',
    targetCenterPos: targetAbsX + nodeW / 2,
    minX: Math.min(targetAbsX, depAbs.x),
    maxX: Math.max(targetAbsX + nodeW, depAbs.x + (deployment.width || 400))
  }] : [];

  return {
    verticalGuides,
    horizontalGuides,
    vSnap: new Map(distV < 8 ? [[targetAbsX, { sourceType: 'edge' as const }]] : []),
    hSnap: new Map(distH < 8 ? [[targetAbsY, { sourceType: 'edge' as const }]] : [])
  };
};

const selectBestCandidate = (candidates: AlignmentCandidate[]): AlignmentCandidate | null => {
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    // 1. Snapping Proximity (Delta X/Y): Prefer the guide that is physically closest to being aligned.
    // This ensures we only show guides when the nodes are actually close to alignment.
    if (Math.abs(a.distance - b.distance) > 0.1) return a.distance - b.distance;

    // 2. Orthogonal Proximity: Pick reference that is physically closest on the other axis.
    // This satisfies the "closest node" visual feel.
    if (Math.abs(a.crossDistance - b.crossDistance) > 0.1) return a.crossDistance - b.crossDistance;

    // 3. Connected nodes have priority if distances are identical
    if (a.isConnected && !b.isConnected) return -1;
    if (b.isConnected && !a.isConnected) return 1;

    return 0;
  })[0];
};

export const getEffectiveSize = (node: Node) => {
  // Use manual width/height if available (user resized)
  const w = node.width;
  const h = node.height;

  // For containers, we can trust measured size as they don't have quick-connect arrows polling
  if (node.type === 'Namespace' || node.type === 'Deployment') {
      return {
          width: w || node.measured?.width || (node.type === 'Namespace' ? 600 : 400),
          height: h || node.measured?.height || (node.type === 'Namespace' ? 400 : 300)
      };
  }

  // For standard nodes, calculate size to avoid measurement pollution from quick-connect arrows
  const minSize = getPodMinimumSize(node.data);

  if (node.type === 'ConfigMap' || node.type === 'Secret') {
      return {
          width: w || minSize.width,
          height: h || Math.max(120, minSize.height)
      };
  }

  return {
    width: w || minSize.width,
    height: h || Math.max(80, minSize.height)
  };
};

export const calculateAlignmentGuides = (
  node: Node,
  nodes: Node[],
  edges: Edge[],
  nodeAbs: { x: number, y: number },
  isDetaching: boolean,
  hoveredDeploymentId: string | null = null
) => {
  let slotGuides = null;
  if (node.type === 'Pod' && hoveredDeploymentId && !isDetaching) {
    slotGuides = getDeploymentSlotGuides(node, nodes, hoveredDeploymentId, nodeAbs);
  }

  const { width: nodeWidth, height: nodeHeight } = getEffectiveSize(node);

  const config = { threshold: 10, tolerance: 4 };

  const allVCandidates: AlignmentCandidate[] = [];
  const allHCandidates: AlignmentCandidate[] = [];

  const connectedNodeIds = new Set(
    edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => (e.source === node.id ? e.target : e.source))
  );

  // Also treat parent/children as connected for snapping purposes
  if (node.parentId) connectedNodeIds.add(node.parentId);
  nodes.forEach(n => { if (n.parentId === node.id) connectedNodeIds.add(n.id); });

  // If pod is hovering over deployment, treat it as connected for snapping threshold
  if (node.type === 'Pod' && hoveredDeploymentId) {
    connectedNodeIds.add(hoveredDeploymentId);
  }

  nodes
    .filter(n => n.id !== node.id)
    .forEach(otherNode => {
      const isConnected = connectedNodeIds.has(otherNode.id);
      const otherAbs = getAbsPos(otherNode.id, nodes);
      const { width: otherW, height: otherH } = getEffectiveSize(otherNode);

      const otherPointsX = [
        { pos: otherAbs.x + otherW / 2, type: 'center' }
      ];
      const otherPointsY = [
        { pos: otherAbs.y + otherH / 2, type: 'center' }
      ];

      const nodePointsX = [
        { pos: nodeAbs.x + nodeWidth / 2, type: 'center' }
      ];
      const nodePointsY = [
        { pos: nodeAbs.y + nodeHeight / 2, type: 'center' }
      ];

      nodePointsX.forEach(nP => {
        const threshold = isConnected ? 16 : config.threshold;
        allVCandidates.push(...getAlignmentCandidates({
          nP, otherPoints: otherPointsX, otherNode,
          config: { ...config, threshold },
          nodeAbs, otherAbs,
          size: { node: nodeHeight, other: otherH }, axis: 'x', isConnected
        }));
      });

      nodePointsY.forEach(nP => {
        const threshold = isConnected ? 16 : config.threshold;
        allHCandidates.push(...getAlignmentCandidates({
          nP, otherPoints: otherPointsY, otherNode,
          config: { ...config, threshold },
          nodeAbs, otherAbs,
          size: { node: nodeWidth, other: otherW }, axis: 'y', isConnected
        }));
      });
    });

  const bestV = selectBestCandidate(allVCandidates);
  const bestH = selectBestCandidate(allHCandidates);

  const verticalGuides = bestV ? [{
    position: Math.round(bestV.position),
    targetNodeId: bestV.targetNodeId,
    sourceType: bestV.sourceType,
    targetType: bestV.targetType,
    targetCenterPos: bestV.targetCenterPos,
    minY: bestV.min,
    maxY: bestV.max
  }] : [];

  const horizontalGuides = bestH ? [{
    position: Math.round(bestH.position),
    targetNodeId: bestH.targetNodeId,
    sourceType: bestH.sourceType,
    targetType: bestH.targetType,
    targetCenterPos: bestH.targetCenterPos,
    minX: bestH.min,
    maxX: bestH.max
  }] : [];

  const vSnap = new Map<number, { sourceType: 'center' | 'edge' }>();
  const hSnap = new Map<number, { sourceType: 'center' | 'edge' }>();

  const isVSnapActive = bestV && bestV.distance <= (bestV.isConnected ? 12.5 : 8.5);
  const isHSnapActive = bestH && bestH.distance <= (bestH.isConnected ? 12.5 : 8.5);

  if (isVSnapActive) vSnap.set(Math.round(bestV!.position), { sourceType: bestV!.sourceType });
  if (isHSnapActive) hSnap.set(Math.round(bestH!.position), { sourceType: bestH!.sourceType });

  // If slot guides were found, merge them. Slot guides take precedence.
  if (slotGuides) {
    const hasSlotV = slotGuides.verticalGuides.length > 0;
    const hasSlotH = slotGuides.horizontalGuides.length > 0;

    return {
        verticalGuides: hasSlotV ? slotGuides.verticalGuides : verticalGuides,
        horizontalGuides: hasSlotH ? slotGuides.horizontalGuides : horizontalGuides,
        vSnap: slotGuides.vSnap.size > 0 ? slotGuides.vSnap : vSnap,
        hSnap: slotGuides.hSnap.size > 0 ? slotGuides.hSnap : hSnap,
    };
  }

  return {
    verticalGuides,
    horizontalGuides,
    vSnap,
    hSnap
  };
};


// Helper to get bounding box info for collision resolution
const getBoundingBox = (node: Node) => {
  const size = getEffectiveSize(node);
  return {
    x: node.position.x,
    y: node.position.y,
    w: size.width,
    h: size.height,
    centerX: node.position.x + size.width / 2,
    centerY: node.position.y + size.height / 2
  };
};

const getCrossAxisProps = (axis: 'x' | 'y') => {
  return axis === 'x'
    ? ({ cross: 'y', centerKey: 'centerY', sizeKey: 'h' } as const)
    : ({ cross: 'x', centerKey: 'centerX', sizeKey: 'w' } as const);
};

// Helper to apply overlap resolution for a specific axis
const applyOverlapResolution = (
  nodeA: Node,
  nodeB: Node,
  bounds: { a: any; b: any },
  axis: 'x' | 'y',
  dist: number,
  fixedNodeId?: string,
  padding = 32
) => {
  const isX = axis === 'x';
  const sizeA = isX ? bounds.a.w : bounds.a.h;
  const sizeB = isX ? bounds.b.w : bounds.b.h;
  const overlapDist = (sizeA + sizeB) / 2 + padding - Math.abs(dist);
  const dir = dist >= 0 ? 1 : -1;

  const { cross, centerKey, sizeKey } = getCrossAxisProps(axis);

  if (nodeA.id === fixedNodeId) {
    nodeB.position[axis] += overlapDist * dir;
    nodeB.position[cross] = bounds.a[centerKey] - bounds.b[sizeKey] / 2;
  } else if (nodeB.id === fixedNodeId) {
    nodeA.position[axis] -= overlapDist * dir;
    nodeA.position[cross] = bounds.b[centerKey] - bounds.a[sizeKey] / 2;
  } else {
    nodeA.position[axis] -= (overlapDist / 2) * dir;
    nodeB.position[axis] += (overlapDist / 2) * dir;
    const midCross = (bounds.a[centerKey] + bounds.b[centerKey]) / 2;
    nodeA.position[cross] = midCross - bounds.a[sizeKey] / 2;
    nodeB.position[cross] = midCross - bounds.b[sizeKey] / 2;
  }
};

const resolvePairOverlap = (nodeA: Node, nodeB: Node, fixedNodeId?: string, padding = 32): boolean => {
  const bA = getBoundingBox(nodeA);
  const bB = getBoundingBox(nodeB);

  const isOverlapping = bA.x < bB.x + bB.w + padding && bA.x + bA.w + padding > bB.x && 
                        bA.y < bB.y + bB.h + padding && bA.y + bA.h + padding > bB.y;
  if (!isOverlapping) return false;

  const dx = bB.centerX - bA.centerX;
  const dy = bB.centerY - bA.centerY;

  if (Math.abs(dx) > Math.abs(dy)) {
    applyOverlapResolution(nodeA, nodeB, { a: bA, b: bB }, 'x', dx, fixedNodeId, padding);
  } else {
    applyOverlapResolution(nodeA, nodeB, { a: bA, b: bB }, 'y', dy, fixedNodeId, padding);
  }
  return true;
};

// Helper to group nodes by their parent ID
const groupNodesByParent = (nodes: Node[]) => {
  const groups = new Map<string | undefined, string[]>();
  nodes.forEach(n => {
    const p = n.parentId;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p)!.push(n.id);
  });
  return groups;
};

// Helper to resolve collisions between siblings within a single group
const resolveCollisionsInGroup = (siblingIds: string[], nextNodes: Node[], padding: number, fixedNodeId?: string): boolean => {
  let detected = false;
  for (let i = 0; i < siblingIds.length; i++) {
    for (let j = i + 1; j < siblingIds.length; j++) {
      const nodeA = nextNodes.find(n => n.id === siblingIds[i])!;
      const nodeB = nextNodes.find(n => n.id === siblingIds[j])!;
      if (resolvePairOverlap(nodeA, nodeB, fixedNodeId, padding)) {
        detected = true;
      }
    }
  }
  return detected;
};

// Helper to perform a single iteration of global collision resolution
const performCollisionIteration = (nextNodes: Node[], padding: number, fixedNodeId?: string): boolean => {
  let anyCollision = false;
  const groups = groupNodesByParent(nextNodes);

  for (const [parentId, siblingIds] of groups.entries()) {
    const parentNode = parentId ? nextNodes.find(n => n.id === parentId) : null;
    // Skip containers that manage their own internal layout (Pods in Deployments)
    if (parentNode?.type === 'Deployment' || parentNode?.type === 'ReplicaSet' || parentNode?.type === 'PodGroup') continue;

    if (resolveCollisionsInGroup(siblingIds, nextNodes, padding, fixedNodeId)) {
      anyCollision = true;
    }
  }
  return anyCollision;
};

export const resolveGlobalCollisions = (nodes: Node[], fixedNodeId?: string, iterations = 3): Node[] => {
  let nextNodes = nodes.map(n => ({ ...n, position: { ...n.position } }));
  const PADDING = 32;

  for (let iter = 0; iter < iterations; iter++) {
    if (!performCollisionIteration(nextNodes, PADDING, fixedNodeId)) break;
  }
  return nextNodes;
};

/**
 * Detects and resolves overlaps between nodes and edges not connected to them.
 */
export const resolveNodeEdgeCollisions = (nodes: Node[], edges: Edge[], fixedNodeId?: string): Node[] => {
  let nextNodes = nodes.map(n => ({ ...n, position: { ...n.position } }));
  const PADDING = 20;

  edges.forEach(edge => {
    const source = nextNodes.find(n => n.id === edge.source);
    const target = nextNodes.find(n => n.id === edge.target);
    if (!source || !target) return;

    const sAbs = getAbsPos(source.id, nextNodes);
    const tAbs = getAbsPos(target.id, nextNodes);

    // Get handle offsets
    const getHandlePos = (n: Node, handleId: string | null | undefined, abs: { x: number, y: number }) => {
        const w = n.width || n.measured?.width || 160;
        const h = n.height || n.measured?.height || 80;
        if (!handleId) return { x: abs.x + w / 2, y: abs.y + h / 2 };
        if (handleId.includes('top')) return { x: abs.x + w / 2, y: abs.y };
        if (handleId.includes('bottom')) return { x: abs.x + w / 2, y: abs.y + h };
        if (handleId.includes('left')) return { x: abs.x, y: abs.y + h / 2 };
        return { x: abs.x + w, y: abs.y + h / 2 };
    };

    const p1 = getHandlePos(source, edge.sourceHandle, sAbs);
    const p2 = getHandlePos(target, edge.targetHandle, tAbs);

    nextNodes.forEach(node => {
      // Don't collide with nodes that are connected to this edge
      if (node.id === edge.source || node.id === edge.target) return;
      // Skip containers
      if (['Deployment', 'Namespace', 'ReplicaSet'].includes(node.type || '')) return;

      const nAbs = getAbsPos(node.id, nextNodes);
      const size = getEffectiveSize(node);

      const rect = {
        left: nAbs.x - PADDING,
        right: nAbs.x + size.width + PADDING,
        top: nAbs.y - PADDING,
        bottom: nAbs.y + size.height + PADDING
      };

      // Simple line-rectangle intersection check
      const intersects = (x1: number, y1: number, x2: number, y2: number, r: any) => {
          const left = (x: number) => x < r.left;
          const right = (x: number) => x > r.right;
          const top = (y: number) => y < r.top;
          const bottom = (y: number) => y > r.bottom;

          if ((left(x1) && left(x2)) || (right(x1) && right(x2)) || (top(y1) && top(y2)) || (bottom(y1) && bottom(y2))) return false;

          // Check if any point is inside
          const isInside = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          if (isInside(x1, y1) || isInside(x2, y2)) return true;

          // Linear intersection with each side
          const dx = x2 - x1;
          const dy = y2 - y1;

          const intersectSide = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

          if (Math.abs(dx) < 0.001) {
              // Vertical line
              return x1 >= r.left && x1 <= r.right && Math.min(y1, y2) <= r.bottom && Math.max(y1, y2) >= r.top;
          }

          const m = dy / dx;
          const c = y1 - m * x1;

          // X = left
          let y = m * r.left + c;
          if (intersectSide(r.left, y) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) return true;
          // X = right
          y = m * r.right + c;
          if (intersectSide(r.right, y) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) return true;

          if (Math.abs(dy) < 0.001) {
              // Horizontal line
              return y1 >= r.top && y1 <= r.bottom && Math.min(x1, x2) <= r.right && Math.max(x1, x2) >= r.left;
          }

          // Y = top
          let x = (r.top - c) / m;
          if (intersectSide(x, r.top) && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) return true;
          // Y = bottom
          x = (r.bottom - c) / m;
          if (intersectSide(x, r.bottom) && x >= Math.min(x1, x2) && x <= Math.max(x1, x2)) return true;

          return false;
      };

      if (intersects(p1.x, p1.y, p2.x, p2.y, rect)) {
          // Push node away from the line
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const dx = nAbs.x + size.width/2 - midX;
          const dy = nAbs.y + size.height/2 - midY;

          const shift = 40;
          if (Math.abs(dx) > Math.abs(dy)) {
              node.position.x += dx > 0 ? shift : -shift;
          } else {
              node.position.y += dy > 0 ? shift : -shift;
          }
      }
    });
  });

  return nextNodes;
};

export const optimizeEdgeHandles = (nodeId: string, nodes: Node[], edges: Edge[]): Edge[] => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return edges;

  const getHandleCoords = (n: Node, side: string) => {
    const abs = getAbsPos(n.id, nodes);
    const w = n.width || n.measured?.width || 160;
    const h = n.height || n.measured?.height || 80;

    if (side === 'top') return { x: abs.x + w / 2, y: abs.y };
    if (side === 'bottom') return { x: abs.x + w / 2, y: abs.y + h };
    if (side === 'left') return { x: abs.x, y: abs.y + h / 2 };
    return { x: abs.x + w, y: abs.y + h / 2 }; // right
  };

  const sides = ['top', 'bottom', 'left', 'right'];

  return edges.map(edge => {
    if (edge.source !== nodeId && edge.target !== nodeId) return edge;

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    let bestDist = Infinity;
    let bestSource = edge.sourceHandle || 'right-s';
    let bestTarget = edge.targetHandle || 'left-t';

    for (const sSide of sides) {
      for (const tSide of sides) {
        const sCoord = getHandleCoords(sourceNode, sSide);
        const tCoord = getHandleCoords(targetNode, tSide);
        const dist = Math.sqrt(Math.pow(sCoord.x - tCoord.x, 2) + Math.pow(sCoord.y - tCoord.y, 2));

        if (dist < bestDist) {
          bestDist = dist;
          bestSource = `${sSide}-s`;
          bestTarget = `${tSide}-t`;
        }
      }
    }

    return {
      ...edge,
      sourceHandle: bestSource,
      targetHandle: bestTarget
    };
  });
};
