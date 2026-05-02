import { Node } from '@xyflow/react';
import { 
  getAbsPos, 
  isAllowed, 
  calculateAlignmentGuides, 
  getNodeData, 
  sortNodes 
} from '../../helpers';
import { syncDeployment } from '../../nodeHelpers';

export const dragHandlers = (set: any, get: any) => ({
  onNodeDragStart: (event: any, node: Node) => {
    get().setDraggedNodeId(node.id);
    if (node.type === 'Deployment') {
      get().setActiveDeploymentId(node.id);
    } else {
      get().setActiveDeploymentId(null);
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

        const contAbs = getAbsPos(container.id, nodes);
        const contWidth = container.width || container.measured?.width || (container.type === 'Deployment' ? 320 : 600);
        const contHeight = container.height || container.measured?.height || (container.type === 'Deployment' ? 160 : 400);

        const overlapX = Math.max(0, Math.min(nodeAbs.x + nodeWidth, contAbs.x + contWidth) - Math.max(nodeAbs.x, contAbs.x));
        const overlapY = Math.max(0, Math.min(nodeAbs.y + nodeHeight, contAbs.y + contHeight) - Math.max(nodeAbs.y, contAbs.y));
        const overlapArea = overlapX * overlapY;
        const overlapPercentage = (overlapArea / podArea) * 100;
        const intersects = overlapArea > 0;

        if (node.parentId === container.id) {
            if (overlapPercentage < 50) {
                newDetachingDeploymentId = container.id;
                nextNodes = nextNodes.map((n: Node) => n.id === container.id ? { ...n, data: { ...n.data, isDetaching: true } } : n);
            } else {
                newHoveredDeploymentId = container.id;
            }
        } else if (intersects && isAllowed(container.type || '', node.type || '')) {
            newHoveredDeploymentId = container.id;
            nextNodes = nextNodes.map((n: Node) => n.id === container.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
        }
    }

    const { verticalGuides, horizontalGuides, vSnap: verticalSnapGuides, hSnap: horizontalSnapGuides } = calculateAlignmentGuides(node, nodes, nodeAbs, newDetachingDeploymentId !== null);

    set({ 
        hoveredDeploymentId: newHoveredDeploymentId, 
        detachingDeploymentId: newDetachingDeploymentId,
        nodes: nextNodes,
        alignmentGuides: {
            vertical: Array.from(verticalGuides).map(pos => ({ position: pos })),
            horizontal: Array.from(horizontalGuides).map(pos => ({ position: pos })),
        },
        snapGuides: {
            vertical: Array.from(verticalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
            horizontal: Array.from(horizontalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
        }
    });
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes, snapGuides, detachingDeploymentId, hoveredDeploymentId } = get();

    set((state: any) => {
      let nextNodes = [...state.nodes];
      const nodeWidth = node.width || node.measured?.width || 160;
      const nodeHeight = node.height || node.measured?.height || 80;

      const activeVerticalSnaps = state.snapGuides.vertical.filter((g: any) => g.isActive).map((g: any) => g.position);
      const activeHorizontalSnaps = state.snapGuides.horizontal.filter((g: any) => g.isActive).map((g: any) => g.position);

      let finalNode = { ...node };
      if (activeVerticalSnaps.length > 0) {
          finalNode.position.x = activeVerticalSnaps[0] - nodeWidth / 2;
      }
      if (activeHorizontalSnaps.length > 0) {
          finalNode.position.y = activeHorizontalSnaps[0] - nodeHeight / 2;
      }
      
      nextNodes = nextNodes.map(n => n.id === node.id ? finalNode : n);

      const targetParentId = hoveredDeploymentId;
      const targetParent = targetParentId ? nextNodes.find(n => n.id === targetParentId) : null;
      
      const stateNode = nextNodes.find(n => n.id === node.id);
      const oldParentId = stateNode?.parentId;
      
      const absPos = getAbsPos(node.id, nextNodes, finalNode);

      if (targetParentId && targetParent && targetParentId !== oldParentId) {
        if (isAllowed(targetParent.type || '', node.type || '')) {
          if (targetParent.type === 'Deployment' && node.type === 'Pod') {
            const movingReplicas = getNodeData(node).replicas || 1;
            const { updatedDeployment, laidOut } = syncDeployment(targetParent, nextNodes, movingReplicas, get, finalNode);

            nextNodes = nextNodes.filter(n => (n.parentId !== targetParentId || n.type !== 'Pod') && n.id !== node.id);
            nextNodes = [...nextNodes.map(n => n.id === targetParentId ? updatedDeployment : n), ...laidOut];

            if (oldParentId) {
              const oldParent = nextNodes.find(n => n.id === oldParentId);
              if (oldParent?.type === 'Deployment') {
                const { updatedDeployment: uOld, laidOut: lOld } = syncDeployment(oldParent, nextNodes, -movingReplicas, get);
                nextNodes = nextNodes.filter(n => n.parentId !== oldParentId || n.type !== 'Pod');
                nextNodes = [...nextNodes.map(n => n.id === oldParentId ? uOld : n), ...lOld];
              }
            }
          } else {
            const targetAbsPos = getAbsPos(targetParentId, nextNodes);
            const relativePos = { x: absPos.x - targetAbsPos.x, y: absPos.y - targetAbsPos.y };
            
            nextNodes = nextNodes.map(n => n.id === node.id ? { ...n, parentId: targetParentId, position: relativePos, extent: 'parent' as const } : n);

            if (oldParentId) {
              const oldParent = nextNodes.find(n => n.id === oldParentId);
              if (oldParent?.type === 'Deployment' && node.type === 'Pod') {
                 const movingReplicas = getNodeData(node).replicas || 1;
                 const { updatedDeployment: uOld, laidOut: lOld } = syncDeployment(oldParent, nextNodes, -movingReplicas, get);
                 nextNodes = nextNodes.filter(n => n.parentId !== oldParentId || n.type !== 'Pod');
                 nextNodes = [...nextNodes.map(n => n.id === oldParentId ? uOld : n), ...lOld];
              }
            }
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
