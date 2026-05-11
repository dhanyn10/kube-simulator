import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType } from '../../../types';
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

const getInitialData = (type: K8sResourceType, id: string, get: () => FlowState) => {
  const handlers = createNodeHandlers(id, get);
  const base = { label: `new-${type.toLowerCase()}`, type, image: '', status: 'pending', ...handlers };

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

const evaluateStatus = (type: string, data: any) => {
  if (['Pod', 'Deployment', 'PodGroup'].includes(type)) {
    const hasWebOrRun = (data.webserver && data.webserver !== 'none') || (data.runtime && data.runtime !== 'none');
    return hasWebOrRun ? 'ready' : 'pending';
  }
  return data.status || 'ready';
};

// -- SPECIFIC NODE HANDLERS (To reduce complexity) --

const handlePodGroupTransform = (nodeId: string, updatedNode: Node, updatedData: any, nodes: Node[], get: any) => {
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

const handlePodParentSync = (target: Node, updatedNode: Node, newData: any, nodes: Node[], get: any) => {
  const parent = nodes.find(n => n.id === updatedNode.parentId);
  if (!parent) return nodes;

  if (parent.type === 'PodGroup' && (Number(updatedNode.data.replicas) || 0) <= 3) {
    const groupPos = getAbsPos(parent.id, nodes);
    const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
    return sortNodes([...others, { ...updatedNode, parentId: undefined, position: groupPos, extent: undefined }]);
  }

  const replicasChange = (parent.type === 'Deployment' && newData.replicas !== undefined)
    ? (newData.replicas || 0) - (Number(target.data.replicas) || 0) : 0;

  const { updatedDeployment, laidOut } = syncDeployment(parent, nodes, replicasChange, get, updatedNode);
  const others = nodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
  const resultNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
  return syncContainerSize(parent.parentId, resultNodes);
};

const handleContainerSync = (updatedNode: Node, nodes: Node[], get: any) => {
  const { updatedDeployment, laidOut } = syncDeployment(updatedNode, nodes, 0, get);
  const others = nodes.filter(n => n.id !== updatedNode.id && n.parentId !== updatedNode.id);
  const resultNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
  return syncContainerSize(updatedNode.parentId, resultNodes);
};

// -- ACTION IMPLEMENTATIONS --

const addNodeImpl = (set: any, get: () => FlowState) => (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => {
  const id = `${type.toLowerCase()}-${crypto.randomUUID().split('-')[0]}`;
  const finalPos = position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }; // nosonar

  const newNode: Node = {
    id, type, position: finalPos, parentId,
    extent: parentId ? 'parent' : undefined,
    data: getInitialData(type, id, get),
    ...(type === 'Deployment' ? { width: 320, height: 160, style: { width: 320, height: 160 } } : {}),
    ...(type === 'Namespace' ? { width: 600, height: 400, style: { width: 600, height: 400 } } : {}),
  };

  const { nodes } = get();
  let nextNodes = [...nodes, newNode];

  if (parentId && type === 'Pod') {
    const parent = nextNodes.find(n => n.id === parentId);
    if (parent?.type === 'Deployment') {
      const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 1, get, newNode);
      const others = nextNodes.filter(n => (n.parentId !== parentId || n.type !== 'Pod') && n.id !== id);
      nextNodes = [...others.map(n => n.id === parentId ? updatedDeployment : n), ...laidOut];
    }
  }

  set({ nodes: sortNodes(nextNodes), lastActionId: `add-${Date.now()}`, lastActionName: `Add ${type}` });
};

const deleteNodesImpl = (set: any, get: () => FlowState) => (nodesToDelete: Node[]) => {
  const { nodes, edges } = get();
  const deleteIds = new Set(nodesToDelete.map(n => n.id));
  let nextNodes = nodes.filter((n: Node) => !deleteIds.has(n.id));

  nodesToDelete.forEach(node => {
    if (node.type === 'Deployment') nextNodes = nextNodes.filter(n => n.parentId !== node.id);
    if (node.type === 'Pod' && node.parentId) {
      const parent = nextNodes.find(n => n.id === node.parentId);
      if (parent?.type === 'Deployment') {
        const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -(getNodeData(node).replicas || 1), get);
        const others = nextNodes.filter(n => n.parentId !== parent.id || n.type !== 'Pod');
        nextNodes = [...others.map(n => n.id === parent.id ? updatedDeployment : n), ...laidOut];
      }
    }
  });

  set({
    nodes: nextNodes,
    edges: edges.filter((e: Edge) => !deleteIds.has(e.source) && !deleteIds.has(e.target)),
    lastActionId: `delete-${Date.now()}`, lastActionName: 'Delete Elements'
  });
};

const updateNodeDataImpl = (set: any, get: () => FlowState) => (nodeId: string, newData: any) => {
  const { nodes } = get();
  const target = nodes.find((n: Node) => n.id === nodeId);
  if (!target) return;

  const sanitizedData = { ...newData };
  if (sanitizedData.replicas !== undefined) {
    sanitizedData.replicas = Math.max(0, Math.min(1000, Number(sanitizedData.replicas)));
  }
  if (sanitizedData.minReplicas !== undefined) {
    sanitizedData.minReplicas = Math.max(1, Math.min(1000, Number(sanitizedData.minReplicas)));
  }
  if (sanitizedData.maxReplicas !== undefined) {
    sanitizedData.maxReplicas = Math.max(1, Math.min(1000, Number(sanitizedData.maxReplicas)));
  }

  // Auto-image logic
  if (sanitizedData.runtime !== undefined || sanitizedData.webserver !== undefined) {
    const rt = sanitizedData.runtime ?? target.data.runtime ?? 'none';
    const ws = sanitizedData.webserver ?? target.data.webserver ?? 'none';
    
    let autoImg = '';
    if (rt === 'nodejs') autoImg = 'node:18-alpine';
    else if (rt === 'go') autoImg = 'golang:1.21-alpine';
    else if (rt === 'python') autoImg = 'python:3.11-slim';
    else if (rt === 'java') autoImg = 'openjdk:17-jdk-slim';
    else if (rt === 'php') {
      if (ws === 'nginx') autoImg = 'php:8.2-fpm-alpine';
      else if (ws === 'apache') autoImg = 'php:8.2-apache';
      else autoImg = 'php:8.2-cli-alpine';
    } else if (ws === 'nginx') autoImg = 'nginx:latest';
    else if (ws === 'apache') autoImg = 'httpd:latest';
    else autoImg = 'nginx:latest';

    // Only auto-update if image is currently empty or was previously auto-set (not custom)
    if (!target.data.image || target.data.isAutoImage) {
      sanitizedData.image = autoImg;
      sanitizedData.isAutoImage = true;
    }
  }

  // If user manually sets image, mark as not auto
  if (newData.image) {
    sanitizedData.isAutoImage = false;
  }

  const updatedData = { ...target.data, ...sanitizedData };
  updatedData.status = evaluateStatus(target.type || '', updatedData);

  const updatedNode = {
    ...target, data: updatedData,
    ...(target.type !== 'Deployment' && target.type !== 'Namespace' ? {
      width: undefined, height: undefined, style: { ...target.style, width: undefined, height: undefined }
    } : {})
  };

  let nextNodes = nodes.map((n: Node) => n.id === nodeId ? updatedNode : n);

  // Routing to specific handlers based on type
  if (updatedNode.type === 'Pod') {
    if (!updatedNode.parentId && (updatedData.replicas || 0) > 3) {
      nextNodes = handlePodGroupTransform(nodeId, updatedNode, updatedData, nodes, get);
    } else if (updatedNode.parentId) {
      nextNodes = handlePodParentSync(target, updatedNode, newData, nextNodes, get);
    }
  } else if (updatedNode.type === 'Deployment' || updatedNode.type === 'PodGroup') {
    nextNodes = handleContainerSync(updatedNode, nextNodes, get);
  }

  set({ nodes: nextNodes, lastActionId: `update-${Date.now()}`, lastActionName: 'Update Node Data' });
};

// -- MAIN EXPORT --

export const nodeActions = (set: any, get: () => FlowState) => ({
  addNode: addNodeImpl(set, get),
  deleteNodes: deleteNodesImpl(set, get),
  updateNodeData: updateNodeDataImpl(set, get),
  onNodeClick: (event: React.MouseEvent, node: Node) => set({ activeDeploymentId: node.type === 'Deployment' ? node.id : null }),
  onPaneClick: () => set({ activeDeploymentId: null }),
  groupNodes: (ids: string[]) => set((s: FlowState) => ({
    nodes: s.nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: `group-${crypto.randomUUID().split('-')[0]}` } } : n),
    lastActionId: `group-${Date.now()}`, lastActionName: 'Group Elements'
  })),
  ungroupNodes: (ids: string[]) => set((s: FlowState) => ({
    nodes: s.nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: undefined } } : n),
    lastActionId: `ungroup-${Date.now()}`, lastActionName: 'Ungroup Elements'
  })),
});
