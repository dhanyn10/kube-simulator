import { Node } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { checkXAlignment, checkYAlignment, getPodSpacing, getReplicaThresholds } from './layoutHelpers';
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
const getDeploymentSlotGuides = (node: Node, nodes: Node[], hoveredDeploymentId: string) => {
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
  
  return {
    verticalGuides: [{ position: targetAbsX }],
    horizontalGuides: [{ position: targetAbsY }],
    vSnap: new Map([[targetAbsX, true]]),
    hSnap: new Map([[targetAbsY, true]])
  };
};

export const calculateAlignmentGuides = (
  node: Node,
  nodes: Node[],
  nodeAbs: { x: number, y: number },
  isDetaching: boolean,
  hoveredDeploymentId: string | null = null
) => {
  if (node.type === 'Pod' && hoveredDeploymentId && !isDetaching) {
    const slotGuides = getDeploymentSlotGuides(node, nodes, hoveredDeploymentId);
    if (slotGuides) return slotGuides;
  }

  const verticalGuides = new Map<number, any>();
  const horizontalGuides = new Map<number, any>();
  const vSnap = new Map<number, boolean>();
  const hSnap = new Map<number, boolean>();

  const nodeWidth = node.width || node.measured?.width || 160;
  const nodeHeight = node.height || node.measured?.height || 80;

  const otherNodes = nodes.filter(n => n.id !== node.id);
  let closestOtherNode: Node | null = null;
  let minDistanceY = Infinity;

  const nodeAbsYCenter = nodeAbs.y + nodeHeight / 2;

  otherNodes.forEach(otherNode => {
    const otherAbs = getAbsPos(otherNode.id, nodes);
    const otherH = otherNode.height || otherNode.measured?.height || 80;
    const otherAbsYCenter = otherAbs.y + otherH / 2;
    const distanceY = Math.abs(nodeAbsYCenter - otherAbsYCenter);
    if (distanceY < minDistanceY) {
      minDistanceY = distanceY;
      closestOtherNode = otherNode;
    }
  });

  otherNodes.forEach(otherNode => {
    const otherAbs = getAbsPos(otherNode.id, nodes);
    const otherW = otherNode.width || otherNode.measured?.width || 160;
    const otherH = otherNode.height || otherNode.measured?.height || 80;

    const otherPointsX = [otherAbs.x, otherAbs.x + otherW / 2, otherAbs.x + otherW];
    const nodePointsX = [
      { pos: nodeAbs.x, type: 'edge' },
      { pos: nodeAbs.x + nodeWidth / 2, type: 'center' },
      { pos: nodeAbs.x + nodeWidth, type: 'edge' }
    ];

    const config = { threshold: 8, tolerance: 4 };

    // Always check X alignment (vertical guides) against all other nodes
    nodePointsX.forEach(nP => checkXAlignment({
      nP,
      otherPoints: otherPointsX,
      otherNode,
      guides: verticalGuides,
      snap: vSnap,
      config,
      nodeAbs,
      otherAbs,
      size: { node: nodeHeight, other: otherH }
    }));

    // ONLY check Y alignment (horizontal guides) if otherNode is the vertically closest node
    if (closestOtherNode && otherNode.id === closestOtherNode.id) {
      const otherPointsY = [otherAbs.y, otherAbs.y + otherH / 2, otherAbs.y + otherH];
      const nodePointsY = [
        { pos: nodeAbs.y, type: 'edge' },
        { pos: nodeAbs.y + nodeHeight / 2, type: 'center' },
        { pos: nodeAbs.y + nodeHeight, type: 'edge' }
      ];
      nodePointsY.forEach(nP => checkYAlignment({
        nP,
        otherPoints: otherPointsY,
        otherNode,
        guides: horizontalGuides,
        snap: hSnap,
        config,
        nodeAbs,
        otherAbs,
        size: { node: nodeWidth, other: otherW }
      }));
    }
  });

  return {
    verticalGuides: Array.from(verticalGuides.values()),
    horizontalGuides: Array.from(horizontalGuides.values()),
    vSnap,
    hSnap
  };
};

const getEffectiveSize = (node: Node) => {
  if (node.type === 'Pod') {
    const minSize = getPodMinimumSize(node.data);
    return {
      width: Math.max(node.width || 0, node.measured?.width || 0, minSize.width),
      height: Math.max(node.height || 0, node.measured?.height || 0, minSize.height)
    };
  }
  const getDefaultSize = (type: string | undefined) => {
    if (type === 'Deployment') return { w: 320, h: 160 };
    if (type === 'Namespace') return { w: 600, h: 400 };
    return { w: 160, h: 80 };
  };

  const { w: defaultW, h: defaultH } = getDefaultSize(node.type);
  return {
    width: Math.max(node.width || 0, node.measured?.width || 0, defaultW),
    height: Math.max(node.height || 0, node.measured?.height || 0, defaultH)
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
