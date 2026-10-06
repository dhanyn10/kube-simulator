import { type MouseEvent } from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '@/types';
import type { FlowState } from '@/store/types';
import {
  getNodeData,
  sortNodes,
  getAbsPos,
  resolveGlobalCollisions
} from '@/store/helpers';
import { syncDeployment, syncContainerSize } from '@/store/nodeHelpers';
import {
  getInitialData,
  sanitizeResourceLimits,
  applyAutoImageLogic,
  createNodeHandlers,
  syncWorkloadMetadata
} from './nodeUtils';
import { evaluatePvcRealtimeStatus } from '@/activities/config/pvcConfigHelpers';
import { formatPodName, safeRandom } from '@/lib/utils';
import {
  emitLiveScaleCommand,
  emitLiveSetImageCommand,
  emitLiveSetResourcesCommand,
  emitLiveNodeCreatedCommand,
  emitLiveNodeDeletedCommand,
} from '@/activities/terminal/liveUpdateCommands';
import { isNodeAccessForbidden } from '@/activities/nodes/rbacNodeHelpers';

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
  const tempPod = { ...updatedNode, parentId: groupId, position: { x: 20, y: 40 } };
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
const handlePodParentSync = (target: Node, updatedNode: Node, newData: Partial<K8sNodeData>, nodes: Node[], get: () => FlowState) => {
  const parent = nodes.find(n => n.id === updatedNode.parentId);
  if (!parent) return nodes;

  const targetData = target.data as K8sNodeData;

  if (parent.type === 'ReplicaSet' && (Number(updatedNode.data.replicas) || 0) === 1) {
    const groupPos = getAbsPos(parent.id, nodes);
    const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
    const baseName = updatedNode.data.baseName || updatedNode.data.label || 'pod';
    const cleanBase = formatPodName(baseName, updatedNode.data.podHash, updatedNode.data.replicaSuffix, 1);
    const updatedPodWithCleanLabel = {
      ...updatedNode,
      parentId: undefined,
      position: groupPos,
      extent: undefined,
      data: {
        ...updatedNode.data,
        label: cleanBase,
        parentReplicas: 1,
      }
    };
    return sortNodes([...others, updatedPodWithCleanLabel]);
  }

  const replicasChange = ((parent.type === 'Deployment' || parent.type === 'ReplicaSet') && newData.replicas !== undefined)
    ? (newData.replicas || 0) - (Number(targetData.replicas) || 0) : 0;

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
    const parent = nodes.find(n => n.id === updatedNode.parentId);
    const isStandaloneContext = !updatedNode.parentId || parent?.type === 'Namespace';

    if (isStandaloneContext && (updatedData.replicas || 0) > 1) {
      return handleReplicaSetTransform(nodeId, updatedNode, updatedData, nodes, get);
    }
    if (updatedNode.parentId) {
      const parent = nodes.find(n => n.id === updatedNode.parentId);
      if (parent?.type === 'Deployment' || parent?.type === 'ReplicaSet') {
        return handlePodParentSync(target, updatedNode, newData, nextNodes, get);
      }
    }
  }
  if (updatedNode.type === 'Deployment' || updatedNode.type === 'ReplicaSet') {
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
  if (node.type === 'Deployment') nextNodes = nextNodes.filter(n => n.parentId !== node.id);
  if (node.type === 'Pod' && node.parentId) {
    const parent = nextNodes.find(n => n.id === node.parentId);
    if (parent?.type === 'Deployment' || parent?.type === 'ReplicaSet') {
      const nodeData = getNodeData(node);
      const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -(nodeData.replicas || 1), get);
      const others = nextNodes.filter(n => n.parentId !== parent.id || n.type !== 'Pod');
      nextNodes = [...others.map(n => n.id === parent.id ? updatedDeployment : n), ...laidOut];
    }
  }
  return nextNodes;
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
  if (targetNode.type === 'Service' && newData.selector !== undefined) {
    const newSelector = newData.selector;
    // Remove existing outgoing edges from this Service to non-matching workloads
    nextEdges = nextEdges.filter((e) => {
      if (e.source !== targetNode.id) return true;
      const target = nodes.find((n) => n.id === e.target);
      if (!target || !['Deployment', 'Pod', 'ReplicaSet'].includes(target.type || '')) return true;
      const tLabel = (target.data?.label as string) || (target.data?.baseName as string);
      return tLabel === newSelector;
    });

    if (newSelector) {
      const matchingWorkloads = nodes.filter((n) => {
        if (!['Deployment', 'Pod', 'ReplicaSet'].includes(n.type || '')) return false;
        if (n.type === 'Pod' && (n.parentId || n.data?.parentId)) return false;
        const tLabel = (n.data?.label as string) || (n.data?.baseName as string);
        return tLabel === newSelector;
      });

      matchingWorkloads.forEach((w) => {
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
  }

  // Ingress form backendServiceName update
  if (targetNode.type === 'Ingress' && newData.backendServiceName !== undefined) {
    const newBackend = newData.backendServiceName;
    // Remove existing outgoing edges from this Ingress to non-matching Services
    nextEdges = nextEdges.filter((e) => {
      if (e.source !== targetNode.id) return true;
      const target = nodes.find((n) => n.id === e.target);
      if (!target || target.type !== 'Service') return true;
      return target.data?.label === newBackend;
    });

    if (newBackend) {
      const matchingServices = nodes.filter(
        (n) => n.type === 'Service' && n.data?.label === newBackend
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
  }

  return nextEdges;
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
    if (n.type === 'Service' && n.data?.selector === oldLabel) {
      return {
        ...n,
        data: {
          ...n.data,
          selector: ''
        }
      };
    }
    if (n.type === 'Ingress' && n.data?.backendServiceName === oldLabel) {
      return {
        ...n,
        data: {
          ...n.data,
          backendServiceName: ''
        }
      };
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
  if (newNode.parentId && newNode.type === 'Pod') {
    const parent = nodes.find(n => n.id === newNode.parentId);
    if (parent?.type === 'Deployment' || parent?.type === 'ReplicaSet') {
      const { updatedDeployment, laidOut } = syncDeployment(parent, nodes, 1, get, newNode);
      const others = nodes.filter(n => (n.parentId !== newNode.parentId || n.type !== 'Pod') && n.id !== newNode.id);
      return sortNodes([...others.map(n => n.id === newNode.parentId ? updatedDeployment : n), ...laidOut]);
    }
  }
  return sortNodes(nodes);
};

// -- ACTION IMPLEMENTATIONS --

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
  const finalPos = position || { x: 100 + safeRandom() * 200, y: 100 + safeRandom() * 200 };

  const newNode: Node = {
    id, type, position: finalPos, parentId: targetParentId,
    extent: targetParentId ? 'parent' : undefined,
    data: getInitialData(type, id, get),
    ...(type === 'Deployment' ? { width: 320, height: 160, style: { width: 320, height: 160 } } : {}),
    ...(type === 'Namespace' ? { width: 600, height: 400, style: { width: 600, height: 400 } } : {}),
  };

  const nextNodes = handleAdditionSync(newNode, [...get().nodes, newNode], get);
  const collisionResolvedNodes = resolveGlobalCollisions(nextNodes, id);

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
    if (['Deployment', 'Pod', 'ReplicaSet', 'Service'].includes(node.type || '')) {
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

/**
 * Updates data properties for a specific canvas node and emits live terminal command logs.
 */
const updateNodeDataImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (nodeId: string, newData: Partial<K8sNodeData>) => {
  const { nodes } = get();
  const target = nodes.find((n: Node) => n.id === nodeId);
  if (!target) return;

  const targetData = target.data as K8sNodeData;

  // Skip if data hasn't actually changed to avoid unnecessary re-renders
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

  let updatedData: K8sNodeData = { ...targetData, ...sanitizedData };
  updatedData = { ...updatedData, ...syncWorkloadMetadata(target.type || '', updatedData) } as K8sNodeData;

  const updatedNode: Node = {
    ...target,
    data: updatedData,
    ...(target.type !== 'Deployment' && target.type !== 'Namespace' ? {
      width: undefined, height: undefined, style: { ...target.style, width: undefined, height: undefined }
    } : {})
  };

  let nextNodes = syncUpdatedNode(nodeId, updatedNode, updatedData, target, newData, nodes, get);

  // Invalidate Service selectors and Ingress references if a workload or Service label/name changed
  const newLabel = (updatedData.label as string) || (updatedData.baseName as string);
  if (
    ['Deployment', 'Pod', 'ReplicaSet', 'Service'].includes(target.type || '') &&
    newData.label !== undefined &&
    prevLabel &&
    newLabel !== prevLabel
  ) {
    nextNodes = invalidateTargetReferences(prevLabel, nextNodes);
  }

  // Responsive real-time PVC status update on PVC accessMode change or connected workload replica changes
  nextNodes = nextNodes.map((n) => {
    if (n.type !== 'PVC') return n;
    const realTimeStatus = evaluatePvcRealtimeStatus(n, nextNodes, get().edges);
    if (n.data?.pvcStatus !== realTimeStatus) {
      return { ...n, data: { ...n.data, pvcStatus: realTimeStatus } };
    }
    return n;
  });

  // Bidirectional Node Linking: Sync Canvas Edges when target is selected in Form Settings
  const nextEdges = syncEdgesFromFormSelection(target, newData, nextNodes, get().edges);

  const collisionResolvedNodes = resolveGlobalCollisions(nextNodes, nodeId);
  set({
    nodes: collisionResolvedNodes,
    edges: nextEdges,
    lastActionId: `update-${Date.now()}`,
    lastActionName: 'Update Node Data'
  });

  // Auto-emit kubectl live command for updated fields
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
      activeDeploymentId: node.type === 'Deployment' ? node.id : null,
      configuringNodeId: node.id,
      configuringEdgeId: null
    });
  },
  onPaneClick: () => set({ activeDeploymentId: null, configuringNodeId: null, configuringEdgeId: null }),
  groupNodes: (ids: string[]) => set({
    nodes: get().nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: `group-${crypto.randomUUID().split('-')[0]}` } } : n),
    lastActionId: `group-${Date.now()}`, lastActionName: 'Group Elements'
  }),
  ungroupNodes: (ids: string[]) => set({
    nodes: get().nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: undefined } } : n),
    lastActionId: `ungroup-${Date.now()}`, lastActionName: 'Ungroup Elements'
  }),
});
