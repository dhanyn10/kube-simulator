import { Node } from '@xyflow/react';
import { 
  getAbsPos, 
  isAllowed, 
  getNodeData, 
  sortNodes,
  resolveGlobalCollisions
} from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';
import { FlowState } from '../../types';
import { calculateOverlap, handlePodMoveToDeployment, handleGenericContainerMove } from './dragUtils';

/**
 * Determines the relationship between a node and a potential container.
 */
const getRelationshipStatus = (node: Node, container: Node, intersects: boolean, overlapPercentage: number) => {
  if (node.parentId === container.id) {
    return overlapPercentage < 20 ? 'detaching' : 'hovering';
  }
  if (intersects && isAllowed(container.type || '', node.type || '')) {
    return 'hovering';
  }
  return null;
};

/**
 * Finds the container that the node is currently hovering over or detaching from.
 */
const findHoveredContainer = (node: Node, nodeAbs: { x: number, y: number }, nodes: Node[]) => {
  const containers = nodes.filter(n => n.type === 'Deployment' || n.type === 'Namespace')
    .sort((a, b) => ((a.width || 320) * (a.height || 160)) - ((b.width || 320) * (b.height || 160)));

  let hoveredId: string | null = null;
  let detachingId: string | null = null;

  for (const container of containers) {
    if (container.id === node.id) continue;
    
    const { intersects, overlapPercentage } = calculateOverlap(node, nodeAbs, container, nodes);
    const status = getRelationshipStatus(node, container, intersects, overlapPercentage);

    if (status === 'detaching') {
      detachingId = container.id;
    } else if (status === 'hovering' && !hoveredId) {
      hoveredId = container.id;
    }
  }
  return { hoveredId, detachingId };
};


/**
 * Case 1: Drop into a new container
 */
const applyNewParent = (node: Node, nextNodes: Node[], hoveredId: string, absPos: { x: number, y: number }, get: () => FlowState, finalNode: Node) => {
  const target = nextNodes.find(n => n.id === hoveredId);
  if (!target || !isAllowed(target.type || '', node.type || '')) {
    return nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
  }
  return target.type === 'Deployment' && node.type === 'Pod'
    ? handlePodMoveToDeployment(hoveredId, target, node, nextNodes, node.parentId, get, finalNode)
    : handleGenericContainerMove(hoveredId, node, nextNodes, node.parentId, absPos, get);
};

/**
 * Case 2: Detach from current container
 */
const applyDetachment = (node: Node, nextNodes: Node[], oldParentId: string, absPos: { x: number, y: number }, get: () => FlowState) => {
  const parent = nextNodes.find(n => n.id === oldParentId);
  if ((parent?.type === 'Deployment' || parent?.type === 'ReplicaSet') && node.type === 'Pod') {
    const movingReplicas = getNodeData(node).replicas || 1;
    const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -movingReplicas, get);
    const filtered = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
    return [
      ...filtered.map(n => n.id === oldParentId ? updatedDeployment : n),
      ...laidOut,
      { ...node, parentId: undefined, position: absPos, extent: undefined }
    ];
  }
  return nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
};

/**
 * Case 3: Move within same container or fallback
 */
const applyInternalMove = (node: Node, finalNode: Node, nextNodes: Node[], oldParentId: string, get: () => FlowState) => {
  const parent = nextNodes.find(n => n.id === oldParentId);
  let resultNodes: Node[];
  
  if ((parent?.type === 'Deployment' || parent?.type === 'ReplicaSet') && node.type === 'Pod') {
    const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 0, get, finalNode);
    const filtered = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
    resultNodes = [...filtered.map(n => n.id === oldParentId ? updatedDeployment : n), ...laidOut];
  } else {
    resultNodes = nextNodes.map(n => n.id === node.id ? { ...n, position: finalNode.position, extent: 'parent' as const } : n);
  }
  
  return syncContainerSize(oldParentId, resultNodes);
};

/**
 * Handles the logic for re-parenting, detaching, or moving a node within its container after drop.
 */
const handleDropParenting = (node: Node, finalNode: Node, nextNodes: Node[], hoveredId: string | null, detachingId: string | null, get: () => FlowState) => {
  const oldParentId = node.parentId;
  const absPos = getAbsPos(node.id, nextNodes, finalNode);

  if (hoveredId && hoveredId !== oldParentId) {
    return applyNewParent(node, nextNodes, hoveredId, absPos, get, finalNode);
  }

  if (detachingId && oldParentId === detachingId) {
    return applyDetachment(node, nextNodes, oldParentId, absPos, get);
  }

  if (oldParentId) {
    return applyInternalMove(node, finalNode, nextNodes, oldParentId, get);
  }

  return nextNodes;
};

export const dragHandlers = (set: any, get: () => FlowState) => ({
  onNodeDragStart: (_event: any, node: Node) => {
    set({ draggedNodeId: node.id });
    if (node.type === 'Deployment') {
      get().setActiveDeploymentId(node.id);
    } else {
      get().setActiveDeploymentId(null);
    }
    
    if (node.parentId) {
      set((state: FlowState) => ({
        nodes: state.nodes.map((n: Node) => n.id === node.id ? { ...n, extent: undefined } : n)
      }));
    }
  },

  onNodeDrag: (_event: any, node: Node) => {
    const { nodes } = get();
    
    const nodeAbs = getAbsPos(node.id, nodes, node);
    const { hoveredId, detachingId } = findHoveredContainer(node, nodeAbs, nodes);

    const nextNodes = nodes.map((n: Node) => {
      if (n.type === 'Deployment' || n.type === 'Namespace') {
        return { ...n, data: { ...n.data, isHovered: n.id === hoveredId, isDetaching: n.id === detachingId } };
      }
      return n;
    });

    set({ 
        draggedNodeId: node.id,
        hoveredDeploymentId: hoveredId, 
        detachingDeploymentId: detachingId,
        nodes: nextNodes
    });
  },

  onNodeDragStop: (_event: any, node: Node) => {
    const { detachingDeploymentId, hoveredDeploymentId } = get();

    set((state: FlowState) => {
      let nextNodes = [...state.nodes];
      let finalNode = { ...node };

      // 1. Collision Detection
      nextNodes = nextNodes.map(n => n.id === node.id ? finalNode : n);
      if (!hoveredDeploymentId) {
        nextNodes = resolveGlobalCollisions(nextNodes, node.id);
        finalNode = nextNodes.find(n => n.id === node.id) || finalNode;
      }

      // 2. Parenting Logic
      nextNodes = handleDropParenting(node, finalNode, nextNodes, hoveredDeploymentId, detachingDeploymentId, get);

      const pos = getAbsPos(node.id, nextNodes, finalNode);
      const x1 = Math.round(pos.x);
      const y1 = Math.round(pos.y);
      const w = Math.round(finalNode.width || finalNode.measured?.width || 150);
      const h = Math.round(finalNode.height || finalNode.measured?.height || 100);
      const x2 = x1 + w;
      const y2 = y1 + h;
      const label = finalNode.data?.label || finalNode.id;
      get().addActivityLog?.(`[Canvas Action] Moved card '${label}' (${finalNode.type}) to coordinates (x1:${x1}, y1:${y1}, x2:${x2}, y2:${y2}), size: ${w}x${h}px [Top-Left: (${x1}, ${y1}), Bottom-Right: (${x2}, ${y2})]`);

      return {
        draggedNodeId: null,
        hoveredDeploymentId: null,
        detachingDeploymentId: null,
        nodes: sortNodes(nextNodes.map(n => ({ ...n, data: { ...n.data, isHovered: false, isDetaching: false } }))),
        lastActionId: `drag-${Date.now()}`,
        lastActionName: 'Move Element'
      };
    });
  },
});
