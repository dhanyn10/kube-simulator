import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { 
  getNodeData, 
  sortNodes, 
  getAbsPos
} from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';

// -- CALLBACK FACTORIES (To avoid nesting) --

const createNodeHandlers = (id: string, get: () => any) => ({
  onDelete: () => {
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node) get().deleteNodes([node]);
  },
  onRename: (newName: string) => {
    const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
    get().updateNodeData(id, { label: cleanName });
  }
});

// -- RESOURCE INITIALIZERS --

const getInitialData = (type: K8sResourceType, id: string, get: any) => {
  const handlers = createNodeHandlers(id, get);
  const base = { label: `new-${type.toLowerCase()}`, type, image: '', status: 'pending', ...handlers };

  switch (type) {
    case 'Service':
      return { ...base, port: 80, targetPort: 80, selector: 'app-label', displaySettings: { port: true, targetPort: true, selector: true } };
    case 'Pod':
      return { ...base, replicas: 1, displaySettings: { runtime: true, webserver: true, image: true, resources: true } };
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
    return (data.webserver && data.webserver !== 'none') || (data.runtime && data.runtime !== 'none') ? 'ready' : 'pending';
  }
  return data.status || 'ready';
};

// -- ACTION IMPLEMENTATIONS (Flattened) --

const addNodeImpl = (set: any, get: any) => (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => {
  const id = `${type.toLowerCase()}-${crypto.randomUUID().split('-')[0]}`;
  const finalPos = position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }; // nosonar
  const data = getInitialData(type, id, get);

  const newNode: Node = {
    id, type, position: finalPos, parentId,
    extent: parentId ? 'parent' : undefined,
    data,
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

const deleteNodesImpl = (set: any, get: any) => (nodesToDelete: Node[]) => {
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

const updateNodeDataImpl = (set: any, get: any) => (nodeId: string, newData: any) => {
  const { nodes } = get();
  const target = nodes.find((n: Node) => n.id === nodeId);
  if (!target) return;

  const updatedData = { ...target.data, ...newData };
  updatedData.status = evaluateStatus(target.type || '', updatedData);

  const updatedNode = { 
    ...target, data: updatedData,
    ...(target.type !== 'Deployment' && target.type !== 'Namespace' ? {
      width: undefined, height: undefined,
      style: { ...target.style, width: undefined, height: undefined }
    } : {})
  };

  let nextNodes = nodes.map((n: Node) => n.id === nodeId ? updatedNode : n);

  if (updatedNode.type === 'Pod') {
    if (!updatedNode.parentId && (updatedData.replicas || 0) > 3) {
      const podPos = getAbsPos(nodeId, nodes);
      const groupId = `podgroup-${crypto.randomUUID().split('-')[0]}`;
      const newGroup: Node = { 
        id: groupId, type: 'PodGroup', position: { x: podPos.x - 20, y: podPos.y - 40 },
        data: { ...updatedData, label: updatedData.label, ...createNodeHandlers(groupId, get) }
      };
      const tempPod = { ...updatedNode, parentId: groupId, position: { x: 20, y: 40 } };
      const { updatedDeployment, laidOut } = syncDeployment(newGroup, [tempPod], 0, get, tempPod);
      nextNodes = sortNodes([...nextNodes.filter(n => n.id !== nodeId), updatedDeployment, ...laidOut]);
    } else if (updatedNode.parentId) {
      const parent = nextNodes.find(n => n.id === updatedNode.parentId);
      if (parent) {
        if (parent.type === 'PodGroup' && (updatedData.replicas || 0) <= 3) {
          const groupPos = getAbsPos(parent.id, nextNodes);
          const others = nextNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
          nextNodes = sortNodes([...others, { ...updatedNode, parentId: undefined, position: groupPos, extent: undefined }]);
        } else {
          const replicasChange = (parent.type === 'Deployment' && newData.replicas !== undefined) 
            ? (newData.replicas || 0) - (target.data.replicas || 0) : 0;
          const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, replicasChange, get, updatedNode);
          const others = nextNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
          nextNodes = syncContainerSize(parent.parentId, sortNodes([...others, updatedDeployment, ...laidOut]));
        }
      }
    }
  } else if (updatedNode.type === 'Deployment' || updatedNode.type === 'PodGroup') {
    const { updatedDeployment, laidOut } = syncDeployment(updatedNode, nextNodes, 0, get);
    const others = nextNodes.filter(n => n.id !== updatedNode.id && n.parentId !== updatedNode.id);
    nextNodes = syncContainerSize(updatedNode.parentId, sortNodes([...others, updatedDeployment, ...laidOut]));
  }

  set({ nodes: nextNodes, lastActionId: `update-${Date.now()}`, lastActionName: 'Update Node Data' });
};

// -- MAIN EXPORT --

export const nodeActions = (set: any, get: any) => ({
  addNode: addNodeImpl(set, get),
  deleteNodes: deleteNodesImpl(set, get),
  updateNodeData: updateNodeDataImpl(set, get),
  onNodeClick: (event: React.MouseEvent, node: Node) => set({ activeDeploymentId: node.type === 'Deployment' ? node.id : null }),
  onPaneClick: () => set({ activeDeploymentId: null }),
  groupNodes: (ids: string[]) => set((s: any) => ({
    nodes: s.nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: `group-${crypto.randomUUID().split('-')[0]}` } } : n),
    lastActionId: `group-${Date.now()}`, lastActionName: 'Group Elements'
  })),
  ungroupNodes: (ids: string[]) => set((s: any) => ({
    nodes: s.nodes.map((n: Node) => ids.includes(n.id) ? { ...n, data: { ...n.data, groupId: undefined } } : n),
    lastActionId: `ungroup-${Date.now()}`, lastActionName: 'Ungroup Elements'
  })),
});
