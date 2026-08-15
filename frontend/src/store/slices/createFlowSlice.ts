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
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  validateEdge: (edge: Edge) => Edge;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => void;
  autoLayout: (direction?: 'LR' | 'TB') => void;
}

const computeAutoLayout = (nodes: Node[], edges: Edge[], direction: 'LR' | 'TB'): Node[] => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 200 });

  const topLevelNodes = nodes.filter((n) => !n.parentId);

  topLevelNodes.forEach((node) => {
    const width = node.measured?.width || node.width || 150;
    const height = node.measured?.height || node.height || 100;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    if (topLevelNodes.some((n) => n.id === edge.source) && topLevelNodes.some((n) => n.id === edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    if (node.parentId) return node;
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
  });
};

const getGroupDragExtraChanges = (changes: NodeChange[], nodes: Node[]): NodeChange[] => {
  const extraChanges: NodeChange[] = [];
  const processedGroupIds = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const changeIds = new Set(changes.filter((c) => c.type === 'position').map((c) => c.id));

  for (const change of changes) {
    if (change.type !== 'position' || !change.position) continue;
    const node = nodeMap.get(change.id);
    const groupId = node?.data?.groupId as string;
    if (!groupId || processedGroupIds.has(groupId)) continue;

    const dx = change.position.x - node!.position.x;
    const dy = change.position.y - node!.position.y;
    if (dx === 0 && dy === 0) continue;

    processedGroupIds.add(groupId);

    for (const other of nodes) {
      if (other.data?.groupId === groupId && other.id !== node.id && !changeIds.has(other.id)) {
        extraChanges.push({
          id: other.id,
          type: 'position',
          position: {
            x: other.position.x + dx,
            y: other.position.y + dy,
          },
        });
      }
    }
  }
  return extraChanges;
};

const getNodeCenter = (node: Node) => ({
  x: node.position.x + (node.measured?.width || node.width || 150) / 2,
  y: node.position.y + (node.measured?.height || node.height || 100) / 2,
});

const isNodeInDirection = (
  sourceNode: Node,
  targetNode: Node,
  direction: 'top' | 'bottom' | 'left' | 'right'
): boolean => {
  if (targetNode.id === sourceNode.id || targetNode.parentId) return false;
  if (sourceNode.type === 'HPA' && targetNode.type !== 'Deployment') return false;

  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (direction === 'right') return angle > -45 && angle <= 45;
  if (direction === 'bottom') return angle > 45 && angle <= 135;
  if (direction === 'left') return angle > 135 || angle <= -135;
  if (direction === 'top') return angle > -135 && angle <= -45;
  return false;
};

const getQuickConnectHandles = (direction: 'top' | 'bottom' | 'left' | 'right') => {
  if (direction === 'right') return { sourceHandle: 'right-s', targetHandle: 'left-t' };
  if (direction === 'left') return { sourceHandle: 'left-s', targetHandle: 'right-t' };
  if (direction === 'top') return { sourceHandle: 'top-s', targetHandle: 'bottom-t' };
  return { sourceHandle: 'bottom-s', targetHandle: 'top-t' };
};

export const createFlowSlice: StateCreator<FlowState, [], [], FlowSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  autoLayout: (direction = 'LR') => {
    const nextNodes = computeAutoLayout(get().nodes, get().edges, direction);
    set({
      nodes: nextNodes,
      lastActionId: `layout-${Date.now()}`,
      lastActionName: 'Auto Layout',
    });
  },
  onNodesChange: (changes: NodeChange[]) => {
    const extraChanges = getGroupDragExtraChanges(changes, get().nodes);
    set((state) => ({
      nodes: applyNodeChanges([...changes, ...extraChanges], state.nodes),
    }));
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  validateEdge: (edge: Edge) => {
    const { nodes } = get();
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const error = getConnectionError(sourceNode.type || '', targetNode.type || '');
    return {
      ...edge,
      data: { ...edge.data, validationError: error },
    };
  },
  onConnect: (connection: Connection) => {
    const { nodes, updateNodeData, validateEdge } = get();
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    if (sourceNode?.type === 'HPA' && targetNode?.type === 'Deployment') {
      const data = targetNode.data as K8sNodeData;
      if (!data.cpuRequest || !data.memoryRequest) {
        updateNodeData(targetNode.id, {
          cpuRequest: data.cpuRequest || '100m',
          memoryRequest: data.memoryRequest || '128Mi',
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
    const newEdges = edges.map((e) => (e.id === oldEdge.id ? validateEdge({ ...e, ...newConnection }) : e));
    set({ edges: newEdges });
  },
  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => {
    const { nodes, onConnect } = get();
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    const candidates = nodes.filter((n) => isNodeInDirection(sourceNode, n, direction));
    if (candidates.length === 0) return;

    candidates.sort((a, b) => {
      const distA = Math.pow(a.position.x - sourceNode.position.x, 2) + Math.pow(a.position.y - sourceNode.position.y, 2);
      const distB = Math.pow(b.position.x - sourceNode.position.x, 2) + Math.pow(b.position.y - sourceNode.position.y, 2);
      return distA - distB;
    });

    const targetNode = candidates[0];
    const { sourceHandle, targetHandle } = getQuickConnectHandles(direction);

    onConnect({
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle,
      targetHandle,
    });
    set({
      lastActionId: `connect-${Date.now()}`,
      lastActionName: 'Connect Nodes',
    });
  },
});
