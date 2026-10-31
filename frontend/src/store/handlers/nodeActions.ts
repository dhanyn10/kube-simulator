import { type MouseEvent } from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '@/types';
import type { FlowState } from '@/store/types';
import {
  getNodeData,
  sortNodes,
  getAbsPos,
  resolveGlobalCollisions,
  ejectLoadBalancersFromNamespaces
} from '@/store/helpers';
import { syncDeployment, syncContainerSize } from '@/store/nodeHelpers';
import { calculateCardLayoutWithYoga } from '@/store/deploymentYogaLayout';
import {
  getInitialData,
  sanitizeResourceLimits,
  applyAutoImageLogic,
  createNodeHandlers,
  syncWorkloadMetadata,
  ensureUniqueResourceName
} from './nodeUtils';
import { evaluatePvcRealtimeStatus } from '@/activities/config/pvcConfigHelpers';
import { alignAllNodesToGrid as alignAllNodesToGridHelper } from '@/activities/layout/canvasAlignmentHelpers';
import { formatPodName } from '@/lib/utils';
import {
  emitLiveScaleCommand,
  emitLiveSetImageCommand,
  emitLiveSetResourcesCommand,
  emitLiveNodeCreatedCommand,
  emitLiveNodeDeletedCommand,
} from '@/activities/terminal/liveUpdateCommands';
import { isNodeAccessForbidden } from '@/activities/nodes/rbacNodeHelpers';

const WORKLOAD_CONTROLLERS = new Set(['Deployment', 'StatefulSet', 'ReplicaSet']);

// -- SPECIFIC NODE HANDLERS (To reduce complexity) --

/**
 * Transforms a standalone pod into a ReplicaSet controller group when scaling replicas > 1.
 *
 * @param nodeId Target pod node ID
 * @param updatedNode Updated pod node object
 * @param updatedData Updated node data payload
 * @param nodes Array of canvas nodes
 * @param get Store state getter
 * @returns Updated array of canvas nodes containing the new ReplicaSet group
 */
const handleReplicaSetTransform = (nodeId: string, updatedNode: Node, updatedData: K8sNodeData, nodes: Node[], get: () => FlowState) => {
  const podPos = getAbsPos(nodeId, nodes);
  const groupId = `replicaset-${crypto.randomUUID().split('-')[0]}`;
  const newGroup: Node = {
    id: groupId, type: 'ReplicaSet', position: { x: podPos.x - 20, y: podPos.y - 40 },
    data: { ...updatedData, label: updatedData.label, ...createNodeHandlers(groupId, get) }
  };
  const tempPod = {
    ...updatedNode,
    parentId: groupId,
    position: { x: 20, y: 40 },
    data: {
      ...updatedNode.data,
      roles: undefined,
      configMaps: undefined,
      secrets: undefined,
      hpas: undefined,
      resourceLimits: undefined,
    }
  };
  const { updatedDeployment, laidOut } = syncDeployment(newGroup, [tempPod], 0, get, tempPod);
  return sortNodes([...nodes.filter(n => n.id !== nodeId), updatedDeployment, ...laidOut]);
};

/**
 * Synchronizes a child pod with its parent controller (Deployment or ReplicaSet).
 *
 * @param target Target node
 * @param updatedNode Updated pod node object
 * @param newData Changed node data patch
 * @param nodes Array of canvas nodes
 * @param get Store state getter
 * @returns Reconciled array of canvas nodes
 */
const extractParentAttachedResources = (parentData: K8sNodeData): Partial<K8sNodeData> => {
  return {
    ...(parentData.roles ? { roles: parentData.roles } : {}),
    ...(parentData.configMaps ? { configMaps: parentData.configMaps } : {}),
    ...(parentData.secrets ? { secrets: parentData.secrets } : {}),
    ...(parentData.hpas ? { hpas: parentData.hpas } : {}),
    ...(parentData.resourceLimits ? { resourceLimits: parentData.resourceLimits } : {}),
  };
};

const buildAttachedPatch = (newData: Partial<K8sNodeData>, value: any): Partial<K8sNodeData> => {
  return {
    ...(newData.roles !== undefined ? { roles: value } : {}),
    ...(newData.configMaps !== undefined ? { configMaps: value } : {}),
    ...(newData.secrets !== undefined ? { secrets: value } : {}),
    ...(newData.hpas !== undefined ? { hpas: value } : {}),
    ...(newData.resourceLimits !== undefined ? { resourceLimits: value } : {}),
  };
};

const handlePodParentSync = (_target: Node, updatedNode: Node, newData: Partial<K8sNodeData>, nodes: Node[], get: () => FlowState) => {
  const parent = nodes.find(n => n.id === updatedNode.parentId);
  if (!parent) return nodes;

  const effectiveReplicas = newData.replicas ?? Number(parent.data?.replicas || 0);

  if (parent.type === 'ReplicaSet' && effectiveReplicas <= 1) {
    const groupPos = getAbsPos(parent.id, nodes);
    const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
    const baseName = updatedNode.data?.baseName || updatedNode.data?.label || 'pod';
    const cleanBase = formatPodName(baseName, updatedNode.data?.podHash, updatedNode.data?.replicaSuffix, 1);
    const updatedPodWithCleanLabel = {
      ...updatedNode,
      parentId: undefined,
      position: groupPos,
      extent: undefined,
      data: {
        ...updatedNode.data,
        label: cleanBase,
        replicas: 1,
        parentReplicas: 1,
        ...extractParentAttachedResources(parent.data as K8sNodeData),
      }
    };
    return sortNodes([...others, updatedPodWithCleanLabel]);
  }

  const parentReplicas = Number(parent.data?.replicas || 0);
  const isController = Boolean(parent && WORKLOAD_CONTROLLERS.has(parent.type));
  const replicasChange = (isController && newData.replicas !== undefined)
    ? (newData.replicas || 0) - parentReplicas : 0;

  const { updatedDeployment, laidOut } = syncDeployment(parent, nodes, replicasChange, get, updatedNode);
  const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
  const resultNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
  return syncContainerSize(parent.parentId, resultNodes);
};

/**
 * Synchronizes child pods and layout dimensions when updating a controller node.
 *
 * @param updatedNode Container node being updated
 * @param nodes Array of canvas nodes
 * @param get Store state getter
 * @returns Reconciled array of canvas nodes
 */
const handleContainerSync = (updatedNode: Node, nodes: Node[], get: () => FlowState) => {
  const { updatedDeployment, laidOut } = syncDeployment(updatedNode, nodes, 0, get);
  const others = nodes.filter(n => n.id !== updatedNode.id && n.parentId !== updatedNode.id);
  const resultNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
  return syncContainerSize(updatedNode.parentId, resultNodes);
};

/**
 * Synchronizes attached items (roles, configMaps, secrets, hpas, resourceLimits) across all matching Pod cards sharing the same group / parent deployment / baseName.
 *
 * @param updatedNode Target pod node being updated
 * @param updatedData Merged node data payload
 * @param newData Patch data containing changed fields
 * @param nodes Current array of canvas nodes
 * @returns Array of canvas nodes with synchronized attached items on sibling pods
 */
const syncPodAttachedItemsGroup = (updatedNode: Node, updatedData: K8sNodeData, newData: Partial<K8sNodeData>, nodes: Node[]): Node[] => {
  const hasAttachedChanges =
    newData.roles !== undefined ||
    newData.configMaps !== undefined ||
    newData.secrets !== undefined ||
    newData.hpas !== undefined ||
    newData.resourceLimits !== undefined;

  if (!hasAttachedChanges) return nodes;

  const parentId = updatedNode.parentId;
  const parent = parentId ? nodes.find(n => n.id === parentId) : null;
  const isInsideController = Boolean(parent && WORKLOAD_CONTROLLERS.has(parent.type));

  if (updatedNode.type === 'Pod' && isInsideController) {
    return nodes.map((n) => {
      const nData = n.data as K8sNodeData;
      if (n.id === parentId) {
        return { ...n, data: { ...nData, ...buildAttachedPatch(newData, newData.roles ?? newData.configMaps ?? newData.secrets ?? newData.hpas ?? newData.resourceLimits) } };
      }
      if (n.parentId === parentId || n.id === updatedNode.id) {
        return { ...n, data: { ...nData, ...buildAttachedPatch(newData, undefined) } };
      }
      return n;
    });
  }

  const targetBaseName = updatedData.baseName || updatedData.label;
  const targetPodHash = updatedData.podHash;

  return nodes.map((n) => {
    if (n.id === updatedNode.id) return n;
    const nData = n.data as K8sNodeData;
    const isSameParent = Boolean(updatedNode?.parentId && n.parentId === updatedNode.parentId);
    const isTargetParent = Boolean(updatedNode?.parentId && n.id === updatedNode.parentId);
    const isSameGroup = Boolean(targetPodHash && nData?.podHash === targetPodHash && (nData?.baseName || nData?.label) === targetBaseName);

    if ((n.type === 'Pod' && (isSameParent || isSameGroup)) || isTargetParent) {
      return { ...n, data: { ...nData, ...buildAttachedPatch(newData, newData.roles ?? newData.configMaps ?? newData.secrets ?? newData.hpas ?? newData.resourceLimits) } };
    }
    return n;
  });
};

/**
 * Dispatches node-specific synchronization logic after a node data update.
 *
 * @param nodeId Target node ID
 * @param updatedNode Updated node object
 * @param updatedData Merged updated node data payload
 * @param target Original node object before update
 * @param newData Updated fields patch
 * @param nodes Array of canvas nodes
 * @param get Store state getter
 * @returns Reconciled array of canvas nodes
 */
const syncUpdatedNode = (nodeId: string, updatedNode: Node, updatedData: K8sNodeData, target: Node, newData: Partial<K8sNodeData>, nodes: Node[], get: () => FlowState) => {
  let nextNodes = nodes.map((n: Node) => n.id === nodeId ? updatedNode : n);
  if (updatedNode.type === 'Pod') {
    nextNodes = syncPodAttachedItemsGroup(updatedNode, updatedData, newData, nextNodes);
    const parent = nextNodes.find(n => n.id === updatedNode.parentId);
    const isStandaloneContext = !updatedNode.parentId || parent?.type === 'Namespace';

    if (isStandaloneContext && (updatedData.replicas || 0) > 1) {
      return handleReplicaSetTransform(nodeId, updatedNode, updatedData, nextNodes, get);
    }
    if (updatedNode.parentId) {
      const parent = nextNodes.find(n => n.id === updatedNode.parentId);
      if (parent && WORKLOAD_CONTROLLERS.has(parent.type)) {
        return handlePodParentSync(target, updatedNode, newData, nextNodes, get);
      }
    }
  }
  if (WORKLOAD_CONTROLLERS.has(updatedNode.type)) {
    nextNodes = syncPodAttachedItemsGroup(updatedNode, updatedData, newData, nextNodes);
    return handleContainerSync(updatedNode, nextNodes, get);
  }
  return nextNodes;
};

/**
 * Cleans up child pods and updates parent controller layouts during node deletion.
 *
 * @param node Node being deleted
 * @param currentNodes Array of canvas nodes
 * @param get Store state getter
 * @returns Reconciled array of canvas nodes
 */
const processNodeDeletion = (node: Node, currentNodes: Node[], get: () => FlowState) => {
  let nextNodes = currentNodes;
  if (node.type === 'Deployment' || node.type === 'StatefulSet') nextNodes = nextNodes.filter(n => n.parentId !== node.id);
  if (node?.type === 'Pod' && node?.parentId) {
    const parent = nextNodes.find(n => n.id === node.parentId);
    if (parent && WORKLOAD_CONTROLLERS.has(parent.type)) {
      const nodeData = getNodeData(node);
      const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -(nodeData.replicas || 1), get);
      const others = nextNodes.filter(n => n.parentId !== parent.id || n.type !== 'Pod');
      nextNodes = [...others.map(n => n.id === parent.id ? updatedDeployment : n), ...laidOut];
    }
  }
  return nextNodes;
};

const getIngressTargetServices = (
  targetNode: Node,
  newData: Partial<K8sNodeData>
): Set<string> => {
  const effectivePaths = newData.ingressPaths ?? (targetNode.data?.ingressPaths as any[] | undefined);
  if (Array.isArray(effectivePaths) && effectivePaths.length > 1) {
    const names = effectivePaths
      .map((p) => String(p?.serviceName || '').trim())
      .filter(Boolean);
    return new Set(names);
  }
  const effectiveBackend = newData.backendServiceName ?? (targetNode.data?.backendServiceName as string | undefined);
  return effectiveBackend ? new Set([effectiveBackend]) : new Set();
};

const syncIngressEdgesFromFormSelection = (
  targetNode: Node,
  newData: Partial<K8sNodeData>,
  nodes: Node[],
  edges: Edge[]
): Edge[] => {
  const targetServices = getIngressTargetServices(targetNode, newData);

  let nextEdges = edges.filter((e) => {
    if (e.source !== targetNode.id) return true;
    const target = nodes.find((n) => n.id === e.target);
    if (!target || target?.type !== 'Service') return true;
    const svcLabel = (target.data?.label as string) || target.id;
    return targetServices.has(svcLabel);
  });

  if (targetServices.size > 0) {
    const matchingServices = nodes.filter(
      (n) => n?.type === 'Service' && targetServices.has((n.data?.label as string) || n.id)
    );

    matchingServices.forEach((s) => {
      const edgeExists = nextEdges.some((e) => e.source === targetNode.id && e.target === s.id);
      if (!edgeExists) {
        nextEdges.push({
          id: `e-${targetNode.id}-${s.id}-${Date.now()}`,
          source: targetNode.id,
          target: s.id,
          type: 'custom',
          sourceHandle: 'right-s',
          targetHandle: 'left-t',
        });
      }
    });
  }

  return nextEdges;
};

const getServiceTargetLabels = (
  targetNode: Node,
  newData: Partial<K8sNodeData>,
  effectiveServiceType: string
): Set<string> => {
  const effectiveIngressTargets =
    newData.ingressTargets ?? (targetNode.data?.ingressTargets as string[] | undefined);

  if (effectiveServiceType === 'LoadBalancer' && Array.isArray(effectiveIngressTargets) && effectiveIngressTargets.length > 0) {
    return new Set(effectiveIngressTargets.map((item) => String(item).trim()).filter(Boolean));
  }

  const effectiveSelector = newData.selector ?? targetNode.data?.selector;
  return effectiveSelector ? new Set([String(effectiveSelector)]) : new Set();
};

const syncServiceEdgesFromFormSelection = (
  targetNode: Node,
  newData: Partial<K8sNodeData>,
  nodes: Node[],
  edges: Edge[]
): Edge[] => {
  const effectiveServiceType = String(newData.serviceType ?? targetNode.data?.serviceType ?? 'ClusterIP');
  const desiredTargets = getServiceTargetLabels(targetNode, newData, effectiveServiceType);

  const nextEdges = edges.filter((e) => {
    if (e.source !== targetNode.id) return true;
    const target = nodes.find((n) => n.id === e.target);
    if (!target || !['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Ingress'].includes(target.type || '')) return true;
    if (target.type === 'Ingress' && effectiveServiceType !== 'LoadBalancer') return false;
    if (desiredTargets.size === 0) return false;
    const tLabel = (target.data?.label as string) || (target.data?.baseName as string) || target.id;
    return desiredTargets.has(tLabel);
  });

  if (desiredTargets.size > 0) {
    const matchingTargets = nodes.filter((n) => {
      if (n?.type === 'Ingress' && effectiveServiceType !== 'LoadBalancer') return false;
      if (!['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Ingress'].includes(n?.type || '')) return false;
      if (n?.type === 'Pod' && (n?.parentId || n?.data?.parentId)) return false;
      const tLabel = (n.data?.label as string) || (n.data?.baseName as string) || n.id;
      return desiredTargets.has(tLabel);
    });

    matchingTargets.forEach((w) => {
      const edgeExists = nextEdges.some((e) => e.source === targetNode.id && e.target === w.id);
      if (!edgeExists) {
        nextEdges.push({
          id: `e-${targetNode.id}-${w.id}-${Date.now()}`,
          source: targetNode.id,
          target: w.id,
          type: 'custom',
          sourceHandle: 'right-s',
          targetHandle: 'left-t',
        });
      }
    });
  }

  return nextEdges;
};

/**
 * Synchronizes visual canvas edges when a target resource is selected in node Form Settings.
 *
 * @param targetNode Node being updated
 * @param newData Changed properties patch
 * @param nodes Current canvas nodes
 * @param edges Current canvas edges
 * @returns Updated array of canvas edges
 */
const syncEdgesFromFormSelection = (
  targetNode: Node,
  newData: Partial<K8sNodeData>,
  nodes: Node[],
  edges: Edge[]
): Edge[] => {
  let nextEdges = [...edges];

  // Service form selector update
  if (targetNode.type === 'Service') {
    nextEdges = syncServiceEdgesFromFormSelection(targetNode, newData, nodes, nextEdges);
  }

  // Ingress form backendServiceName or ingressPaths update
  if (
    targetNode?.type === 'Ingress' &&
    (newData?.backendServiceName !== undefined || newData?.ingressPaths !== undefined)
  ) {
    nextEdges = syncIngressEdgesFromFormSelection(targetNode, newData, nodes, nextEdges);
  }

  return nextEdges;
};

const invalidateIngressReference = (n: Node, oldLabel: string): Node => {
  const matchesBackend = n.data?.backendServiceName === oldLabel;
  const rawPaths = n.data?.ingressPaths as any[] | undefined;
  const matchesPaths = Array.isArray(rawPaths) && rawPaths.some((p) => p?.serviceName === oldLabel);

  if (!matchesBackend && !matchesPaths) return n;

  const updatedPaths = Array.isArray(rawPaths)
    ? rawPaths.map((p) => (p?.serviceName === oldLabel ? { ...p, serviceName: '' } : p))
    : rawPaths;

  return {
    ...n,
    data: {
      ...n.data,
      ...(matchesBackend ? { backendServiceName: '' } : {}),
      ...(matchesPaths ? { ingressPaths: updatedPaths } : {}),
    },
  };
};

const invalidateServiceReference = (n: Node, oldLabel: string): Node => {
  const rawIngressTargets = n.data?.ingressTargets as string[] | undefined;
  const hasIngressMatch = Array.isArray(rawIngressTargets) && rawIngressTargets.includes(oldLabel);
  const hasSelectorMatch = n.data?.selector === oldLabel;

  if (!hasIngressMatch && !hasSelectorMatch) return n;

  const remainingIngressTargets = Array.isArray(rawIngressTargets)
    ? rawIngressTargets.filter((item) => item !== oldLabel)
    : undefined;

  return {
    ...n,
    data: {
      ...n.data,
      selector: remainingIngressTargets && remainingIngressTargets.length > 0 ? remainingIngressTargets[0] : '',
      ...(hasIngressMatch
        ? { ingressTargets: remainingIngressTargets && remainingIngressTargets.length > 0 ? remainingIngressTargets : undefined }
        : {}),
    },
  };
};

/**
 * Invalidates Service selectors and Ingress backend service references pointing to a deleted or renamed resource label.
 *
 * @param oldLabel Deleted or previous resource label
 * @param nodes Array of canvas nodes
 * @returns Reconciled array of canvas nodes with invalidated references
 */
const invalidateTargetReferences = (oldLabel: string | undefined, nodes: Node[]): Node[] => {
  if (!oldLabel) return nodes;

  return nodes.map((n) => {
    if (n?.type === 'Service') {
      return invalidateServiceReference(n, oldLabel);
    }
    if (n?.type === 'Ingress') {
      return invalidateIngressReference(n, oldLabel);
    }
    return n;
  });
};

/**
 * Synchronizes parent controller layout when adding a new pod inside a container.
 *
 * @param newNode Newly created node
 * @param nodes Array of canvas nodes
 * @param get Store state getter
 * @returns Sorted array of canvas nodes
 */
const handleAdditionSync = (newNode: Node, nodes: Node[], get: () => FlowState) => {
  if (newNode?.parentId && newNode?.type === 'Pod') {
    const parent = nodes.find(n => n.id === newNode.parentId);
    if (parent?.type === 'Deployment' || parent?.type === 'StatefulSet' || parent?.type === 'ReplicaSet') {
      const { updatedDeployment, laidOut } = syncDeployment(parent, nodes, 1, get, newNode);
      const others = nodes.filter(n => (n.parentId !== newNode.parentId || n.type !== 'Pod') && n.id !== newNode.id);
      return sortNodes([...others.map(n => n.id === newNode.parentId ? updatedDeployment : n), ...laidOut]);
    }
  }
  return sortNodes(nodes);
};

/**
 * Calculates initial card size based on resource node type.
 */
const getInitialCardSize = (type: K8sResourceType, initialData: K8sNodeData): { width: number; height: number } => {
  if (type === 'Namespace') {
    return { width: 600, height: 400 };
  }
  if (type === 'Deployment' || type === 'StatefulSet' || type === 'ReplicaSet') {
    return { width: 320, height: 160 };
  }
  return calculateCardLayoutWithYoga({ type, data: initialData });
};

/**
 * Computes updated dimension properties for a node after data change.
 */
const computeNodeDimensions = (
  target: Node,
  updatedData: K8sNodeData
): Partial<Node> => {
  const isContainerOrNamespace = target.type === 'Namespace' || target.type === 'Deployment' || target.type === 'StatefulSet' || target.type === 'ReplicaSet';

  if (!isContainerOrNamespace) {
    const cardLayout = calculateCardLayoutWithYoga({
      type: target.type,
      width: target.width,
      height: target.height,
      data: updatedData,
    });
    return {
      width: cardLayout.width,
      height: cardLayout.height,
      style: { ...target.style, width: cardLayout.width, height: cardLayout.height },
    };
  }

  return {};
};

// -- ACTION IMPLEMENTATIONS --

const parseTransformValue = (transform: string, prefix: string): string | null => {
  const startIdx = transform.indexOf(prefix);
  if (startIdx === -1) return null;
  const valueStart = startIdx + prefix.length;
  const endIdx = transform.indexOf(')', valueStart);
  if (endIdx === -1) return null;
  return transform.slice(valueStart, endIdx);
};

const parseViewportTransform = (transform: string): { x: number; y: number; zoom: number } => {
  let x = 0;
  let y = 0;
  let zoom = 1;

  const translateRaw =
    parseTransformValue(transform, 'translate3d(') ??
    parseTransformValue(transform, 'translate(');
  if (translateRaw) {
    const parts = translateRaw.split(',');
    x = Number.parseFloat(parts[0]) || 0;
    y = Number.parseFloat(parts[1]) || 0;
  }

  const scaleRaw = parseTransformValue(transform, 'scale(');
  if (scaleRaw) {
    zoom = Number.parseFloat(scaleRaw) || 1;
  }

  return { x, y, zoom };
};

const getCanvasCenterPosition = (cardSize: { width: number; height: number }): { x: number; y: number } => {
  const container =
    globalThis.document?.getElementById('canvas-main') ||
    globalThis.document?.querySelector('.react-flow__renderer') ||
    globalThis.document?.querySelector('.react-flow');

  const rect = container?.getBoundingClientRect();
  const containerWidth = rect && rect.width > 0 ? rect.width : (globalThis.innerWidth || 800);
  const containerHeight = rect && rect.height > 0 ? rect.height : (globalThis.innerHeight || 600);

  const viewportEl = globalThis.document?.querySelector('.react-flow__viewport') as HTMLElement | null;
  const { x: viewportX, y: viewportY, zoom } = parseViewportTransform(viewportEl?.style?.transform || viewportEl?.getAttribute?.('style') || '');

  const centerX = (containerWidth / 2 - viewportX) / zoom;
  const centerY = (containerHeight / 2 - viewportY) / zoom;

  return {
    x: Math.round(centerX - cardSize.width / 2),
    y: Math.round(centerY - cardSize.height / 2),
  };
};

const getNextTopZIndex = (nodes: Node[]): number => {
  let maxZ = 0;
  for (const n of nodes) {
    const z = n.zIndex ?? (Number(n.style?.zIndex) || 0);
    if (z > maxZ) maxZ = z;
  }
  return maxZ + 1;
};

const buildNodesAfterAddition = (
  newNode: Node,
  currentNodes: Node[],
  position: { x: number; y: number } | undefined,
  get: () => FlowState
): Node[] => {
  if (!position) {
    const deselectedNodes = currentNodes.map((n) => (n.selected ? { ...n, selected: false } : n));
    return [...deselectedNodes, newNode];
  }
  const syncedNodes = handleAdditionSync(newNode, [...currentNodes, newNode], get);
  return resolveGlobalCollisions(syncedNodes, newNode.id);
};

/**
 * Adds a new Kubernetes resource node to the canvas at target coordinates or initial random position.
 */
const addNodeImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => {
  let targetParentId = parentId;
  const currentNodes = get().nodes;

  if (type === 'Role' && !targetParentId) {
    const nsNode = currentNodes.find((n) => n.type === 'Namespace');
    if (nsNode) {
      targetParentId = nsNode.id;
    } else {
      get().addLog('warn', '[Canvas Action] Cannot add Role without a Namespace! Please create or drag Role into a Namespace card.', 'UI');
      return;
    }
  }

  const id = `${type.toLowerCase()}-${crypto.randomUUID().split('-')[0]}`;
  const initialData = getInitialData(type, id, get);
  const uniqueLabel = ensureUniqueResourceName(initialData.label, type, targetParentId, currentNodes);
  initialData.label = uniqueLabel;
  if (type === 'Pod' || WORKLOAD_CONTROLLERS.has(type)) {
    initialData.baseName = uniqueLabel;
  }

  const cardSize = getInitialCardSize(type, initialData);
  const finalPos = position || getCanvasCenterPosition(cardSize);
  const topZIndex = position ? undefined : getNextTopZIndex(currentNodes);

  const newNode: Node = {
    id, type, position: finalPos, parentId: targetParentId,
    extent: targetParentId ? 'parent' : undefined,
    data: initialData,
    width: cardSize.width,
    height: cardSize.height,
    zIndex: topZIndex,
    style: { width: cardSize.width, height: cardSize.height }
  };

  const collisionResolvedNodes = buildNodesAfterAddition(newNode, currentNodes, position, get);

  const x1 = Math.round(finalPos.x);
  const y1 = Math.round(finalPos.y);
  const w = Math.round(newNode.width || 150);
  const h = Math.round(newNode.height || 100);
  const x2 = x1 + w;
  const y2 = y1 + h;
  const logMsg = `[Canvas Action] Placed card '${type}' (${id}) at coordinates (x1:${x1}, y1:${y1}, x2:${x2}, y2:${y2}), size: ${w}x${h}px [Top-Left: (${x1}, ${y1}), Bottom-Right: (${x2}, ${y2})]`;
  get().addLog('info', logMsg, 'UI');

  set({ nodes: collisionResolvedNodes, lastActionId: `add-${Date.now()}`, lastActionName: `Add ${type}` });

  // Auto-emit kubectl live command for newly created node
  emitLiveNodeCreatedCommand(type, (newNode.data?.label as string) || id);
};

/**
 * Removes specified nodes and their associated edge connections from the store.
 */
const deleteNodesImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (nodesToDelete: Node[]) => {
  const { nodes, edges } = get();
  const deleteIds = new Set(nodesToDelete.map(n => n.id));

  nodesToDelete.forEach(n => {
    const pos = getAbsPos(n.id, nodes);
    const x1 = Math.round(pos.x);
    const y1 = Math.round(pos.y);
    const w = Math.round(n.width || n.measured?.width || 150);
    const h = Math.round(n.height || n.measured?.height || 100);
    const x2 = x1 + w;
    const y2 = y1 + h;
    const label = n.data?.label || n.id;
    const logMsg = `[Canvas Action] Deleted card '${label}' (${n.type}) from coordinates (x1:${x1}, y1:${y1}, x2:${x2}, y2:${y2}), size: ${w}x${h}px`;
    get().addLog('info', logMsg, 'UI');

    // Auto-emit kubectl live delete command
    emitLiveNodeDeletedCommand(n.type || 'Node', label);
  });

  let nextNodes = nodes.filter((n: Node) => !deleteIds.has(n.id));
  nodesToDelete.forEach(node => {
    nextNodes = processNodeDeletion(node, nextNodes, get);
    if (['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Service', 'Ingress'].includes(node.type || '')) {
      const oldLabel = (node.data?.label as string) || (node.data?.baseName as string) || node.id;
      nextNodes = invalidateTargetReferences(oldLabel, nextNodes);
    }
  });

  set({
    nodes: nextNodes,
    edges: edges.filter((e: Edge) => !deleteIds.has(e.source) && !deleteIds.has(e.target)),
    lastActionId: `delete-${Date.now()}`, lastActionName: 'Delete Elements'
  });
};

const sanitizeAndUpdateServiceSelector = (
  target: Node,
  newData: Partial<K8sNodeData>,
  updatedData: K8sNodeData,
  nodes: Node[]
): K8sNodeData => {
  if (target?.type === 'Service' && newData?.serviceType && newData?.serviceType !== 'LoadBalancer') {
    const hasIngressTargets = Array.isArray(updatedData.ingressTargets) && updatedData.ingressTargets.length > 0;
    const currentSelector = updatedData.selector;
    const isIngressTarget = Boolean(
      currentSelector &&
      nodes.some((n) => n?.type === 'Ingress' && (n?.data?.label === currentSelector || n?.id === currentSelector))
    );
    if (hasIngressTargets || isIngressTarget) {
      return {
        ...updatedData,
        selector: '',
        ...(hasIngressTargets ? { ingressTargets: undefined } : {}),
      };
    }
  }
  return updatedData;
};

const syncPvcRealtimeStatuses = (nodes: Node[], edges: Edge[]): Node[] => {
  return nodes.map((n) => {
    if (n.type !== 'PVC') return n;
    const realTimeStatus = evaluatePvcRealtimeStatus(n, nodes, edges);
    if (n.data?.pvcStatus !== realTimeStatus) {
      return { ...n, data: { ...n.data, pvcStatus: realTimeStatus } };
    }
    return n;
  });
};

const collectWorkloadPortSyncTargets = (
  target: Node,
  updatedData: K8sNodeData,
  nodes: Node[]
): { targetLabels: Set<string>; targetIds: Set<string> } => {
  const targetLabels = new Set<string>([String(updatedData.label || updatedData.baseName || target.id)]);
  const targetIds = new Set<string>([target.id]);

  if (target.parentId) {
    const parentNode = nodes.find((n) => n.id === target.parentId);
    if (parentNode && WORKLOAD_CONTROLLERS.has(parentNode.type)) {
      targetLabels.add(String(parentNode.data?.label || parentNode.data?.baseName || parentNode.id));
      targetIds.add(parentNode.id);
    }
  }
  return { targetLabels, targetIds };
};

const propagateWorkloadPortToServices = (
  target: Node,
  newData: Partial<K8sNodeData>,
  updatedData: K8sNodeData,
  nodes: Node[],
  edges: Edge[]
): Node[] => {
  if (newData.port === undefined || !['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet'].includes(target.type || '')) {
    return nodes;
  }

  const nextPort = Number(newData.port) || 80;
  const { targetLabels, targetIds } = collectWorkloadPortSyncTargets(target, updatedData, nodes);

  return nodes.map((n) => {
    if (n.type !== 'Service') return n;
    const selectorMatches = targetLabels.has(String(n.data?.selector || ''));
    const edgeMatches = edges.some((e) => e.source === n.id && targetIds.has(e.target));
    if (!selectorMatches && !edgeMatches) return n;
    return {
      ...n,
      data: {
        ...n.data,
        targetPort: nextPort,
      },
    };
  });
};

const applyUniqueLabelSanitization = (
  target: Node,
  targetData: K8sNodeData,
  newData: Partial<K8sNodeData>,
  sanitizedData: Partial<K8sNodeData>,
  nodes: Node[]
): Partial<K8sNodeData> => {
  if (newData.label === undefined && newData.baseName === undefined) {
    return sanitizedData;
  }
  const rawNewName = newData.label || newData.baseName || targetData.label || targetData.baseName;
  const uniqueName = ensureUniqueResourceName(
    rawNewName,
    target.type || '',
    target.parentId,
    nodes,
    target.id
  );
  const next = { ...sanitizedData, label: uniqueName };
  if (target.type === 'Pod' || target.type === 'Deployment' || target.type === 'ReplicaSet') {
    next.baseName = uniqueName;
  }
  return next;
};

const emitLiveUpdateLogs = (
  target: Node,
  targetData: K8sNodeData,
  newData: Partial<K8sNodeData>,
  prevReplicas: any,
  prevImage: any
) => {
  const nodeLabel = (targetData.label as string) || target.id;
  const nodeType = target.type || 'Deployment';

  if (newData.replicas !== undefined && newData.replicas !== prevReplicas) {
    emitLiveScaleCommand(nodeLabel, nodeType, newData.replicas, prevReplicas);
  }
  if (newData.image !== undefined && newData.image !== prevImage) {
    emitLiveSetImageCommand(nodeLabel, nodeType, newData.image, prevImage);
  }
  if (
    (newData.cpuLimit !== undefined && newData.cpuLimit !== targetData.cpuLimit) ||
    (newData.memoryLimit !== undefined && newData.memoryLimit !== targetData.memoryLimit)
  ) {
    emitLiveSetResourcesCommand(
      nodeLabel,
      nodeType,
      newData.cpuLimit ?? targetData.cpuLimit,
      newData.memoryLimit ?? targetData.memoryLimit
    );
  }
};

/**
 * Updates data properties for a specific canvas node and emits live terminal command logs.
 */
const updateNodeDataImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (nodeId: string, newData: Partial<K8sNodeData>) => {
  const { nodes } = get();
  const target = nodes.find((n: Node) => n.id === nodeId);
  if (!target) return;

  const targetData = target.data as K8sNodeData;

  const hasChanges = Object.entries(newData).some(([key, value]) => (targetData as any)[key] !== value);
  if (!hasChanges) return;

  const prevReplicas = targetData.replicas;
  const prevImage = targetData.image;
  const prevLabel = (targetData.label as string) || (targetData.baseName as string);

  let sanitizedData = sanitizeResourceLimits(newData);
  sanitizedData = applyAutoImageLogic(targetData, sanitizedData);
  if (newData.image) {
    sanitizedData.isAutoImage = false;
  }
  sanitizedData = applyUniqueLabelSanitization(target, targetData, newData, sanitizedData, nodes);

  let updatedData: K8sNodeData = { ...targetData, ...sanitizedData };
  updatedData = sanitizeAndUpdateServiceSelector(target, newData, updatedData, nodes);
  updatedData = { ...updatedData, ...syncWorkloadMetadata(target.type || '', updatedData) } as K8sNodeData;

  const dimProps = computeNodeDimensions(target, updatedData);

  const updatedType = (newData.workloadType && (target.type === 'Deployment' || target.type === 'StatefulSet'))
    ? (newData.workloadType as K8sResourceType)
    : target.type;

  const updatedNode: Node = {
    ...target,
    type: updatedType,
    data: updatedData,
    ...dimProps
  };

  let nextNodes = syncUpdatedNode(nodeId, updatedNode, updatedData, target, newData, nodes, get);
  nextNodes = ejectLoadBalancersFromNamespaces(nextNodes).nodes;

  const newLabel = (updatedData.label as string) || (updatedData.baseName as string);
  if (
    ['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Service', 'Ingress'].includes(target.type || '') &&
    newData.label !== undefined &&
    prevLabel &&
    newLabel !== prevLabel
  ) {
    nextNodes = invalidateTargetReferences(prevLabel, nextNodes);
  }

  nextNodes = propagateWorkloadPortToServices(target, newData, updatedData, nextNodes, get().edges);
  nextNodes = syncPvcRealtimeStatuses(nextNodes, get().edges);

  const currentTargetNode = nextNodes.find((n) => n.id === nodeId) || updatedNode;
  const nextEdges = syncEdgesFromFormSelection(currentTargetNode, newData, nextNodes, get().edges);

  const collisionResolvedNodes = resolveGlobalCollisions(nextNodes, nodeId);
  set({
    nodes: collisionResolvedNodes,
    edges: nextEdges,
    lastActionId: `update-${Date.now()}`,
    lastActionName: 'Update Node Data'
  });

  emitLiveUpdateLogs(target, targetData, newData, prevReplicas, prevImage);
};

// -- MAIN EXPORT --

/**
 * Higher-order store slice factory providing node CRUD, selection, grouping, and click actions.
 *
 * @param set Zustand state setter
 * @param get Zustand state getter
 * @returns Object containing all node slice actions
 */
export const nodeActions = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => ({
  addNode: addNodeImpl(set, get),
  deleteNodes: deleteNodesImpl(set, get),
  updateNodeData: updateNodeDataImpl(set, get),
  onNodeClick: (_event: MouseEvent, node: Node) => {
    const store = get();
    const isForbidden = isNodeAccessForbidden(store.activeIdentity, store.iamUsers || [], node.type, node.data, store.nodes);
    if (isForbidden) {
      store.addLog(
        'warn',
        `[API Server Auth] Access forbidden for user "${store.activeIdentity}" on card "${(node.data?.label as string) || node.id}" (${node.type})`,
        'UI'
      );
      return;
    }
    set({
      activeDeploymentId: (node.type === 'Deployment' || node.type === 'StatefulSet') ? node.id : null,
      configuringNodeId: node.id,
      configuringEdgeId: null
    });
  },
  onPaneClick: () => set({ activeDeploymentId: null, configuringNodeId: null, configuringEdgeId: null }),
  groupNodes: (ids: string[]) => set({
    nodes: get().nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: `group-${crypto.randomUUID().split('-')[0]}` } } : n),
    lastActionId: `group-${Date.now()}`, lastActionName: 'Group Elements'
  }),
  alignAllNodesToGrid: (gridGap: number = 24) => {
    const store = get();
    const alignedNodes = alignAllNodesToGridHelper(store.nodes, gridGap);
    set({
      nodes: alignedNodes,
      lastActionId: `align-grid-${Date.now()}`,
      lastActionName: 'Align to Grid',
    });
    store.addActivityLog?.(`Aligned all nodes to canvas grid (${gridGap}px)`);
  },
  ungroupNodes: (ids: string[]) => set({
    nodes: get().nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: undefined } } : n),
    lastActionId: `ungroup-${Date.now()}`, lastActionName: 'Ungroup Elements'
  }),
});
