import { Node, Edge } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { 
  getNodeData, 
  sortNodes, 
  getPodMinimumSize 
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
          get().updateNodeData(id, { label: cleanName, isAutoNamed: false });
        },
      },
    };

    if (type === 'Pod') {
       newNode.data.replicas = 1;
       const minSize = getPodMinimumSize(newNode.data);
       newNode.width = minSize.width;
       newNode.style = { width: minSize.width, minHeight: minSize.height };
    } else if (type === 'Deployment') {
       newNode.data.replicas = 0;
       newNode.width = 320;
       newNode.height = 160;
       newNode.style = { width: 320, height: 160 };
    } else if (type === 'Namespace') {
       newNode.width = 600;
       newNode.height = 400;
       newNode.style = { width: 600, height: 400 };
    }

    set((state: any) => {
      let nextNodes = [...state.nodes, newNode];
      
      if (parentId) {
        const parent = nextNodes.find(n => n.id === parentId);
        if (parent?.type === 'Deployment' && type === 'Pod') {
           const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 1, get, newNode);
           // Filter out existing pods and the new node to replace them with laid out ones
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
      let nextNodes = state.nodes.map((node: Node) => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, ...newData };
          if (node.type === 'Pod' && !updatedData.isManuallyResized) {
             const minSize = getPodMinimumSize(updatedData);
             return { 
               ...node, 
               data: updatedData, 
               width: minSize.width, 
               style: { ...node.style, width: minSize.width, minHeight: minSize.height } 
             };
          }
          return { ...node, data: updatedData };
        }
        return node;
      });

      const updatedNode = nextNodes.find((n: Node) => n.id === nodeId);
      if (!updatedNode) return { ...state };

      if (updatedNode.type === 'Deployment') {
        const { updatedDeployment, laidOut } = syncDeployment(updatedNode, nextNodes, 0, get);
        nextNodes = nextNodes.filter(n => n.parentId !== updatedNode.id || n.type !== 'Pod');
        nextNodes = [...nextNodes.map(n => n.id === updatedNode.id ? updatedDeployment : n), ...laidOut];
      } else if (updatedNode.type === 'Pod' && updatedNode.parentId) {
        const parentId = updatedNode.parentId;
        const parent = nextNodes.find(n => n.id === parentId);
        if (parent?.type === 'Deployment') {
           const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 0, get);
           nextNodes = nextNodes.filter(n => n.parentId !== parent.id || n.type !== 'Pod');
           nextNodes = [...nextNodes.map(n => n.id === parent.id ? updatedDeployment : n), ...laidOut];
        }
      }

      return { 
        nodes: nextNodes,
        lastActionId: `update-${Date.now()}`,
        lastActionName: newData.replicas !== undefined ? 'Update Replicas' : 'Update Node Data'
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
