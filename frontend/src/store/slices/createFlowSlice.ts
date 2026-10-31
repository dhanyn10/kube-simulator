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
import type { FlowState } from '@/store/types';
import { getConnectionError } from '@/constants/connections';
import { getAbsPos, ejectLoadBalancersFromNamespaces } from '@/store/helpers';
import { safeRandom } from '@/lib/utils';
import {
  emitLiveEdgeCreatedCommand,
  emitLiveEdgeDeletedCommand,
} from '@/activities/terminal/liveUpdateCommands';
import { isNodeAccessForbidden } from '@/activities/nodes/rbacNodeHelpers';
import { hasResourceLimitAttachedOrConnected } from '@/activities/nodes/resourceLimitHelpers';
import { evaluatePvcRealtimeStatus } from '@/activities/config/pvcConfigHelpers';
import { syncDeployment, syncContainerSize } from '@/store/nodeHelpers';

export type QuickConnectDirection = 'top' | 'bottom' | 'left' | 'right';
export type LayoutDirection = 'LR' | 'TB';

const NODE_TYPE_TO_RESOURCE: Record<string, string> = {
  Pod: 'pods',
  Service: 'services',
  PVC: 'persistentvolumeclaims',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  ReplicaSet: 'replicasets',
  StatefulSet: 'statefulsets',
};

const WORKLOAD_CONTROLLERS = new Set(['Deployment', 'StatefulSet', 'ReplicaSet']);

const collectRemovedIngressServices = (
  ingressId: string,
  removedEdges: Edge[],
  allNodes: Node[]
): Set<string> => {
  const labels = new Set<string>();
  for (const edge of removedEdges) {
    if (edge.source !== ingressId) continue;
    const tNode = allNodes.find((n) => n.id === edge.target);
    if (tNode?.type === 'Service') {
      labels.add(String(tNode.data?.label || tNode.id));
    }
  }
  return labels;
};

const clearRemovedIngressServicesFromPaths = (
  rawPaths: any[] | undefined,
  removedLabels: Set<string>
): any[] | undefined => {
  if (!Array.isArray(rawPaths)) return rawPaths;
  return rawPaths.map((p) => (removedLabels.has(p?.serviceName) ? { ...p, serviceName: '' } : p));
};

const reconcileIngressOnRemovedEdges = (
  node: Node,
  removedEdges: Edge[],
  allNodes: Node[]
): Node => {
  if (node.type !== 'Ingress' || removedEdges.length === 0) return node;

  const removedLabels = collectRemovedIngressServices(node.id, removedEdges, allNodes);
  if (removedLabels.size === 0) return node;

  const currentBackend = String(node.data?.backendServiceName || '');
  const rawPaths = node.data?.ingressPaths as any[] | undefined;
  const hasPathsMatch = Array.isArray(rawPaths) && rawPaths.some((p) => removedLabels.has(p?.serviceName));
  const hasBackendMatch = removedLabels.has(currentBackend);

  if (!hasBackendMatch && !hasPathsMatch) return node;

  const updatedPaths = clearRemovedIngressServicesFromPaths(rawPaths, removedLabels);
  const firstRemainingService = Array.isArray(updatedPaths) ? updatedPaths.find((p) => p?.serviceName)?.serviceName : '';

  return {
    ...node,
    data: {
      ...node.data,
      ...(hasBackendMatch ? { backendServiceName: String(firstRemainingService || '') } : {}),
      ...(hasPathsMatch ? { ingressPaths: updatedPaths } : {}),
    },
  };
};

const isServiceEdgeMatching = (
  edge: Edge,
  serviceNodeId: string,
  currentSelector: string,
  allNodes: Node[]
): boolean => {
  if (edge.source !== serviceNodeId) return false;
  const target = allNodes.find((n) => n.id === edge.target);
  if (!target) return false;
  const tLabel = (target.data?.label as string) || (target.data?.baseName as string) || target.id;
  return tLabel === currentSelector;
};

const reconcileServiceOnEdgeChange = (
  node: Node,
  nextEdges: Edge[],
  allNodes: Node[]
): Node => {
  const rawIngressTargets = node.data?.ingressTargets as string[] | undefined;
  if (Array.isArray(rawIngressTargets) && rawIngressTargets.length > 0) {
    const remainingTargets = rawIngressTargets.filter((lbl) =>
      nextEdges.some((e) => isServiceEdgeMatching(e, node.id, lbl, allNodes))
    );
    return {
      ...node,
      data: {
        ...node.data,
        selector: remainingTargets[0] || '',
        ingressTargets: remainingTargets.length > 0 ? remainingTargets : undefined,
      },
    };
  }

  if (node.data?.selector) {
    const currentSelector = String(node.data.selector);
    const hasMatch = nextEdges.some((e) => isServiceEdgeMatching(e, node.id, currentSelector, allNodes));
    if (!hasMatch) {
      return { ...node, data: { ...node.data, selector: '' } };
    }
  }
  return node;
};

const reconcileNodeOnEdgeChange = (
  node: Node,
  removedEdgeObjects: Edge[],
  nextEdges: Edge[],
  allNodes: Node[]
): Node => {
  if (node.type === 'Ingress') {
    return reconcileIngressOnRemovedEdges(node, removedEdgeObjects, allNodes);
  }
  if (node.type === 'Service') {
    return reconcileServiceOnEdgeChange(node, nextEdges, allNodes);
  }
  return node;
};

const emitRemovedEdgeCommands = (removeChanges: EdgeChange[], nodes: Node[], edges: Edge[]) => {
  for (const c of removeChanges) {
    if (!('id' in c)) continue;
    const removedEdge = edges.find((e) => e.id === c.id);
    if (!removedEdge) continue;
    const sNode = nodes.find((n) => n.id === removedEdge.source);
    const tNode = nodes.find((n) => n.id === removedEdge.target);
    const sLabel = (sNode?.data?.label as string) || removedEdge.source;
    const tLabel = (tNode?.data?.label as string) || removedEdge.target;
    emitLiveEdgeDeletedCommand(sLabel, tLabel);
  }
};

const buildConnectedIngressData = (
  currentData: Record<string, any> | undefined,
  targetNodeInStore: Node | undefined,
  tgtId: string
): Record<string, any> => {
  const data = currentData || {};
  const targetLabel = (targetNodeInStore?.data?.label as string) || targetNodeInStore?.id || tgtId;
  const targetPort = Number(targetNodeInStore?.data?.port) || 80;
  const existingBackend = data.backendServiceName as string | undefined;
  const existingPaths = Array.isArray(data.ingressPaths) ? (data.ingressPaths as any[]) : [];

  if (existingPaths.length > 0) {
    const alreadyExists = existingPaths.some((p) => p?.serviceName === targetLabel);
    if (alreadyExists) {
      return {
        ...data,
        backendServiceName: existingBackend || targetLabel,
      };
    }
    return {
      ...data,
      backendServiceName: existingBackend || targetLabel,
      ingressPaths: [
        ...existingPaths,
        {
          id: safeRandom().toString(36).slice(2, 9),
          path: `/path-${existingPaths.length + 1}`,
          serviceName: targetLabel,
          servicePort: targetPort,
        },
      ],
    };
  }

  if (existingBackend && existingBackend !== targetLabel) {
    const primaryPath = (data.ingressPath as string) || '/';
    const primaryPort = Number(data.servicePort) || 80;
    return {
      ...data,
      ingressPaths: [
        {
          id: safeRandom().toString(36).slice(2, 9),
          path: primaryPath,
          serviceName: existingBackend,
          servicePort: primaryPort,
        },
        {
          id: safeRandom().toString(36).slice(2, 9),
          path: '/path-2',
          serviceName: targetLabel,
          servicePort: targetPort,
        },
      ],
    };
  }

  return {
    ...data,
    backendServiceName: targetLabel,
    servicePort: targetPort,
  };
};

const getDerivedResourcesForNode = (cn: Node, nodes: Node[], derivedResourcesSet: Set<string>) => {
  if (cn.type === 'Deployment' || cn.type === 'StatefulSet') {
    derivedResourcesSet.add(cn.type === 'StatefulSet' ? 'statefulsets' : 'deployments');
    const childPods = nodes.filter((p) => p.parentId === cn.id);
    if (childPods.length > 0 || ((cn.data?.replicas as number) || 0) > 0) {
      derivedResourcesSet.add('pods');
    }
    return;
  }
  const resourceName = cn.type ? NODE_TYPE_TO_RESOURCE[cn.type] : undefined;
  if (resourceName) {
    derivedResourcesSet.add(resourceName);
  }
};

const getConnectedNodesForRole = (roleNodeId: string, nodes: Node[], edges: Edge[]): Node[] => {
  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => {
    if (e.source === roleNodeId) connectedNodeIds.add(e.target);
    else if (e.target === roleNodeId) connectedNodeIds.add(e.source);
  });
  return nodes.filter((n) => connectedNodeIds.has(n.id));
};

export const syncRoleRulesFromConnections = (nodes: Node[], edges: Edge[]): Node[] => {
  const roleNodes = nodes.filter((n) => n.type === 'Role');
  if (roleNodes.length === 0) return nodes;

  let hasChanges = false;
  const updatedNodes = nodes.map((node) => {
    if (node.type !== 'Role') return node;

    const connectedNodes = getConnectedNodesForRole(node.id, nodes, edges);
    const derivedResourcesSet = new Set<string>();
    connectedNodes.forEach((cn) => getDerivedResourcesForNode(cn, nodes, derivedResourcesSet));

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

const collectGroupMemberMoves = (
  groupId: string,
  draggedNodeId: string,
  dx: number,
  dy: number,
  nodes: Node[],
  changeIds: Set<string>
): NodeChange[] => {
  const moves: NodeChange[] = [];
  for (const other of nodes) {
    if (other.data?.groupId === groupId && other.id !== draggedNodeId && !changeIds.has(other.id)) {
      moves.push({
        id: other.id,
        type: 'position',
        position: {
          x: other.position.x + dx,
          y: other.position.y + dy,
        },
      });
    }
  }
  return moves;
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

    const dx = change.position.x - node.position.x;
    const dy = change.position.y - node.position.y;
    if (dx === 0 && dy === 0) continue;

    processedGroupIds.add(groupId);
    extraChanges.push(...collectGroupMemberMoves(groupId, node.id, dx, dy, nodes, changeIds));
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
  if (getConnectionError(sourceNode.type || '', targetNode.type || '', sourceNode.data, targetNode.data) !== null) return false;

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

const rerouteRoleConnection = (
  podNode: Node | undefined,
  nodes: Node[]
): Node | undefined => {
  if (podNode?.type === 'Pod' && podNode.parentId) {
    return nodes.find((n) => n.id === podNode.parentId && (n.type === 'Deployment' || n.type === 'StatefulSet'));
  }
  return undefined;
};

const rerouteChildPodConnection = (
  podNode: Node | undefined,
  nodes: Node[]
): Node | undefined => {
  if (podNode?.type === 'Pod' && (podNode.parentId || podNode.data?.parentId)) {
    const parentId = String(podNode.parentId || podNode.data?.parentId);
    return nodes.find((n) => n.id === parentId && (n.type === 'Deployment' || n.type === 'StatefulSet' || n.type === 'ReplicaSet'));
  }
  return undefined;
};

const checkHpaPrerequisite = (
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[],
  edges: Edge[],
  addLog: (level: string, message: string, component: string) => void
): boolean => {
  const isHpaConnection =
    (sourceNode?.type === 'HPA' && ['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet'].includes(targetNode?.type || '')) ||
    (targetNode?.type === 'HPA' && ['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet'].includes(sourceNode?.type || ''));

  if (!isHpaConnection) return true;

  const workloadNode = sourceNode?.type === 'HPA' ? targetNode : sourceNode;
  const hasLimit = hasResourceLimitAttachedOrConnected(workloadNode, nodes, edges);
  if (!hasLimit) {
    addLog(
      'error',
      `[HPA Prerequisite] Cannot connect HPA to ${workloadNode?.data?.label || workloadNode?.id}. Resource Limit is required on target workload before attaching HPA.`,
      'UI'
    );
    return false;
  }
  return true;
};

const filterAllowedNodeChanges = (
  changes: NodeChange[],
  nodes: Node[],
  activeIdentity: string,
  iamUsers: any[]
): NodeChange[] => {
  return changes.filter((change) => {
    if (change.type !== 'position' || !change.id) return true;
    const targetNode = nodes.find((n) => n.id === change.id);
    if (!targetNode) return true;
    return !isNodeAccessForbidden(activeIdentity, iamUsers, targetNode.type, targetNode.data, nodes);
  });
};

const syncParentContainersOnDimensionChange = (
  allowedChanges: NodeChange[],
  nextNodes: Node[],
  get: () => FlowState
): Node[] => {
  const hasDimensionChanges = allowedChanges.some((c) => c.type === 'dimensions');
  if (!hasDimensionChanges) return nextNodes;

  const parentIds = new Set<string>();
  for (const c of allowedChanges) {
    if (c.type === 'dimensions' && c.id) {
      const node = nextNodes.find((n) => n.id === c.id);
      if (node?.parentId) parentIds.add(node.parentId);
    }
  }
  if (parentIds.size === 0) return nextNodes;

  let containerSyncedNodes = nextNodes;
  for (const parentId of parentIds) {
    const parent = containerSyncedNodes.find((n) => n.id === parentId);
    const isController = Boolean(parent?.type && WORKLOAD_CONTROLLERS.has(parent.type));
    if (isController && parent) {
      const { updatedDeployment, laidOut } = syncDeployment(parent, containerSyncedNodes, 0, get);
      const others = containerSyncedNodes.filter((n) => n.id !== parent.id && n.parentId !== parent.id);
      containerSyncedNodes = [...others, updatedDeployment, ...laidOut];
    } else if (parentId) {
      containerSyncedNodes = syncContainerSize(parentId, containerSyncedNodes);
    }
  }
  return containerSyncedNodes;
};

const rerouteConnectionEndpoints = (
  initialSourceId: string,
  initialTargetId: string,
  nodes: Node[]
): { sourceId: string; targetId: string; sourceNode?: Node; targetNode?: Node } => {
  let sourceId = initialSourceId;
  let targetId = initialTargetId;
  let sourceNode = nodes.find((n) => n.id === sourceId);
  let targetNode = nodes.find((n) => n.id === targetId);

  const sourceChildParent = rerouteChildPodConnection(sourceNode, nodes);
  if (sourceChildParent) {
    sourceId = sourceChildParent.id;
    sourceNode = sourceChildParent;
  }

  const targetChildParent = rerouteChildPodConnection(targetNode, nodes);
  if (targetChildParent) {
    targetId = targetChildParent.id;
    targetNode = targetChildParent;
  }

  if (sourceNode?.type === 'Role') {
    const parentDep = rerouteRoleConnection(targetNode, nodes);
    if (parentDep) {
      targetId = parentDep.id;
      targetNode = parentDep;
    }
  } else if (targetNode?.type === 'Role') {
    const parentDep = rerouteRoleConnection(sourceNode, nodes);
    if (parentDep) {
      sourceId = parentDep.id;
      sourceNode = parentDep;
    }
  }

  return { sourceId, targetId, sourceNode, targetNode };
};

interface ConnectedNodeSyncContext {
  syncedNodesList: Node[];
  edgesList: Edge[];
  srcId: string;
  tgtId: string;
  srcNode?: Node;
  tgtNode?: Node;
}

const isValidServiceSelectorTarget = (
  serviceData: Record<string, any> | undefined,
  targetType: string
): boolean => {
  if (['deployment', 'statefulset', 'pod', 'replicaset'].includes(targetType)) {
    return true;
  }
  const serviceType = String(serviceData?.serviceType || 'ClusterIP');
  return targetType === 'ingress' && serviceType === 'LoadBalancer';
};

const buildConnectedServiceData = (
  currentData: Record<string, any> | undefined,
  targetNodeInStore: Node | undefined,
  tgtId: string,
  targetType: string,
  allNodes: Node[]
): Record<string, any> => {
  const data = currentData || {};
  const targetLabel =
    (targetNodeInStore?.data?.label as string) ||
    (targetNodeInStore?.data?.baseName as string) ||
    targetNodeInStore?.id ||
    tgtId;

  if (targetType === 'ingress') {
    const existingList = Array.isArray(data.ingressTargets) ? (data.ingressTargets as string[]) : [];
    const currentSel = String(data.selector || '');
    const isCurrentSelIngress = Boolean(
      currentSel &&
      allNodes.some((item) => item.type === 'Ingress' && ((item.data?.label as string) || item.id) === currentSel)
    );
    const fallbackTargets = isCurrentSelIngress ? [currentSel] : [];
    const baseTargets = existingList.length > 0 ? existingList : fallbackTargets;
    const nextTargets = baseTargets.includes(targetLabel) ? baseTargets : [...baseTargets, targetLabel];
    return {
      ...data,
      selector: nextTargets[0] || targetLabel,
      ingressTargets: nextTargets,
    };
  }

  const workloadPort = Number(targetNodeInStore?.data?.port);
  return {
    ...data,
    selector: targetLabel,
    ...(data.ingressTargets !== undefined ? { ingressTargets: undefined } : {}),
    ...(workloadPort ? { targetPort: workloadPort } : {}),
  };
};

const updateConnectedNodeState = (
  n: Node,
  ctx: ConnectedNodeSyncContext
): Node => {
  const { syncedNodesList, edgesList, srcId, tgtId, srcNode, tgtNode } = ctx;
  let updated = n;

  if (updated.type === 'PVC') {
    const realTimeStatus = evaluatePvcRealtimeStatus(updated, syncedNodesList, edgesList);
    if (updated.data?.pvcStatus !== realTimeStatus) {
      updated = { ...updated, data: { ...updated.data, pvcStatus: realTimeStatus } };
    }
  }

  if (updated.id === srcId) {
    const sType = String(updated.type || updated.data?.type || srcNode?.type || '').toLowerCase();
    const targetNodeInStore = syncedNodesList.find((item) => item.id === tgtId);
    const tType = String(targetNodeInStore?.type || targetNodeInStore?.data?.type || tgtNode?.type || '').toLowerCase();

    if (sType === 'ingress' && tType === 'service') {
      updated = {
        ...updated,
        data: buildConnectedIngressData(updated.data, targetNodeInStore, tgtId),
      };
    } else if (sType === 'service' && isValidServiceSelectorTarget(updated.data, tType)) {
      updated = {
        ...updated,
        data: buildConnectedServiceData(updated.data, targetNodeInStore, tgtId, tType, syncedNodesList),
      };
    }
  }

  return updated;
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
    const { nodes, activeIdentity, iamUsers } = get();
    const allowedChanges = filterAllowedNodeChanges(changes, nodes, activeIdentity, iamUsers || []);
    const extraChanges = getGroupDragExtraChanges(allowedChanges, nodes);

    set((state) => {
      const nextNodes = applyNodeChanges([...allowedChanges, ...extraChanges], state.nodes);
      const containerSyncedNodes = syncParentContainersOnDimensionChange(allowedChanges, nextNodes, get);
      const syncedNodes = syncRoleRulesFromConnections(containerSyncedNodes, state.edges);
      return { nodes: syncedNodes };
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    const { nodes, edges } = get();
    const removeChanges = changes.filter((c) => c.type === 'remove');
    emitRemovedEdgeCommands(removeChanges, nodes, edges);

    set((state) => {
      const nextEdges = applyEdgeChanges(changes, state.edges);
      let syncedNodes = syncRoleRulesFromConnections(state.nodes, nextEdges);

      const removedEdgeObjects = removeChanges
        .map((c) => ('id' in c ? state.edges.find((e) => e.id === c.id) : undefined))
        .filter((e): e is Edge => Boolean(e));

      syncedNodes = syncedNodes.map((node) =>
        reconcileNodeOnEdgeChange(node, removedEdgeObjects, nextEdges, state.nodes)
      );

      const isRemoval = removeChanges.length > 0;
      return {
        edges: nextEdges,
        nodes: syncedNodes,
        ...(isRemoval ? {
          lastActionId: `edge-remove-${Date.now()}`,
          lastActionName: 'Delete Edge',
        } : {}),
      };
    });
  },
  validateEdge: (edge: Edge) => {
    const { nodes } = get();
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return edge;

    const error = getConnectionError(sourceNode.type || '', targetNode.type || '', sourceNode.data, targetNode.data);
    return {
      ...edge,
      data: { ...edge.data, validationError: error },
    };
  },
  onConnect: (connection: Connection) => {
    const { nodes, validateEdge, activeIdentity, iamUsers, addLog } = get();
    const initialSourceNode = nodes.find((n) => n.id === connection.source);
    const initialTargetNode = nodes.find((n) => n.id === connection.target);

    if (
      isNodeAccessForbidden(activeIdentity, iamUsers || [], initialSourceNode?.type, initialSourceNode?.data, nodes) ||
      isNodeAccessForbidden(activeIdentity, iamUsers || [], initialTargetNode?.type, initialTargetNode?.data, nodes)
    ) {
      addLog('warn', `[API Server Auth] Connection rejected: User "${activeIdentity}" cannot connect forbidden card(s).`, 'UI');
      return;
    }

    const { sourceId, targetId, sourceNode, targetNode } = rerouteConnectionEndpoints(
      connection.source!,
      connection.target!,
      nodes
    );

    if (!checkHpaPrerequisite(sourceNode, targetNode, nodes, get().edges, addLog)) {
      return;
    }

    const newEdge = validateEdge({
      ...connection,
      id: `e${sourceId}-${targetId}-${Date.now()}`,
      type: 'custom',
      source: sourceId,
      target: targetId,
    } as Edge);

    let isAdded = false;
    set((state) => {
      if (state.edges.some((e) => e.source === sourceId && e.target === targetId)) return state;

      isAdded = true;
      const nextEdges = addEdge(newEdge, state.edges);
      let syncedNodes = syncRoleRulesFromConnections(state.nodes, nextEdges);

      syncedNodes = syncedNodes.map((n) =>
        updateConnectedNodeState(n, {
          syncedNodesList: syncedNodes,
          edgesList: nextEdges,
          srcId: sourceId,
          tgtId: targetId,
          srcNode: sourceNode,
          tgtNode: targetNode,
        })
      );

      return {
        edges: nextEdges,
        nodes: syncedNodes,
        lastActionId: `connect-${Date.now()}`,
        lastActionName: 'Connect Nodes',
      };
    });

    if (isAdded) {
      const sLabel = (sourceNode?.data?.label as string) || sourceId;
      const tLabel = (targetNode?.data?.label as string) || targetId;
      emitLiveEdgeCreatedCommand(sLabel, tLabel);
    }
  },
  onReconnect: (oldEdge: Edge, newConnection: Connection) => {
    const { edges, validateEdge } = get();
    const newEdges = edges.map((e) => (e.id === oldEdge.id ? validateEdge({ ...e, ...newConnection }) : e));
    set({ edges: newEdges });
  },
  setNodes: (nodes: Node[]) => set({ nodes: ejectLoadBalancersFromNamespaces(nodes).nodes }),
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
