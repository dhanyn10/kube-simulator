import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { getReplicaThresholds } from './layoutHelpers';
import { getPodMinimumSize } from '@/lib/podSizing';
import { generateRandomHash, formatPodName } from '@/lib/utils';
import { calculateDeploymentLayoutWithYoga } from './deploymentYogaLayout';

export const getNodeData = (node: Node): K8sNodeData => {
  return (node.data as unknown as K8sNodeData) || ({} as K8sNodeData);
};

export const isAllowed = (parentType: string, childType: string, childData?: Record<string, any>): boolean => {
  if (parentType === 'Deployment' || parentType === 'StatefulSet') return childType === 'Pod';
  if (parentType === 'Namespace') {
    if (childType === 'Service' && childData?.serviceType === 'LoadBalancer') return false;
    return ['Pod', 'Deployment', 'StatefulSet', 'Service', 'Internet', 'Ingress', 'HPA', 'Role'].includes(childType);
  }
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
    StatefulSet: 1,
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
    roles: undefined,
    configMaps: undefined,
    secrets: undefined,
    hpas: undefined,
    resourceLimits: undefined,
  };
};

interface PodNodeParams {
  replicas: number;
  totalReplicas: number;
  deploymentId: string;
  podName: string;
  baseName: string;
  podHash: string;
  replicaSuffix: string;
  replicaSuffixes?: string[];
}

// Helper to update an existing pod node
const updatePodNode = (
  existingPod: Node,
  commonData: any,
  params: PodNodeParams,
  parentData?: Partial<K8sNodeData>
): Node => {
  const { replicas, totalReplicas, deploymentId, podName, baseName, podHash, replicaSuffix, replicaSuffixes } = params;
  const minSize = getPodMinimumSize({ ...existingPod.data, ...commonData, replicas }, parentData);
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
    height: existingPod.height || minHeight,
    style: { width, minHeight },
    measured: existingPod.measured || { width, height: minHeight },
    extent: 'parent',
    data: { 
      ...existingPod.data, 
      ...commonData, 
      parentId: deploymentId,
      baseName,
      podHash,
      replicaSuffix,
      replicaSuffixes,
      label: podName,
      replicas, 
      parentReplicas: totalReplicas 
    }
  };
};

// Helper to create a new pod node
const createPodNode = (
  commonData: any,
  params: PodNodeParams,
  parentData?: Partial<K8sNodeData>
): Node => {
  const { replicas, totalReplicas, deploymentId, podName, baseName, podHash, replicaSuffix, replicaSuffixes } = params;
  const id = `pod-${crypto.randomUUID().split('-')[0]}`;
  const minSize = getPodMinimumSize({ ...commonData, replicas }, parentData);
  return {
    id,
    type: 'Pod',
    position: { x: 0, y: 0 },
    parentId: deploymentId,
    width: minSize.width,
    height: minSize.height,
    style: { width: minSize.width, minHeight: minSize.height },
    measured: { width: minSize.width, height: minSize.height },
    extent: 'parent',
    data: {
      type: 'Pod',
      parentId: deploymentId,
      replicas,
      parentReplicas: totalReplicas,
      ...commonData,
      baseName,
      podHash,
      replicaSuffix,
      replicaSuffixes,
      label: podName,
      onDelete: () => {},
      onRename: () => {},
    }
  };
};

const resolveGroupPodHash = (
  isStatefulSet: boolean,
  data: Partial<K8sNodeData>,
  currentPods: Node[],
  forceRandomize: boolean
): string => {
  if (isStatefulSet) return '';
  if (forceRandomize) return generateRandomHash(5);
  const existingHash = (data.podHash as string) || (currentPods[0]?.data?.podHash as string);
  return existingHash || generateRandomHash(5);
};

interface ReplicaSuffixInfo {
  replicaSuffix: string;
  replicaSuffixes?: string[];
  nextOrdinal: number;
}

const resolveReplicaGroupSuffixes = (
  replicas: number,
  existingPod: Node | undefined,
  forceRandomize: boolean
): { replicaSuffix: string; replicaSuffixes: string[] } => {
  const existingList = (existingPod?.data?.replicaSuffixes as string[]) || [];
  const replicaSuffixes: string[] = [];
  for (let r = 0; r < replicas; r++) {
    if (!forceRandomize && existingList[r]) {
      replicaSuffixes.push(existingList[r]);
    } else {
      replicaSuffixes.push(generateRandomHash(5));
    }
  }
  return { replicaSuffix: replicaSuffixes[0], replicaSuffixes };
};

const resolvePodSuffixInfo = (
  isStatefulSet: boolean,
  replicas: number,
  existingPod: Node | undefined,
  currentOrdinal: number,
  forceRandomize: boolean
): ReplicaSuffixInfo => {
  if (isStatefulSet) {
    return {
      replicaSuffix: String(currentOrdinal),
      nextOrdinal: currentOrdinal + replicas,
    };
  }

  if (replicas === 1) {
    const existingSuffix = existingPod?.data?.replicaSuffix as string;
    const replicaSuffix = !forceRandomize && existingSuffix ? existingSuffix : generateRandomHash(5);
    return { replicaSuffix, nextOrdinal: currentOrdinal };
  }

  const { replicaSuffix, replicaSuffixes } = resolveReplicaGroupSuffixes(replicas, existingPod, forceRandomize);
  return {
    replicaSuffix,
    replicaSuffixes,
    nextOrdinal: currentOrdinal,
  };
};

/**
 * Synchronizes child pod nodes within a Deployment controller based on replica count thresholds
 * and agile randomization rules. Generates group pod hashes and per-replica unique suffixes.
 *
 * @param deployment - Parent Deployment canvas node.
 * @param currentPods - Array of existing child Pod canvas nodes belonging to this deployment.
 * @param dataTemplate - Optional template Pod node to copy configuration settings from.
 * @param forceRandomize - Flag indicating whether group and replica hash suffixes should be re-randomized.
 * @returns Array of synchronized child Pod canvas nodes.
 */
export const syncPodsInDeployment = (
  deployment: Node,
  currentPods: Node[],
  dataTemplate?: Node,
  forceRandomize = false
): Node[] => {
  const data = deployment.data as unknown as K8sNodeData;
  const totalReplicas = data.replicas || 0;
  const targetPodReplicas = getReplicaThresholds(totalReplicas);
  const commonData = getCommonPodData(deployment, currentPods, dataTemplate);

  const baseName = (data.label as string) || commonData.label || 'pod';
  const isStatefulSet = deployment.type === 'StatefulSet' || data.workloadType === 'StatefulSet';

  // Step 1: Generate or preserve a single 5-character group podHash for Deployment or empty for StatefulSet
  const groupPodHash = resolveGroupPodHash(isStatefulSet, data, currentPods, forceRandomize);
  data.podHash = groupPodHash;

  // Step 2: Iterate over target pod replica groups and assign unique per-pod replica suffixes or ordinal indices
  let currentOrdinal = 0;
  return targetPodReplicas.map((replicas, index) => {
    const existingPod = currentPods[index];
    const { replicaSuffix, replicaSuffixes, nextOrdinal } = resolvePodSuffixInfo(
      isStatefulSet,
      replicas,
      existingPod,
      currentOrdinal,
      forceRandomize
    );
    currentOrdinal = nextOrdinal;

    const podName = isStatefulSet
      ? `${baseName}-${replicaSuffix}`
      : formatPodName(baseName, groupPodHash, replicaSuffix, totalReplicas);

    const params: PodNodeParams = {
      replicas,
      totalReplicas,
      deploymentId: deployment.id,
      podName,
      baseName,
      podHash: groupPodHash,
      replicaSuffix,
      replicaSuffixes,
    };

    const podDataWithWorkloadType = {
      ...commonData,
      workloadType: isStatefulSet ? 'StatefulSet' : 'Deployment'
    };

    const parentData = deployment.data as unknown as K8sNodeData;
    return existingPod 
      ? updatePodNode(existingPod, podDataWithWorkloadType, params, parentData)
      : createPodNode(podDataWithWorkloadType, params, parentData);
  });
};

// Helper function to layout pods within a deployment using Yoga Flexbox Layout Engine
export const layoutPodsInDeployment = (deployment: Node, pods: Node[]): Node[] => {
  const { laidOutPods } = calculateDeploymentLayoutWithYoga(deployment, pods);
  return laidOutPods;
};


const getDomMeasuredNodeSize = (nodeId: string | undefined): { width: number; height: number } => {
  if (!nodeId || globalThis.document === undefined) {
    return { width: 0, height: 0 };
  }
  const el = globalThis.document.querySelector(`.react-flow__node[data-id="${nodeId}"]`) as HTMLElement | null;
  if (!el) return { width: 0, height: 0 };
  const child = el.firstElementChild as HTMLElement | null;
  return {
    width: Math.max(el.offsetWidth || 0, el.scrollWidth || 0, child?.offsetWidth || 0, child?.scrollWidth || 0),
    height: Math.max(el.offsetHeight || 0, el.scrollHeight || 0, child?.offsetHeight || 0, child?.scrollHeight || 0),
  };
};

const getServiceDefaultSize = (node: Node): { w: number; h: number } => {
  const isLbOrNodePort = node.data?.serviceType === 'LoadBalancer' || node.data?.serviceType === 'NodePort';
  const rawH = Math.max(node.height || 0, node.measured?.height || 0, Number(node.style?.height) || 0);
  if (rawH > 0 && rawH !== 88) {
    return { w: 180, h: rawH };
  }
  return { w: 180, h: isLbOrNodePort ? 200 : 180 };
};

export const getEffectiveSize = (node: Node) => {
  const domSize = getDomMeasuredNodeSize(node.id);
  const styleW = Number(node.style?.width) || 0;
  const styleH = Number(node.style?.height) || 0;

  if (node.type === 'Pod') {
    const minSize = getPodMinimumSize(node.data);
    return {
      width: Math.max(node.width || 0, node.measured?.width || 0, styleW, domSize.width, minSize.width),
      height: Math.max(node.height || 0, node.measured?.height || 0, styleH, domSize.height, minSize.height)
    };
  }
  const getDefaultSize = (type: string | undefined) => {
    if (type === 'Deployment' || type === 'StatefulSet') return { w: 320, h: 160 };
    if (type === 'Namespace') return { w: 600, h: 400 };
    if (type === 'Service') return getServiceDefaultSize(node);
    return { w: 160, h: 80 };
  };

  const { w: defaultW, h: defaultH } = getDefaultSize(node.type);
  return {
    width: Math.max(node.width || 0, node.measured?.width || 0, styleW, domSize.width, defaultW),
    height: Math.max(node.height || 0, node.measured?.height || 0, styleH, domSize.height, defaultH)
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
    if (parentNode?.type === 'Deployment' || parentNode?.type === 'StatefulSet' || parentNode?.type === 'ReplicaSet' || parentNode?.type === 'PodGroup') continue;

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

export const getNearestOutsideNamespacePosition = (
  lbNode: Node,
  nsNode: Node,
  nodes: Node[]
): { x: number; y: number } => {
  const nsAbs = getAbsPos(nsNode.id, nodes);
  const { width: nsW, height: nsH } = getEffectiveSize(nsNode);

  const lbAbs = getAbsPos(lbNode.id, nodes, lbNode);
  const { width: lbW, height: lbH } = getEffectiveSize(lbNode);
  const GAP = 32;

  const clampedY = Math.max(nsAbs.y, Math.min(lbAbs.y, nsAbs.y + Math.max(0, nsH - lbH)));
  const clampedX = Math.max(nsAbs.x, Math.min(lbAbs.x, nsAbs.x + Math.max(0, nsW - lbW)));

  const candidates = [
    { x: nsAbs.x - lbW - GAP, y: clampedY },
    { x: nsAbs.x + nsW + GAP, y: clampedY },
    { x: clampedX, y: nsAbs.y - lbH - GAP },
    { x: clampedX, y: nsAbs.y + nsH + GAP },
  ];

  let best = candidates[0];
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const cand of candidates) {
    const dx = cand.x - lbAbs.x;
    const dy = cand.y - lbAbs.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = cand;
    }
  }

  return { x: Math.round(best.x), y: Math.round(best.y) };
};

const findContainingOrOverlappingNamespace = (lbNode: Node, nodes: Node[]): Node | undefined => {
  const parentId = lbNode.parentId || (lbNode.data?.parentId as string | undefined);
  if (parentId) {
    const parentNs = nodes.find((n) => n.id === parentId && n.type === 'Namespace');
    if (parentNs) return parentNs;
  }

  const lbAbs = getAbsPos(lbNode.id, nodes, lbNode);
  const { width: lbW, height: lbH } = getEffectiveSize(lbNode);
  const BUFFER = 32;

  return nodes.find((n) => {
    if (n.type !== 'Namespace') return false;
    const nsAbs = getAbsPos(n.id, nodes);
    const { width: nsW, height: nsH } = getEffectiveSize(n);
    return (
      lbAbs.x < nsAbs.x + nsW + BUFFER &&
      lbAbs.x + lbW + BUFFER > nsAbs.x &&
      lbAbs.y < nsAbs.y + nsH + BUFFER &&
      lbAbs.y + lbH + BUFFER > nsAbs.y
    );
  });
};

export const ejectLoadBalancersFromNamespaces = (nodes: Node[]): { nodes: Node[]; ejectedIds: string[] } => {
  const ejectedIds: string[] = [];
  let targetNsId: string | undefined;

  const updated = nodes.map((n) => {
    if (n.type !== 'Service' || n.data?.serviceType !== 'LoadBalancer') return n;
    const nsNode = findContainingOrOverlappingNamespace(n, nodes);
    if (!nsNode) return n;

    ejectedIds.push(n.id);
    targetNsId = nsNode.id;
    const outsidePos = getNearestOutsideNamespacePosition(n, nsNode, nodes);
    const nextData = { ...n.data };
    delete nextData.parentId;

    return {
      ...n,
      parentId: undefined,
      extent: undefined,
      position: outsidePos,
      data: nextData,
    };
  });

  if (ejectedIds.length === 0) {
    return { nodes, ejectedIds };
  }

  const collisionResolved = resolveGlobalCollisions(updated, targetNsId);
  const finalNodes = collisionResolved.map((n) => {
    if (n.type !== 'Service' || n.data?.serviceType !== 'LoadBalancer') return n;
    const overlappingNs = findContainingOrOverlappingNamespace(n, collisionResolved);
    if (!overlappingNs) return n;
    return {
      ...n,
      position: getNearestOutsideNamespacePosition(n, overlappingNs, collisionResolved),
    };
  });

  return {
    nodes: finalNodes,
    ejectedIds,
  };
};
