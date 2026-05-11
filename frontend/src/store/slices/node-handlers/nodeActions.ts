import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { FlowState } from '../../types';
import {
  getNodeData,
  sortNodes,
  getAbsPos
} from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';

// -- CALLBACK FACTORIES --

const createNodeHandlers = (id: string, get: () => FlowState) => ({
  onDelete: () => {
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node) get().deleteNodes([node]);
  },
  onRename: (newName: string) => {
    const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
    get().updateNodeData(id, { label: cleanName });
  }
});

// -- RESOURCE INITIALIZERS & STATUS --

const getInitialData = (type: K8sResourceType, id: string, get: () => FlowState): K8sNodeData => {
  const handlers = createNodeHandlers(id, get);
  const base: K8sNodeData = { label: `new-${type.toLowerCase()}`, type, image: '', status: 'pending', ...handlers };

  switch (type) {
    case 'Service':
      return { ...base, port: 80, targetPort: 80, selector: 'app-label', displaySettings: { port: true, targetPort: true, selector: true } };
    case 'Pod':
      return { ...base, replicas: 1, image: 'nginx:latest', isAutoImage: true, displaySettings: { runtime: true, webserver: true, image: true, resources: true } };
    case 'Deployment':
      return { ...base, replicas: 0 };
    case 'Ingress':
      return { ...base, ingressHost: 'example.local', ingressPath: '/', displaySettings: { host: true, path: true } };
    case 'HPA':
      return { ...base, minReplicas: 1, maxReplicas: 10, targetCPU: 50, displaySettings: { replicas: true, targetCPU: true } };
    case 'Internet':
      return { ...base, displaySettings: { traffic: true, duration: true } };
    default:
      return base;
  }
};

const evaluateStatus = (type: string, data: K8sNodeData): 'pending' | 'ready' | 'crashing' => {
  if (['Pod', 'Deployment', 'PodGroup'].includes(type)) {
    const hasWebOrRun = (data.webserver && data.webserver !== 'none') || (data.runtime && data.runtime !== 'none');
    return hasWebOrRun ? 'ready' : 'pending';
  }
  return data.status || 'ready';
};

// -- SPECIFIC NODE HANDLERS (To reduce complexity) --

const handlePodGroupTransform = (nodeId: string, updatedNode: Node, updatedData: K8sNodeData, nodes: Node[], get: () => FlowState) => {
  const podPos = getAbsPos(nodeId, nodes);
  const groupId = `podgroup-${crypto.randomUUID().split('-')[0]}`;
  const newGroup: Node = {
    id: groupId, type: 'PodGroup', position: { x: podPos.x - 20, y: podPos.y - 40 },
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

  if (parent.type === 'PodGroup' && (Number(updatedNode.data.replicas) || 0) <= 3) {
    const groupPos = getAbsPos(parent.id, nodes);
    const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
    return sortNodes([...others, { ...updatedNode, parentId: undefined, position: groupPos, extent: undefined }]);
  }

  const replicasChange = (parent.type === 'Deployment' && newData.replicas !== undefined)
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

// -- ACTION HELPERS (To reduce Cognitive Complexity) --

const sanitizeResourceLimits = (data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  const res = { ...data };
  const limit = (val: any, min: number, max: number) => Math.max(min, Math.min(max, Number(val)));
  if (res.replicas !== undefined) res.replicas = limit(res.replicas, 0, 1000);
  if (res.minReplicas !== undefined) res.minReplicas = limit(res.minReplicas, 1, 1000);
  if (res.maxReplicas !== undefined) res.maxReplicas = limit(res.maxReplicas, 1, 1000);
  return res;
};

const resolveAutoImage = (runtime: string, webserver: string) => {
  if (runtime === 'nodejs') return 'node:18-alpine';
  if (runtime === 'go') return 'golang:1.21-alpine';
  if (runtime === 'python') return 'python:3.11-slim';
  if (runtime === 'java') return 'openjdk:17-jdk-slim';
  if (runtime === 'php') {
    if (webserver === 'nginx') return 'php:8.2-fpm-alpine';
    if (webserver === 'apache') return 'php:8.2-apache';
    return 'php:8.2-cli-alpine';
  }
  if (webserver === 'nginx') return 'nginx:latest';
  if (webserver === 'apache') return 'httpd:latest';
  return 'nginx:latest';
};

const applyAutoImageLogic = (targetData: K8sNodeData, data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  if (data.runtime === undefined && data.webserver === undefined) return data;
  const rt = data.runtime ?? targetData.runtime ?? 'none';
  const ws = data.webserver ?? targetData.webserver ?? 'none';
  if (!targetData.image || targetData.isAutoImage) {
    return { ...data, image: resolveAutoImage(rt, ws), isAutoImage: true };
  }
  return data;
};

const syncUpdatedNode = (nodeId: string, updatedNode: Node, updatedData: K8sNodeData, target: Node, newData: Partial<K8sNodeData>, nodes: Node[], get: () => FlowState) => {
  let nextNodes = nodes.map((n: Node) => n.id === nodeId ? updatedNode : n);
  if (updatedNode.type === 'Pod') {
    if (!updatedNode.parentId && (updatedData.replicas || 0) > 3) {
      return handlePodGroupTransform(nodeId, updatedNode, updatedData, nodes, get);
    }
    if (updatedNode.parentId) {
      return handlePodParentSync(target, updatedNode, newData, nextNodes, get);
    }
  }
  if (updatedNode.type === 'Deployment' || updatedNode.type === 'PodGroup') {
    return handleContainerSync(updatedNode, nextNodes, get);
  }
  return nextNodes;
};

const processNodeDeletion = (node: Node, currentNodes: Node[], get: () => FlowState) => {
  let nextNodes = currentNodes;
  if (node.type === 'Deployment') nextNodes = nextNodes.filter(n => n.parentId !== node.id);
  if (node.type === 'Pod' && node.parentId) {
    const parent = nextNodes.find(n => n.id === node.parentId);
    if (parent?.type === 'Deployment') {
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
    if (parent?.type === 'Deployment') {
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
  const finalPos = position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }; //nosonar

  const newNode: Node = {
    id, type, position: finalPos, parentId,
    extent: parentId ? 'parent' : undefined,
    data: getInitialData(type, id, get),
    ...(type === 'Deployment' ? { width: 320, height: 160, style: { width: 320, height: 160 } } : {}),
    ...(type === 'Namespace' ? { width: 600, height: 400, style: { width: 600, height: 400 } } : {}),
  };

  const nextNodes = handleAdditionSync(newNode, [...get().nodes, newNode], get);
  set({ nodes: nextNodes, lastActionId: `add-${Date.now()}`, lastActionName: `Add ${type}` });
};

const deleteNodesImpl = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => (nodesToDelete: Node[]) => {
  const { nodes, edges } = get();
  const deleteIds = new Set(nodesToDelete.map(n => n.id));

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
  let sanitizedData = sanitizeResourceLimits(newData);
  sanitizedData = applyAutoImageLogic(targetData, sanitizedData);

  if (newData.image) {
    sanitizedData.isAutoImage = false;
  }

  const updatedData: K8sNodeData = { ...targetData, ...sanitizedData };
  updatedData.status = evaluateStatus(target.type || '', updatedData);

  const updatedNode: Node = {
    ...target,
    data: updatedData,
    ...(target.type !== 'Deployment' && target.type !== 'Namespace' ? {
      width: undefined, height: undefined, style: { ...target.style, width: undefined, height: undefined }
    } : {})
  };

  const nextNodes = syncUpdatedNode(nodeId, updatedNode, updatedData, target, newData, nodes, get);
  set({ nodes: nextNodes, lastActionId: `update-${Date.now()}`, lastActionName: 'Update Node Data' });
};

// -- MAIN EXPORT --

export const nodeActions = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => ({
  addNode: addNodeImpl(set, get),
  deleteNodes: deleteNodesImpl(set, get),
  updateNodeData: updateNodeDataImpl(set, get),
  onNodeClick: (_event: React.MouseEvent, node: Node) => set({ activeDeploymentId: node.type === 'Deployment' ? node.id : null }),
  onPaneClick: () => set({ activeDeploymentId: null }),
  groupNodes: (ids: string[]) => set({
    nodes: get().nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: `group-${crypto.randomUUID().split('-')[0]}` } } : n),
    lastActionId: `group-${Date.now()}`, lastActionName: 'Group Elements'
  }),
  ungroupNodes: (ids: string[]) => set({
    nodes: get().nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: undefined } } : n),
    lastActionId: `ungroup-${Date.now()}`, lastActionName: 'Ungroup Elements'
  }),
});
