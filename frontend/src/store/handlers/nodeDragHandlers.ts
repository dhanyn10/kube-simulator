import { Node } from '@xyflow/react';
import { 
  getAbsPos, 
  isAllowed, 
  getNodeData, 
  sortNodes,
  resolveGlobalCollisions
} from '@/store/helpers';
import { syncDeployment, syncContainerSize } from '@/store/nodeHelpers';
import type { FlowState } from '@/store/types';
import { calculateOverlap, handlePodMoveToDeployment, handleGenericContainerMove } from './nodeDragUtils';
import { isNodeAccessForbidden } from '@/activities/nodes/rbacNodeHelpers';

/**
 * Determines the interaction relationship between a dragging node and a target container.
 *
 * @param node Dragging node
 * @param container Potential container node
 * @param intersects True if bounding boxes intersect
 * @param overlapPercentage Calculated overlap area percentage
 * @returns Status string ('detaching' | 'hovering') or null
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
 * Finds the container node that the dragging node is hovering over or detaching from.
 *
 * @param node Dragging node
 * @param nodeAbs Absolute top-left position of the dragging node
 * @param nodes Array of all canvas nodes
 * @returns Object containing `hoveredId` and `detachingId`
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
 * Applies new parent container assignment when dropping a node into a target container.
 *
 * @param node Node being dropped
 * @param nextNodes Canvas nodes array
 * @param hoveredId Target container node ID
 * @param absPos Absolute coordinates of the dropped node
 * @param get Store state getter
 * @param finalNode Final node object reference
 * @returns Updated array of canvas nodes
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
 * Applies container detachment logic when dragging a node outside its current parent container.
 *
 * @param node Detaching node
 * @param nextNodes Canvas nodes array
 * @param oldParentId Previous parent container ID
 * @param absPos Absolute coordinates of the node
 * @param get Store state getter
 * @returns Updated array of canvas nodes
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
  if (node.type === 'Role' && parent?.type === 'Namespace') {
    get().addLog('warn', '[Canvas Action] Cannot detach Role outside of a Namespace!', 'UI');
    return nextNodes.map(n => n.id === node.id ? { ...n, extent: 'parent' as const } : n);
  }
  return nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
};

/**
 * Applies internal position movement within the same parent container and resizes container accordingly.
 *
 * @param node Moving node
 * @param finalNode Node object with updated position
 * @param nextNodes Canvas nodes array
 * @param oldParentId Parent container ID
 * @param get Store state getter
 * @returns Updated array of canvas nodes
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
 * Handles overall drop parenting logic (re-parenting, detaching, or internal position movement).
 *
 * @param node Dropped node
 * @param finalNode Final node object state
 * @param nextNodes Canvas nodes array
 * @param hoveredId Hovered container ID if dropping inside
 * @param detachingId Detaching container ID if dropping outside
 * @param get Store state getter
 * @returns Reconciled array of canvas nodes
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

/**
 * Higher-order store handler managing node drag events on the canvas (drag start, drag movement, drag stop).
 *
 * @param set Zustand store state setter
 * @param get Zustand store state getter
 * @returns Object containing React Flow node drag event handlers
 */
export const dragHandlers = (set: any, get: () => FlowState) => ({
  /**
   * Triggered when a node drag interaction begins. Enforces RBAC permissions and tracks active deployment.
   */
  onNodeDragStart: (_event: any, node: Node) => {
    const store = get();
    if (isNodeAccessForbidden(store.activeIdentity, store.iamUsers || [], node.type, node.data, store.nodes)) {
      return;
    }
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

  /**
   * Triggered during active node dragging. Detects container hover and detachment states.
   */
  onNodeDrag: (_event: any, node: Node) => {
    const store = get();
    if (isNodeAccessForbidden(store.activeIdentity, store.iamUsers || [], node.type, node.data, store.nodes)) {
      return;
    }
    const { nodes } = store;
    
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

  /**
   * Triggered when a node drag stops. Resolves collisions, updates parenting, and logs action coordinates.
   */
  onNodeDragStop: (_event: any, node: Node) => {
    const store = get();
    if (isNodeAccessForbidden(store.activeIdentity, store.iamUsers || [], node.type, node.data, store.nodes)) {
      return;
    }
    const { detachingDeploymentId, hoveredDeploymentId } = store;

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
      const logMsg = `[Canvas Action] Moved card '${label}' (${finalNode.type}) to coordinates (x1:${x1}, y1:${y1}, x2:${x2}, y2:${y2}), size: ${w}x${h}px [Top-Left: (${x1}, ${y1}), Bottom-Right: (${x2}, ${y2})]`;
      get().addLog('info', logMsg, 'UI');

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
