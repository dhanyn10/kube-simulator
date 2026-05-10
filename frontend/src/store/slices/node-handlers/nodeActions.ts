import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { 
  getNodeData, 
  sortNodes, 
  getAbsPos
} from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';

/**
 * HELPER: Initialize default data based on resource type
 */
const initializeResourceData = (type: K8sResourceType, baseData: any) => {
  const data = { ...baseData };
  
  switch (type) {
    case 'Service':
      return { 
        ...data, 
        port: 80, targetPort: 80, selector: 'app-label',
        displaySettings: { port: true, targetPort: true, selector: true } 
      };
    case 'Pod':
      return { 
        ...data, 
        replicas: 1, 
        displaySettings: { runtime: true, webserver: true, image: true, resources: true } 
      };
    case 'Deployment':
      return { ...data, replicas: 0 };
    case 'Ingress':
      return { 
        ...data, 
        ingressHost: 'example.local', ingressPath: '/',
        displaySettings: { host: true, path: true } 
      };
    case 'HPA':
      return { 
        ...data, 
        minReplicas: 1, maxReplicas: 10, targetCPU: 50,
        displaySettings: { replicas: true, targetCPU: true } 
      };
    case 'Internet':
      return { ...data, displaySettings: { traffic: true, duration: true } };
    default:
      return data;
  }
};

/**
 * HELPER: Evaluate if a resource should be 'ready' or 'pending'
 */
const evaluateResourceStatus = (type: string, data: any) => {
  if (type === 'Pod' || type === 'Deployment' || type === 'PodGroup') {
    const hasWebserver = data.webserver && data.webserver !== 'none';
    const hasRuntime = data.runtime && data.runtime !== 'none';
    return (hasWebserver || hasRuntime) ? 'ready' : 'pending';
  }
  return data.status || 'ready';
};

export const nodeActions = (set: any, get: any) => {
  
  // -- REUSABLE INTERNAL LOGICS --
  
  const performPodUpdate = (targetNode: Node, updatedNode: Node, nextNodes: Node[]) => {
    const parent = nextNodes.find(n => n.id === updatedNode.parentId);
    if (!parent) return nextNodes;

    const updatedData = updatedNode.data as any;

    // Case: PodGroup auto-dissolve
    if (parent.type === 'PodGroup' && (updatedData.replicas || 0) <= 3) {
      const groupPos = getAbsPos(parent.id, nextNodes);
      const filtered = nextNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
      const standalone = { ...updatedNode, parentId: undefined, position: groupPos, extent: undefined };
      return sortNodes([...filtered, standalone]);
    } 

    // Case: Regular Deployment/PodGroup sync
    let replicasChange = 0;
    if (parent.type === 'Deployment' && updatedData.replicas !== targetNode.data.replicas) {
      replicasChange = (updatedData.replicas || 0) - (Number(targetNode.data.replicas) || 0);
    }

    const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, replicasChange, get, updatedNode);
    const others = nextNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
    const result = sortNodes([...others, updatedDeployment, ...laidOut]);
    return syncContainerSize(parent.parentId, result);
  };

  const performContainerSync = (containerNode: Node, nextNodes: Node[]) => {
    const { updatedDeployment, laidOut } = syncDeployment(containerNode, nextNodes, 0, get);
    const others = nextNodes.filter(n => n.id !== containerNode.id && n.parentId !== containerNode.id);
    const result = sortNodes([...others, updatedDeployment, ...laidOut]);
    return syncContainerSize(containerNode.parentId, result);
  };

  // -- EXPORTED ACTIONS --

  return {
    addNode: (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => {
      const id = `${type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
      const finalPosition = position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
      
      const baseData = { 
        label: `new-${type.toLowerCase()}`, 
        type, image: '', status: 'pending',
        onDelete: () => get().deleteNodes([get().nodes.find((n: Node) => n.id === id)]),
        onRename: (newName: string) => get().updateNodeData(id, { label: newName.toLowerCase().replace(/\s+/g, '-') }),
      };

      const newNode: Node<K8sNodeData> = {
        id, type, position: finalPosition, parentId,
        extent: parentId ? 'parent' : undefined,
        data: initializeResourceData(type, baseData),
        ...(type === 'Deployment' ? { width: 320, height: 160, style: { width: 320, height: 160 } } : {}),
        ...(type === 'Namespace' ? { width: 600, height: 400, style: { width: 600, height: 400 } } : {}),
      };

      set((state: any) => {
        let nextNodes = [...state.nodes, newNode];
        if (parentId && type === 'Pod') {
           const parent = nextNodes.find(n => n.id === parentId);
           if (parent?.type === 'Deployment') {
             const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 1, get, newNode);
             const filtered = nextNodes.filter(n => (n.parentId !== parentId || n.type !== 'Pod') && n.id !== id);
             nextNodes = [...filtered.map(n => n.id === parentId ? updatedDeployment : n), ...laidOut];
           }
        }
        return { nodes: sortNodes(nextNodes), lastActionId: `add-${Date.now()}`, lastActionName: `Add ${type}` };
      });
    },

    deleteNodes: (nodesToDelete: Node[]) => {
      set((state: any) => {
        const deleteIds = new Set(nodesToDelete.map(n => n.id));
        let nextNodes = state.nodes.filter((n: Node) => !deleteIds.has(n.id));
        
        // Cleanup children and sync parents
        nodesToDelete.forEach(node => {
          if (node.type === 'Deployment') nextNodes = nextNodes.filter(n => n.parentId !== node.id);
          if (node.type === 'Pod' && node.parentId) {
            const parent = nextNodes.find(n => n.id === node.parentId);
            if (parent?.type === 'Deployment') {
              const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -(getNodeData(node).replicas || 1), get);
              const filtered = nextNodes.filter(n => n.parentId !== parent.id || n.type !== 'Pod');
              nextNodes = [...filtered.map(n => n.id === parent.id ? updatedDeployment : n), ...laidOut];
            }
          }
        });

        return {
          nodes: nextNodes,
          edges: state.edges.filter((e: Edge) => !deleteIds.has(e.source) && !deleteIds.has(e.target)),
          lastActionId: `delete-${Date.now()}`, lastActionName: 'Delete Elements'
        };
      });
    },

    updateNodeData: (nodeId: string, newData: any) => {
      set((state: any) => {
        const targetNode = state.nodes.find((n: Node) => n.id === nodeId);
        if (!targetNode) return state;

        const updatedData = { ...targetNode.data, ...newData };
        updatedData.status = evaluateResourceStatus(targetNode.type || '', updatedData);

        const updatedNode = { 
          ...targetNode, data: updatedData,
          ...(targetNode.type !== 'Deployment' && targetNode.type !== 'Namespace' ? {
            width: undefined, height: undefined,
            style: { ...targetNode.style, width: undefined, height: undefined }
          } : {})
        };

        let nextNodes = state.nodes.map((n: Node) => n.id === nodeId ? updatedNode : n);

        // Routing Logic based on Node Type
        if (updatedNode.type === 'Pod') {
          if (!updatedNode.parentId && (updatedData.replicas || 0) > 3) {
            // Auto-group to PodGroup
            const podPos = getAbsPos(nodeId, state.nodes);
            const groupId = `podgroup-${Math.random().toString(36).substr(2, 9)}`;
            const newGroup: Node = { 
              id: groupId, type: 'PodGroup', position: { x: podPos.x - 20, y: podPos.y - 40 },
              data: { ...updatedData, label: updatedData.label, onDelete: () => get().deleteNodes([get().nodes.find((n: Node) => n.id === groupId)]) }
            };
            const tempPod = { ...updatedNode, parentId: groupId, position: { x: 20, y: 40 } };
            const { updatedDeployment, laidOut } = syncDeployment(newGroup, [tempPod], 0, get, tempPod);
            nextNodes = sortNodes([...nextNodes.filter(n => n.id !== nodeId), updatedDeployment, ...laidOut]);
          } else if (updatedNode.parentId) {
            nextNodes = performPodUpdate(targetNode, updatedNode, nextNodes);
          }
        } else if (updatedNode.type === 'Deployment' || updatedNode.type === 'PodGroup') {
          nextNodes = performContainerSync(updatedNode, nextNodes);
        }

        return { nodes: nextNodes, lastActionId: `update-${Date.now()}`, lastActionName: 'Update Node Data' };
      });
    },

    onNodeClick: (event: React.MouseEvent, node: Node) => set({ activeDeploymentId: node.type === 'Deployment' ? node.id : null }),
    onPaneClick: () => set({ activeDeploymentId: null }),
    groupNodes: (nodeIds: string[]) => set((state: any) => ({
      nodes: state.nodes.map((n: Node) => nodeIds.includes(n.id) ? { ...n, data: { ...n.data, groupId: `group-${Math.random().toString(36).substring(2, 9)}` } } : n),
      lastActionId: `group-${Date.now()}`, lastActionName: 'Group Elements'
    })),
    ungroupNodes: (nodeIds: string[]) => set((state: any) => ({
      nodes: state.nodes.map((n: Node) => nodeIds.includes(n.id) ? { ...n, data: { ...n.data, groupId: undefined } } : n),
      lastActionId: `ungroup-${Date.now()}`, lastActionName: 'Ungroup Elements'
    })),
  };
};
