import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { 
  getNodeData, 
  sortNodes, 
  getPodMinimumSize,
  getAbsPos
} from '../../helpers';
import { syncDeployment, setupPodHandlers } from '../../nodeHelpers';

export const nodeActions = (set: any, get: any) => ({
  addNode: (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => {
    const id = `${type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
    const finalPosition = position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    
    const newNode: Node<K8sNodeData> = {
      id,
      type,
      position: finalPosition,
      parentId,
      extent: parentId ? 'parent' : undefined,
      data: { 
        label: `new-${type.toLowerCase()}`, 
        type, 
        image: '',
        status: 'pending',
        onDelete: () => {
          const nodeToDelete = get().nodes.find((n: Node) => n.id === id);
          if (nodeToDelete) get().deleteNodes([nodeToDelete]);
        },
        onRename: (newName: string) => {
          const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
          get().updateNodeData(id, { label: cleanName });
        },
      },
    };

    if (type === 'Service') {
       newNode.data.port = 80;
       newNode.data.targetPort = 80;
       newNode.data.selector = 'app-label';
       newNode.data.displaySettings = { port: true, targetPort: true, selector: true };
    } else if (type === 'Pod') {
       newNode.data.replicas = 1;
       newNode.data.displaySettings = { runtime: true, webserver: true, image: true, resources: true };
    } else if (type === 'Deployment') {
       newNode.data.replicas = 0;
       newNode.width = 320;
       newNode.height = 160;
       newNode.style = { width: 320, height: 160 };
    } else if (type === 'Namespace') {
       newNode.width = 600;
       newNode.height = 400;
       newNode.style = { width: 600, height: 400 };
    } else if (type === 'Ingress') {
       newNode.data.ingressHost = 'example.local';
       newNode.data.ingressPath = '/';
       newNode.data.displaySettings = { host: true, path: true };
    } else if (type === 'HPA') {
       newNode.data.minReplicas = 1;
       newNode.data.maxReplicas = 10;
       newNode.data.targetCPU = 50;
       newNode.data.displaySettings = { replicas: true, targetCPU: true };
    } else if (type === 'Internet') {
       newNode.data.displaySettings = { traffic: true, duration: true };
    }

    set((state: any) => {
      let nextNodes = [...state.nodes, newNode];
      
      if (parentId) {
        const parent = nextNodes.find(n => n.id === parentId);
        if (parent?.type === 'Deployment' && type === 'Pod') {
           const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 1, get, newNode);
           nextNodes = nextNodes.filter(n => (n.parentId !== parentId || n.type !== 'Pod') && n.id !== id);
           nextNodes = [...nextNodes.map(n => n.id === parentId ? updatedDeployment : n), ...laidOut];
        }
      }

      return {
        nodes: sortNodes(nextNodes),
        lastActionId: `add-${Date.now()}`,
        lastActionName: `Add ${type}`
      };
    });
  },

  deleteNodes: (nodesToDelete: Node[]) => {
    set((state: any) => {
      const deleteIds = new Set(nodesToDelete.map(n => n.id));
      let nextNodes = state.nodes.filter((n: Node) => !deleteIds.has(n.id));
      
      const deploymentNodes = nodesToDelete.filter(n => n.type === 'Deployment');
      deploymentNodes.forEach(dept => {
        nextNodes = nextNodes.filter((n: Node) => n.parentId !== dept.id);
      });

      const deletedPods = nodesToDelete.filter(n => n.type === 'Pod' && n.parentId);
      deletedPods.forEach(pod => {
        const parent = nextNodes.find((n: Node) => n.id === pod.parentId);
        if (parent?.type === 'Deployment') {
          const movingReplicas = getNodeData(pod).replicas || 1;
          const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -movingReplicas, get);
          nextNodes = nextNodes.filter(n => n.parentId !== parent.id || n.type !== 'Pod');
          nextNodes = [...nextNodes.map(n => n.id === parent.id ? updatedDeployment : n), ...laidOut];
        }
      });

      return {
        nodes: nextNodes,
        edges: state.edges.filter((e: Edge) => !deleteIds.has(e.source) && !deleteIds.has(e.target)),
        lastActionId: `delete-${Date.now()}`,
        lastActionName: 'Delete Elements'
      };
    });
  },

  updateNodeData: (nodeId: string, newData: any) => {
    set((state: any) => {
      const targetNode = state.nodes.find((n: Node) => n.id === nodeId);
      if (!targetNode) return state;

      const updatedData = { ...targetNode.data, ...newData };
      const updatedNode = { 
        ...targetNode, 
        data: updatedData,
        ...(targetNode.type !== 'Deployment' && targetNode.type !== 'Namespace' ? {
          width: undefined,
          height: undefined,
          style: { ...targetNode.style, width: undefined, height: undefined }
        } : {})
      };

      let nextNodes = state.nodes.map((n: Node) => n.id === nodeId ? updatedNode : n);

      if (updatedNode.type === 'Pod' && !updatedNode.parentId && (updatedData.replicas || 0) > 3) {
        const podPos = getAbsPos(nodeId, state.nodes);
        const groupId = `podgroup-${Math.random().toString(36).substr(2, 9)}`;
        const newGroup: Node = {
          id: groupId,
          type: 'PodGroup',
          position: { x: podPos.x - 20, y: podPos.y - 40 },
          data: { 
            ...updatedData, 
            label: updatedData.label,
            onDelete: () => {
              const node = get().nodes.find((n: Node) => n.id === groupId);
              if (node) get().deleteNodes([node]);
            }
          }
        };
        const tempPod = { ...updatedNode, parentId: groupId, position: { x: 20, y: 40 } };
        const { updatedDeployment, laidOut } = syncDeployment(newGroup, [tempPod], 0, get, tempPod);
        const otherNodes = nextNodes.filter(n => n.id !== nodeId);
        nextNodes = sortNodes([...otherNodes, updatedDeployment, ...laidOut]);
      }
      else if (updatedNode.type === 'Pod' && updatedNode.parentId) {
        const parent = nextNodes.find(n => n.id === updatedNode.parentId);
        if (parent) {
          if (parent.type === 'PodGroup' && (updatedData.replicas || 0) <= 3) {
            const groupPos = getAbsPos(parent.id, nextNodes);
            nextNodes = nextNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
            const standalonePod = { 
              ...updatedNode, 
              parentId: undefined, 
              position: groupPos, 
              extent: undefined,
              data: { ...updatedNode.data, replicas: updatedData.replicas }
            };
            nextNodes = sortNodes([...nextNodes, standalonePod]);
          } else {
            const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 0, get, updatedNode);
            const otherNodes = nextNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id);
            nextNodes = sortNodes([...otherNodes, updatedDeployment, ...laidOut]);
          }
        }
      }
      else if (updatedNode.type === 'Deployment' || updatedNode.type === 'PodGroup') {
        const { updatedDeployment, laidOut } = syncDeployment(updatedNode, nextNodes, 0, get);
        const otherNodes = nextNodes.filter(n => n.id !== updatedNode.id && n.parentId !== updatedNode.id);
        nextNodes = sortNodes([...otherNodes, updatedDeployment, ...laidOut]);
      }

      return {
        nodes: nextNodes,
        lastActionId: `update-${Date.now()}`,
        lastActionName: 'Update Node Data'
      };
    });
  },

  onNodeClick: (event: React.MouseEvent, node: Node) => {
    set({ activeDeploymentId: node.type === 'Deployment' ? node.id : null });
  },

  onPaneClick: () => {
    set({ activeDeploymentId: null });
  },
});
