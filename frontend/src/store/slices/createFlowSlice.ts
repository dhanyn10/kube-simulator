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
import { getAbsPos } from '../helpers';

export type QuickConnectDirection = 'top' | 'bottom' | 'left' | 'right';
export type LayoutDirection = 'LR' | 'TB';

export const syncRoleRulesFromConnections = (nodes: Node[], edges: Edge[]): Node[] => {
  const roleNodes = nodes.filter((n) => n.type === 'Role');
  if (roleNodes.length === 0) return nodes;

  let hasChanges = false;
  const updatedNodes = nodes.map((node) => {
    if (node.type !== 'Role') return node;

    const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
    const connectedNodeIds = new Set<string>();
    connectedEdges.forEach((e) => {
      if (e.source !== node.id) connectedNodeIds.add(e.source);
      if (e.target !== node.id) connectedNodeIds.add(e.target);
    });

    const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id));
    const derivedResourcesSet = new Set<string>();

    connectedNodes.forEach((cn) => {
      if (cn.type === 'Deployment') {
        derivedResourcesSet.add('deployments');
        const childPods = nodes.filter((p) => p.parentId === cn.id);
        if (childPods.length > 0 || ((cn.data?.replicas as number) || 0) > 0) {
          derivedResourcesSet.add('pods');
        }
      } else if (cn.type === 'Pod') {
        derivedResourcesSet.add('pods');
      } else if (cn.type === 'Service') {
        derivedResourcesSet.add('services');
      } else if (cn.type === 'PVC') {
        derivedResourcesSet.add('persistentvolumeclaims');
      } else if (cn.type === 'ConfigMap') {
        derivedResourcesSet.add('configmaps');
      } else if (cn.type === 'Secret') {
        derivedResourcesSet.add('secrets');
      } else if (cn.type === 'ReplicaSet') {
        derivedResourcesSet.add('replicasets');
      }
    });

    const currentRules = (node.data.rules as any[]) || [{ apiGroups: [''], resources: [], verbs: ['get', 'list', 'watch'] }];
    const firstRule = currentRules[0] || { apiGroups: [''], resources: [], verbs: ['get', 'list', 'watch'] };
    const currentResources = (firstRule.resources as string[]) || [];

    const newResources = Array.from(derivedResourcesSet);
    const isSame = currentResources.length === newResources.length && newResources.every((r) => currentResources.includes(r));
    if (isSame) return node;

    hasChanges = true;
    const updatedRule = { ...firstRule, resources: newResources };
    return {
      ...node,
      data: {
        ...node.data,
        rules: [updatedRule, ...currentRules.slice(1)],
      },
    };
  });

  return hasChanges ? updatedNodes : nodes;
};

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
  onQuickConnect: (nodeId: string, direction: QuickConnectDirection) => void;
  autoLayout: (direction?: LayoutDirection) => void;
}

const computeAutoLayout = (nodes: Node[], edges: Edge[], direction: LayoutDirection): Node[] => {
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

const getNodeAbsCenter = (node: Node, nodes: Node[]) => {
  const absPos = getAbsPos(node.id, nodes);
  return {
    x: absPos.x + (node.measured?.width || node.width || 150) / 2,
    y: absPos.y + (node.measured?.height || node.height || 100) / 2,
  };
};

const isNodeInDirection = (
  sourceNode: Node,
  targetNode: Node,
  direction: QuickConnectDirection,
  nodes: Node[]
): boolean => {
  if (targetNode.id === sourceNode.id) return false;
  if (getConnectionError(sourceNode.type || '', targetNode.type || '') !== null) return false;

  const sourceCenter = getNodeAbsCenter(sourceNode, nodes);
  const targetCenter = getNodeAbsCenter(targetNode, nodes);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (direction === 'right') return angle > -45 && angle <= 45;
  if (direction === 'bottom') return angle > 45 && angle <= 135;
  if (direction === 'left') return angle > 135 || angle <= -135;
  if (direction === 'top') return angle > -135 && angle <= -45;
  return false;
};

const getQuickConnectHandles = (direction: QuickConnectDirection) => {
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
    set((state) => {
      const nextNodes = applyNodeChanges([...changes, ...extraChanges], state.nodes);
      const syncedNodes = syncRoleRulesFromConnections(nextNodes, state.edges);
      return { nodes: syncedNodes };
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges);
      const syncedNodes = syncRoleRulesFromConnections(state.nodes, nextEdges);
      return { edges: nextEdges, nodes: syncedNodes };
    });
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

    set((state) => {
      const nextEdges = addEdge(newEdge, state.edges);
      const syncedNodes = syncRoleRulesFromConnections(state.nodes, nextEdges);
      return { edges: nextEdges, nodes: syncedNodes };
    });
  },
  onReconnect: (oldEdge: Edge, newConnection: Connection) => {
    const { edges, validateEdge } = get();
    const newEdges = edges.map((e) => (e.id === oldEdge.id ? validateEdge({ ...e, ...newConnection }) : e));
    set({ edges: newEdges });
  },
  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => {
    set((state) => {
      const syncedNodes = syncRoleRulesFromConnections(state.nodes, edges);
      return { edges, nodes: syncedNodes };
    });
  },
  onQuickConnect: (nodeId: string, direction: QuickConnectDirection) => {
    const { nodes, onConnect } = get();
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return;

    const candidates = nodes.filter((n) => isNodeInDirection(sourceNode, n, direction, nodes));
    if (candidates.length === 0) return;

    const sourceCenter = getNodeAbsCenter(sourceNode, nodes);

    candidates.sort((a, b) => {
      const centerA = getNodeAbsCenter(a, nodes);
      const centerB = getNodeAbsCenter(b, nodes);
      const distA = Math.pow(centerA.x - sourceCenter.x, 2) + Math.pow(centerA.y - sourceCenter.y, 2);
      const distB = Math.pow(centerB.x - sourceCenter.x, 2) + Math.pow(centerB.y - sourceCenter.y, 2);
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
