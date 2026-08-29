import { type MouseEvent } from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { FlowState } from '../../types';
import {
  getNodeData,
  sortNodes,
  getAbsPos,
  resolveGlobalCollisions
} from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';
import {
  getInitialData,
  sanitizeResourceLimits,
  applyAutoImageLogic,
  createNodeHandlers,
  syncWorkloadMetadata
} from './nodeUtils';
import { safeRandom } from '../../../lib/utils';

// -- SPECIFIC NODE HANDLERS (To reduce complexity) --

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

const handlePodParentSync = (target: Node, updatedNode: Node, newData: Partial<K8sNodeData>, nodes: Node[], get: () => FlowState) => {
  const parent = nodes.find(n => n.id === updatedNode.parentId);
  if (!parent) return nodes;

  const targetData = target.data as K8sNodeData;

  if (parent.type === 'ReplicaSet' && (Number(updatedNode.data.replicas) || 0) === 1) {
    const groupPos = getAbsPos(parent.id, nodes);
    const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
    return sortNodes([...others, { ...updatedNode, parentId: undefined, position: groupPos, extent: undefined }]);
  }

  const replicasChange = ((parent.type === 'Deployment' || parent.type === 'ReplicaSet') && newData.replicas !== undefined)
    ? (newData.replicas || 0) - (Number(targetData.replicas) || 0) : 0;

  const { updatedDeployment, laidOut } = syncDeployment(parent, nodes, replicasChange, get, updatedNode);
  const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
  const resultNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
  return syncContainerSize(parent.parentId, resultNodes);
};

const handleContainerSync = (updatedNode: Node, nodes: Node[], get: () => FlowState) => {
  const { updatedDeployment, laidOut } = syncDeployment(updatedNode, nodes, 0, get);
  const others = nodes.filter(n => n.id !== updatedNode.id && n.parentId !== updatedNode.id);
  const resultNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
  return syncContainerSize(updatedNode.parentId, resultNodes);
};

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

const addNodeImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => {
  const id = `${type.toLowerCase()}-${crypto.randomUUID().split('-')[0]}`;
  const finalPos = position || { x: 100 + safeRandom() * 200, y: 100 + safeRandom() * 200 };

  const newNode: Node = {
    id, type, position: finalPos, parentId,
    extent: parentId ? 'parent' : undefined,
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
};

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
  });

  let nextNodes = nodes.filter((n: Node) => !deleteIds.has(n.id));
  nodesToDelete.forEach(node => {
    nextNodes = processNodeDeletion(node, nextNodes, get);
  });

  set({
    nodes: nextNodes,
    edges: edges.filter((e: Edge) => !deleteIds.has(e.source) && !deleteIds.has(e.target)),
    lastActionId: `delete-${Date.now()}`, lastActionName: 'Delete Elements'
  });
};

const updateNodeDataImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (nodeId: string, newData: Partial<K8sNodeData>) => {
  const { nodes } = get();
  const target = nodes.find((n: Node) => n.id === nodeId);
  if (!target) return;

  const targetData = target.data as K8sNodeData;

  // Skip if data hasn't actually changed to avoid unnecessary re-renders
  const hasChanges = Object.entries(newData).some(([key, value]) => (targetData as any)[key] !== value);
  if (!hasChanges) return;

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

  const nextNodes = syncUpdatedNode(nodeId, updatedNode, updatedData, target, newData, nodes, get);
  const collisionResolvedNodes = resolveGlobalCollisions(nextNodes, nodeId);
  set({ nodes: collisionResolvedNodes, lastActionId: `update-${Date.now()}`, lastActionName: 'Update Node Data' });
};

// -- MAIN EXPORT --

export const nodeActions = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => ({
  addNode: addNodeImpl(set, get),
  deleteNodes: deleteNodesImpl(set, get),
  updateNodeData: updateNodeDataImpl(set, get),
  onNodeClick: (_event: MouseEvent, node: Node) => set({
    activeDeploymentId: node.type === 'Deployment' ? node.id : null,
    configuringNodeId: node.id,
    configuringEdgeId: null
  }),
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
