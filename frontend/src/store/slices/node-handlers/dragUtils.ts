import { Node } from '@xyflow/react';
import { getAbsPos, isAllowed, getNodeData } from '../../helpers';
import { syncDeployment, syncContainerSize } from '../../nodeHelpers';
import { FlowState } from '../../types';

/**
 * Calculates overlap percentage and checks intersection between a node and a container.
 */
export const calculateOverlap = (node: Node, nodeAbs: any, container: Node, nodes: Node[]) => {
  const nodeWidth = node.width || node.measured?.width || 160;
  const nodeHeight = node.height || node.measured?.height || 80;
  const podArea = nodeWidth * nodeHeight;

  const contAbs = getAbsPos(container.id, nodes);
  const contWidth = container.width || container.measured?.width || (container.type === 'Deployment' ? 320 : 600);
  const contHeight = container.height || container.measured?.height || (container.type === 'Deployment' ? 160 : 400);

  const overlapX = Math.max(0, Math.min(nodeAbs.x + nodeWidth, contAbs.x + contWidth) - Math.max(nodeAbs.x, contAbs.x));
  const overlapY = Math.max(0, Math.min(nodeAbs.y + nodeHeight, contAbs.y + contHeight) - Math.max(nodeAbs.y, contAbs.y));
  const overlapArea = overlapX * overlapY;

  return {
    intersects: overlapArea > 0,
    overlapPercentage: (overlapArea / podArea) * 100
  };
};

/**
 * Syncs old parent deployment when a pod is removed from it.
 */
const syncOldParentDeployment = (parentId: string, currentNodes: Node[], movingReplicas: number, get: () => FlowState) => {
  const oldParent = currentNodes.find(n => n.id === parentId);
  if (oldParent?.type === 'Deployment') {
    const { updatedDeployment, laidOut } = syncDeployment(oldParent, currentNodes, -movingReplicas, get);
    const result = currentNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
    return [...result.map(n => n.id === parentId ? updatedDeployment : n), ...laidOut];
  }
  return currentNodes;
};

/**
 * Handles the logic when a pod is moved into a deployment.
 */
export const handlePodMoveToDeployment = (targetParentId: string, targetParent: Node, node: Node, nextNodes: Node[], oldParentId: string | undefined, get: () => FlowState, finalNode: Node) => {
  const movingReplicas = getNodeData(node).replicas || 1;
  const { updatedDeployment, laidOut } = syncDeployment(targetParent, nextNodes, movingReplicas, get, finalNode);

  let resultNodes = nextNodes.filter(n => (n.parentId !== targetParentId || n.type !== 'Pod') && n.id !== node.id);
  resultNodes = [...resultNodes.map(n => n.id === targetParentId ? updatedDeployment : n), ...laidOut];

  return oldParentId ? syncOldParentDeployment(oldParentId, resultNodes, movingReplicas, get) : resultNodes;
};

/**
 * Handles generic node move between containers.
 */
export const handleGenericContainerMove = (targetParentId: string, node: Node, nextNodes: Node[], oldParentId: string | undefined, absPos: any, get: () => FlowState) => {
  let resultNodes = nextNodes.map(n => {
    if (n.id === node.id) {
        const targetParentAbs = getAbsPos(targetParentId, nextNodes);
        return { ...n, parentId: targetParentId, position: { x: absPos.x - targetParentAbs.x, y: absPos.y - targetParentAbs.y }, extent: 'parent' as const };
    }
    return n;
  });

  resultNodes = syncContainerSize(targetParentId, resultNodes);

  if (oldParentId && node.type === 'Pod') {
    const movingReplicas = getNodeData(node).replicas || 1;
    resultNodes = syncOldParentDeployment(oldParentId, resultNodes, movingReplicas, get);
  }
  return resultNodes;
};
