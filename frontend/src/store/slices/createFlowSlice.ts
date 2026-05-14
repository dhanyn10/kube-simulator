import { StateCreator } from 'zustand';
import dagre from 'dagre';
import {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import { FlowState } from '../types';
import { K8sNodeData } from '../../types';

export interface FlowSlice {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => void;
  autoLayout: (direction?: 'LR' | 'TB') => void;
}

export const createFlowSlice: StateCreator<FlowState, [], [], FlowSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  currentProject: null,
  autoLayout: (direction = 'LR') => {
    const { nodes, edges } = get();
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 200 });

    // Only layout top-level nodes to preserve child layouts
    const topLevelNodes = nodes.filter(n => !n.parentId);

    topLevelNodes.forEach((node) => {
      const width = node.measured?.width || node.width || 150;
      const height = node.measured?.height || node.height || 100;
      dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
      // Only include edges where both source and target are top-level or their parents are top-level
      // Simplification: only use edges between top-level nodes for the main layout
      if (topLevelNodes.some(n => n.id === edge.source) && topLevelNodes.some(n => n.id === edge.target)) {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    });

    dagre.layout(dagreGraph);

    const nextNodes = nodes.map((node) => {
      if (!node.parentId) {
        const nodeWithPosition = dagreGraph.node(node.id);
        const width = node.measured?.width || node.width || 150;
        const height = node.measured?.height || node.height || 100;
        
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          },
        };
      }
      return node;
    });

    set({ 
      nodes: nextNodes,
      lastActionId: `layout-${Date.now()}`,
      lastActionName: 'Auto Layout'
    });
  },
  onNodesChange: (changes: NodeChange[]) => {
    const { nodes } = get();
    let extraChanges: NodeChange[] = [];

    // Coordinating movement for grouped nodes
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        const node = nodes.find(n => n.id === change.id);
        if (node?.data?.groupId) {
          const groupId = node.data.groupId;
          const dx = change.position.x - node.position.x;
          const dy = change.position.y - node.position.y;

          if (dx !== 0 || dy !== 0) {
            // Find other group members not already in the change set
            const others = nodes.filter(n => 
              n.data?.groupId === groupId && 
              n.id !== node.id && 
              !changes.some(c => c.type === 'position' && c.id === n.id)
            );

            others.forEach(other => {
              extraChanges.push({
                id: other.id,
                type: 'position',
                position: {
                  x: other.position.x + dx,
                  y: other.position.y + dy
                }
              });
            });
          }
        }
      }
    });

    set((state) => ({
      nodes: applyNodeChanges([...changes, ...extraChanges], state.nodes),
    }));
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  onConnect: (connection: Connection) => {
    const { nodes, edges, updateNodeData } = get();
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    // If HPA is connected to Deployment, ensure target has resource requests
    if (sourceNode?.type === 'HPA' && targetNode?.type === 'Deployment') {
      const data = targetNode.data as K8sNodeData;
      if (!data.cpuRequest || !data.memoryRequest) {
        updateNodeData(targetNode.id, {
          cpuRequest: data.cpuRequest || '100m',
          memoryRequest: data.memoryRequest || '128Mi'
        });
      }
    }

    set((state) => ({
      edges: addEdge({ ...connection, type: 'custom' }, state.edges),
    }));
  },
  onReconnect: (oldEdge: Edge, newConnection: Connection) => {
    const { edges } = get();
    const newEdges = edges.map((e) => (e.id === oldEdge.id ? { ...e, ...newConnection } : e));
    set({ edges: newEdges });
  },
  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => {
    const { nodes, onConnect } = get();
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    const getCenter = (node: Node) => ({
      x: node.position.x + (node.measured?.width || node.width || 150) / 2,
      y: node.position.y + (node.measured?.height || node.height || 100) / 2,
    });

    const sourceCenter = getCenter(sourceNode);

    // Find candidate nodes in the given direction
    const candidates = nodes.filter((n) => {
      if (n.id === nodeId) return false;
      if (n.parentId) return false; 
      
      const targetCenter = getCenter(n);

      const dx = targetCenter.x - sourceCenter.x;
      const dy = targetCenter.y - sourceCenter.y;

      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // If source is HPA, target MUST be Deployment
      if (sourceNode.type === 'HPA' && n.type !== 'Deployment') return false;

      if (direction === 'right') return angle > -45 && angle <= 45;
      if (direction === 'bottom') return angle > 45 && angle <= 135;
      if (direction === 'left') return angle > 135 || angle <= -135;
      if (direction === 'top') return angle > -135 && angle <= -45;
      
      return false;
    });

    if (candidates.length === 0) return;

    // Sort by distance
    candidates.sort((a, b) => {
        const distA = Math.pow(a.position.x - sourceNode.position.x, 2) + Math.pow(a.position.y - sourceNode.position.y, 2);
        const distB = Math.pow(b.position.x - sourceNode.position.x, 2) + Math.pow(b.position.y - sourceNode.position.y, 2);
        return distA - distB;
    });

    const targetNode = candidates[0];

    // Determine handles based on direction
    let sourceHandle = '';
    let targetHandle = '';

    if (direction === 'right') {
      sourceHandle = 'right-s';
      targetHandle = 'left-t';
    } else if (direction === 'left') {
      sourceHandle = 'left-s';
      targetHandle = 'right-t';
    } else if (direction === 'top') {
      sourceHandle = 'top-s';
      targetHandle = 'bottom-t';
    } else if (direction === 'bottom') {
      sourceHandle = 'bottom-s';
      targetHandle = 'top-t';
    }

    onConnect({
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle,
        targetHandle,
    });
    set({
      lastActionId: `connect-${Date.now()}`,
      lastActionName: 'Connect Nodes'
    });
  },
});
