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
    
    const nodeWidth = node.width || node.measured?.width || 160;
    const nodeHeight = node.height || node.measured?.height || 80;
    
    const nodeAbs = getAbsPos(node.id, nodes, node);
    
    let newHoveredDeploymentId: string | null = null;
    let newDetachingDeploymentId: string | null = null;
    const podArea = nodeWidth * nodeHeight;

    let nextNodes = nodes.map((n: Node) => {
      if (n.type === 'Deployment' || n.type === 'Namespace') {
        return { ...n, data: { ...n.data, isHovered: false, isDetaching: false } };
      }
      return n;
    });

    const containers = nodes.filter((n: Node) => n.type === 'Deployment' || n.type === 'Namespace');
    const sortedContainers = [...containers].sort((a, b) => {
      const areaA = (a.width || 320) * (a.height || 160);
      const areaB = (b.width || 320) * (b.height || 160);
      return areaA - areaB;
    });

    for (const container of sortedContainers) {
        if (container.id === node.id) continue;
        const { intersects, overlapPercentage } = calculateOverlap(node, nodeAbs, container, nodes);

        if (node.parentId === container.id) {
            if (overlapPercentage < 20) { 
                newDetachingDeploymentId = container.id;
                nextNodes = nextNodes.map((n: Node) => n.id === container.id ? { ...n, data: { ...n.data, isDetaching: true } } : n);
            } else if (!newHoveredDeploymentId) {
                newHoveredDeploymentId = container.id;
                nextNodes = nextNodes.map((n: Node) => n.id === container.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
            }
        } else if (intersects && isAllowed(container.type || '', node.type || '')) {
            if (!newHoveredDeploymentId) {
                newHoveredDeploymentId = container.id;
                nextNodes = nextNodes.map((n: Node) => n.id === container.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
            }
        }
    }

    const { verticalGuides, horizontalGuides, vSnap: verticalSnapGuides, hSnap: horizontalSnapGuides } = calculateAlignmentGuides(
      node, 
      nodes, 
      nodeAbs, 
      newDetachingDeploymentId !== null,
      newHoveredDeploymentId
    );

    set({ 
        hoveredDeploymentId: newHoveredDeploymentId, 
        detachingDeploymentId: newDetachingDeploymentId,
        nodes: nextNodes, // Back to normal nextNodes
        alignmentGuides: {
            vertical: verticalGuides,
            horizontal: horizontalGuides,
        },
        snapGuides: {
            vertical: Array.from(verticalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
            horizontal: Array.from(horizontalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
        }
    });
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes, snapGuides, detachingDeploymentId, hoveredDeploymentId } = get();

    set((state: FlowState) => {
      let nextNodes = [...state.nodes];
      const nodeWidth = node.width || node.measured?.width || 160;
      const nodeHeight = node.height || node.measured?.height || 80;

      const activeVerticalSnaps = state.snapGuides.vertical.filter((g: any) => g.isActive).map((g: any) => g.position);
      const activeHorizontalSnaps = state.snapGuides.horizontal.filter((g: any) => g.isActive).map((g: any) => g.position);

      let finalNode = { ...node };
      
      // 1. Resolution Snapping (Alignment Guides)
      if (activeVerticalSnaps.length > 0 || activeHorizontalSnaps.length > 0) {
          const parentAbs = node.parentId ? getAbsPos(node.parentId, nextNodes) : { x: 0, y: 0 };
          const nodeAbs = { x: node.position.x + parentAbs.x, y: node.position.y + parentAbs.y };
          
          if (activeVerticalSnaps.length > 0) {
              const guide = activeVerticalSnaps.reduce((prev: any, curr: any) => 
                Math.min(Math.abs(nodeAbs.x - curr), Math.abs(nodeAbs.x + nodeWidth/2 - curr), Math.abs(nodeAbs.x + nodeWidth - curr)) < 
                Math.min(Math.abs(nodeAbs.x - prev), Math.abs(nodeAbs.x + nodeWidth/2 - prev), Math.abs(nodeAbs.x + nodeWidth - prev)) ? curr : prev
              , activeVerticalSnaps[0]);

              const dLeft = Math.abs(nodeAbs.x - guide);
              const dCenter = Math.abs((nodeAbs.x + nodeWidth / 2) - guide);
              const dRight = Math.abs((nodeAbs.x + nodeWidth) - guide);
              
              if (dLeft <= dCenter && dLeft <= dRight) {
                  finalNode.position.x = guide - parentAbs.x;
              } else if (dRight <= dLeft && dRight <= dCenter) {
                  finalNode.position.x = (guide - nodeWidth) - parentAbs.x;
              } else {
                  finalNode.position.x = (guide - nodeWidth / 2) - parentAbs.x;
              }
          }
          if (activeHorizontalSnaps.length > 0) {
              const guide = activeHorizontalSnaps.reduce((prev: any, curr: any) => 
                Math.min(Math.abs(nodeAbs.y - curr), Math.abs(nodeAbs.y + nodeHeight/2 - curr), Math.abs(nodeAbs.y + nodeHeight - curr)) < 
                Math.min(Math.abs(nodeAbs.y - prev), Math.abs(nodeAbs.y + nodeHeight/2 - prev), Math.abs(nodeAbs.y + nodeHeight - prev)) ? curr : prev
              , activeHorizontalSnaps[0]);

              const dTop = Math.abs(nodeAbs.y - guide);
              const dCenter = Math.abs((nodeAbs.y + nodeHeight / 2) - guide);
              const dBottom = Math.abs((nodeAbs.y + nodeHeight) - guide);
              
              if (dTop <= dCenter && dTop <= dBottom) {
                  finalNode.position.y = guide - parentAbs.y;
              } else if (dBottom <= dTop && dBottom <= dCenter) {
                  finalNode.position.y = (guide - nodeHeight) - parentAbs.y;
              } else {
                  finalNode.position.y = (guide - nodeHeight / 2) - parentAbs.y;
              }
          }
      }

      // 2. Collision Detection (Prevent Overlap)
      nextNodes = nextNodes.map(n => n.id === node.id ? finalNode : n);
      if (!hoveredDeploymentId) {
        nextNodes = resolveGlobalCollisions(nextNodes, node.id);
        finalNode = nextNodes.find(n => n.id === node.id) || finalNode;
      }

      const targetParentId = hoveredDeploymentId;
      const targetParent = targetParentId ? nextNodes.find(n => n.id === targetParentId) : null;
      
      const stateNode = nextNodes.find(n => n.id === node.id);
      const oldParentId = stateNode?.parentId;
      
      const absPos = getAbsPos(node.id, nextNodes, finalNode);

      if (targetParentId && targetParent && targetParentId !== oldParentId) {
        if (isAllowed(targetParent.type || '', node.type || '')) {
          if (targetParent.type === 'Deployment' && node.type === 'Pod') {
            nextNodes = handlePodMoveToDeployment(targetParentId, targetParent, node, nextNodes, oldParentId, get, finalNode);
          } else {
            nextNodes = handleGenericContainerMove(targetParentId, node, nextNodes, oldParentId, absPos, get);
          }
        } else {
          nextNodes = nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
        }
      } else if (detachingDeploymentId && oldParentId === detachingDeploymentId) {
        const parentId = oldParentId;
        const parent = nextNodes.find(n => n.id === parentId);
        
        if (parent?.type === 'Deployment' && node.type === 'Pod') {
          const movingReplicas = getNodeData(node).replicas || 1;
          const { updatedDeployment: uOld, laidOut: lOld } = syncDeployment(parent, nextNodes, -movingReplicas, get);
          
          const detachedNode = { ...node, parentId: undefined, position: absPos, extent: undefined };
          nextNodes = nextNodes.filter(n => (n.parentId !== parentId || n.type !== 'Pod') && n.id !== node.id);
          nextNodes = [...nextNodes.map(n => n.id === parentId ? uOld : n), ...lOld, detachedNode];
        } else {
          nextNodes = nextNodes.map(n => n.id === node.id ? { ...n, parentId: undefined, position: absPos, extent: undefined } : n);
        }
      } else if (oldParentId && targetParentId === oldParentId) {
        const parent = nextNodes.find(n => n.id === oldParentId);
        if (parent?.type === 'Deployment' && node.type === 'Pod') {
            // Re-use current replicasChange=0 logic for internal move
            let replicasChange = 0;
            const { updatedDeployment, laidOut } = syncDeployment(parent, nextNodes, replicasChange, get, finalNode);
            nextNodes = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
            nextNodes = [...nextNodes.map(n => n.id === oldParentId ? updatedDeployment : n), ...laidOut];
            // Sync grandparent and allow expansion
            nextNodes = syncContainerSize(oldParentId, nextNodes);
        } else {
            // For Namespace internal move or other components
            nextNodes = nextNodes.map(n => n.id === node.id ? { ...n, position: finalNode.position, extent: 'parent' as const } : n);
            nextNodes = syncContainerSize(oldParentId, nextNodes);
        }
      } else if (oldParentId && !targetParentId && !detachingDeploymentId) {
        // Fallback for when it's still child but outside
        nextNodes = nextNodes.map(n => n.id === node.id ? { ...n, position: finalNode.position, extent: 'parent' as const } : n);
        nextNodes = syncContainerSize(oldParentId, nextNodes);
      }

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
