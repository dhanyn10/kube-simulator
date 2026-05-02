import { StateCreator } from 'zustand';
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

export interface FlowSlice {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => void;
}

export const createFlowSlice: StateCreator<FlowState, [], [], FlowSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  onConnect: (connection: Connection) => {
    set((state) => ({
      edges: addEdge({ ...connection, type: 'custom' }, state.edges),
    }));
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
