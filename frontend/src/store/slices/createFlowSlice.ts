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
import { getConnectionError } from '../../constants/connections';

export interface FlowSlice {
  /** Array of active React Flow nodes present on the canvas */
  nodes: Node[];
  /** Array of active React Flow edges connecting canvas nodes */
  edges: Edge[];
  /** Handler triggered on node movements, dimensions, selection, or deletion changes */
  onNodesChange: (changes: NodeChange[]) => void;
  /** Handler triggered on edge addition, selection, or deletion changes */
  onEdgesChange: (changes: EdgeChange[]) => void;
  /** Establishes a connection between two node handles */
  onConnect: (connection: Connection) => void;
  /** Re-routes an existing edge connection from its previous handle to a new one */
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  /** Validates and decorates edge payload with specific Kubernetes connection errors */
  validateEdge: (edge: Edge) => Edge;
  /** Direct node list override setter */
  setNodes: (nodes: Node[]) => void;
  /** Direct edge list override setter */
  setEdges: (edges: Edge[]) => void;
  /** Keyboard/arrow action establishing connections in a specific orthogonal direction */
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => void;
  /** Arranges top-level nodes using Dagre hierarchically in LR (Left-Right) or TB (Top-Bottom) directions */
  autoLayout: (direction?: 'LR' | 'TB') => void;
}

export const createFlowSlice: StateCreator<FlowState, [], [], FlowSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  currentProject: null,
  /**
   * Arranges canvas layout automatically using Dagre.
   * Restricts processing to top-level node elements to ensure custom container layouts
   * (e.g., pods inside namespace or deployments) remain fully intact.
   */
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
  /**
   * Processes node mutations (such as dragging).
   * Supports smart drag-grouping: if a node has an active groupId, dragging it
   * will synchronously slide all other nodes in that group.
   */
  onNodesChange: (changes: NodeChange[]) => {
    const { nodes } = get();
    const extraChanges: NodeChange[] = [];
    const processedGroupIds = new Set<string>();

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const change of changes) {
      if (change.type !== 'position' || !change.position) continue;

      const node = nodeMap.get(change.id);
      const groupId = node?.data?.groupId as string;
      if (!groupId || processedGroupIds.has(groupId)) continue;

      const dx = change.position.x - node!.position.x;
      const dy = change.position.y - node!.position.y;
      if (dx === 0 && dy === 0) continue;

      processedGroupIds.add(groupId);

      const changeIds = new Set(changes.filter(c => c.type === 'position').map(c => c.id));

      for (const other of nodes) {
        if (other.data?.groupId === groupId && other.id !== node.id && !changeIds.has(other.id)) {
          extraChanges.push({
            id: other.id,
            type: 'position',
            position: {
              x: other.position.x + dx,
              y: other.position.y + dy
            }
          });
        }
      }
    }

    set((state) => ({
      nodes: applyNodeChanges([...changes, ...extraChanges], state.nodes),
    }));
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  /**
   * Matches connection sources and targets against valid Kubernetes integration architectures
   * (e.g. HPA -> Deployment is valid; Service -> HPA is invalid) and records errors.
   */
  validateEdge: (edge: Edge) => {
    const { nodes } = get();
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return edge;

    const error = getConnectionError(sourceNode.type || '', targetNode.type || '');
    return {
      ...edge,
      data: {
        ...edge.data,
        validationError: error
      }
    };
  },
  onConnect: (connection: Connection) => {
    const { nodes, updateNodeData, validateEdge } = get();
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

    const newEdge = validateEdge({
      ...connection,
      id: `e${connection.source}-${connection.target}-${Date.now()}`,
      type: 'custom',
      source: connection.source!,
      target: connection.target!,
    } as Edge);

    set((state) => ({
      edges: addEdge(newEdge, state.edges),
    }));
  },
  onReconnect: (oldEdge: Edge, newConnection: Connection) => {
    const { edges, validateEdge } = get();
    const newEdges = edges.map((e) => {
      if (e.id === oldEdge.id) {
        return validateEdge({ ...e, ...newConnection });
      }
      return e;
    });
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
