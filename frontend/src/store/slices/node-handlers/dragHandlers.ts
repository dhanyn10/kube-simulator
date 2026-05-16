import { Node } from '@xyflow/react';
import { 
  getAbsPos, 
  isAllowed, 
  calculateAlignmentGuides, 
  getNodeData, 
  sortNodes,
  resolveGlobalCollisions
} from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';
import { FlowState } from '../../types';
import { calculateOverlap, handlePodMoveToDeployment, handleGenericContainerMove } from './dragUtils';

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

    if (node.parentId === container.id) {
      if (overlapPercentage < 20) detachingId = container.id;
      else if (!hoveredId) hoveredId = container.id;
    } else if (intersects && isAllowed(container.type || '', node.type || '')) {
      if (!hoveredId) hoveredId = container.id;
    }
  }
  return { hoveredId, detachingId };
};

/**
 * Calculates a snapped coordinate based on active alignment guides.
 */
const getSnappedCoord = (abs: number, size: number, guides: number[], parentAbs: number) => {
  if (guides.length === 0) return abs - parentAbs;
  
  const guide = guides.reduce((prev, curr) => {
    const dist = (v: number) => Math.min(Math.abs(abs - v), Math.abs(abs + size / 2 - v), Math.abs(abs + size - v));
    return dist(curr) < dist(prev) ? curr : prev;
  }, guides[0]);

  const dL = Math.abs(abs - guide), dC = Math.abs(abs + size / 2 - guide), dR = Math.abs(abs + size - guide);
  if (dL <= dC && dL <= dR) return guide - parentAbs;
  if (dR <= dL && dR <= dC) return guide - size - parentAbs;
  return guide - size / 2 - parentAbs;
};

/**
 * Handles the logic for re-parenting, detaching, or moving a node within its container after drop.
 */
const handleDropParenting = (node: Node, finalNode: Node, nextNodes: Node[], hoveredId: string | null, detachingId: string | null, get: () => FlowState) => {
  const oldParentId = node.parentId;
  const absPos = getAbsPos(node.id, nextNodes, finalNode);

  // Case 1: Drop into a new container
  if (hoveredId && hoveredId !== oldParentId) {
    const target = nextNodes.find(n => n.id === hoveredId);
    if (!target || !isAllowed(target.type || '', node.type || '')) {
      return nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
    }
    return target.type === 'Deployment' && node.type === 'Pod'
      ? handlePodMoveToDeployment(hoveredId, target, node, nextNodes, oldParentId, get, finalNode)
      : handleGenericContainerMove(hoveredId, node, nextNodes, oldParentId, absPos, get);
  }

  // Case 2: Detach from current container
  if (detachingId && oldParentId === detachingId) {
    const parent = nextNodes.find(n => n.id === oldParentId);
    if (parent?.type === 'Deployment' && node.type === 'Pod') {
      const movingReplicas = getNodeData(node).replicas || 1;
      const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, -movingReplicas, get);
      const filtered = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
      return [...filtered.map(n => n.id === oldParentId ? updatedDeployment : n), ...laidOut, { ...node, parentId: undefined, position: absPos, extent: undefined }];
    }
    return nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
  }

  // Case 3: Move within same container or fallback
  if (oldParentId) {
    const parent = nextNodes.find(n => n.id === oldParentId);
    if (parent?.type === 'Deployment' && node.type === 'Pod') {
      const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, 0, get, finalNode);
      const filtered = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
      nextNodes = [...filtered.map(n => n.id === oldParentId ? updatedDeployment : n), ...laidOut];
    } else {
      nextNodes = nextNodes.map(n => n.id === node.id ? { ...n, position: finalNode.position, extent: 'parent' as const } : n);
    }
    return syncContainerSize(oldParentId, nextNodes);
  }

  return nextNodes;
};

export const dragHandlers = (set: any, get: () => FlowState) => ({
  onNodeDragStart: (event: any, node: Node) => {
    get().setDraggedNodeId(node.id);
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

  onNodeDrag: (event: any, node: Node) => {
    const { nodes } = get();
    get().setDraggedNodeId(node.id);
    
    const nodeAbs = getAbsPos(node.id, nodes, node);
    const { hoveredId, detachingId } = findHoveredContainer(node, nodeAbs, nodes);

    const nextNodes = nodes.map((n: Node) => {
      if (n.type === 'Deployment' || n.type === 'Namespace') {
        return { ...n, data: { ...n.data, isHovered: n.id === hoveredId, isDetaching: n.id === detachingId } };
      }
      return n;
    });

    const { verticalGuides, horizontalGuides, vSnap, hSnap } = calculateAlignmentGuides(
      node, nodes, nodeAbs, detachingId !== null, hoveredId
    );

    set({ 
        hoveredDeploymentId: hoveredId, 
        detachingDeploymentId: detachingId,
        nodes: nextNodes,
        alignmentGuides: { vertical: verticalGuides, horizontal: horizontalGuides },
        snapGuides: {
            vertical: Array.from(vSnap).map(([pos, isActive]) => ({ position: pos, isActive })),
            horizontal: Array.from(hSnap).map(([pos, isActive]) => ({ position: pos, isActive })),
        }
    });
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes, detachingDeploymentId, hoveredDeploymentId } = get();

    set((state: FlowState) => {
      let nextNodes = [...state.nodes];
      const nodeWidth = node.width || node.measured?.width || 160;
      const nodeHeight = node.height || node.measured?.height || 80;

      const vSnaps = state.snapGuides.vertical.filter((g: any) => g.isActive).map((g: any) => g.position);
      const hSnaps = state.snapGuides.horizontal.filter((g: any) => g.isActive).map((g: any) => g.position);

      let finalNode = { ...node };
      
      // 1. Resolution Snapping
      if (vSnaps.length > 0 || hSnaps.length > 0) {
          const parentAbs = node.parentId ? getAbsPos(node.parentId, nextNodes) : { x: 0, y: 0 };
          const nodeAbs = { x: node.position.x + parentAbs.x, y: node.position.y + parentAbs.y };
          
          if (vSnaps.length > 0) finalNode.position.x = getSnappedCoord(nodeAbs.x, nodeWidth, vSnaps, parentAbs.x);
          if (hSnaps.length > 0) finalNode.position.y = getSnappedCoord(nodeAbs.y, nodeHeight, hSnaps, parentAbs.y);
      }

      // 2. Collision Detection
      nextNodes = nextNodes.map(n => n.id === node.id ? finalNode : n);
      if (!hoveredDeploymentId) {
        nextNodes = resolveGlobalCollisions(nextNodes, node.id);
        finalNode = nextNodes.find(n => n.id === node.id) || finalNode;
      }

      // 3. Parenting Logic
      nextNodes = handleDropParenting(node, finalNode, nextNodes, hoveredDeploymentId, detachingDeploymentId, get);

      return {
        hoveredDeploymentId: null,
        detachingDeploymentId: null,
        draggedNodeId: null,
        alignmentGuides: { vertical: [], horizontal: [] },
        snapGuides: { vertical: [], horizontal: [] },
        nodes: sortNodes(nextNodes.map(n => ({ ...n, data: { ...n.data, isHovered: false, isDetaching: false } }))),
        lastActionId: `drag-${Date.now()}`,
        lastActionName: 'Move Element'
      };
    });
  },
});
