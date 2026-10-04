import { Node } from '@xyflow/react';
import { getAbsPos, getNodeData } from '@/store/helpers';
import { syncDeployment, syncContainerSize } from '@/store/nodeHelpers';
import type { FlowState } from '@/store/types';

/**
 * Calculates overlap percentage and checks intersection between a dragging node and a candidate container.
 *
 * @param node Dragging node
 * @param nodeAbs Calculated absolute coordinates of the dragging node
 * @param container Target container node
 * @param nodes Current array of canvas nodes
 * @returns Object containing `intersects` boolean flag and `overlapPercentage` number
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
 * Synchronizes and updates former parent deployment layout when a pod is removed or detached.
 *
 * @param parentId Former parent container node ID
 * @param currentNodes Array of canvas nodes
 * @param movingReplicas Replica count delta being removed
 * @param get Store state getter
 * @returns Updated array of canvas nodes
 */
const syncOldParentDeployment = (parentId: string, currentNodes: Node[], movingReplicas: number, get: () => FlowState) => {
  const oldParent = currentNodes.find(n => n.id === parentId);
  if (oldParent?.type === 'Deployment' || oldParent?.type === 'ReplicaSet') {
    const { updatedDeployment, laidOut } = syncDeployment(oldParent, currentNodes, -movingReplicas, get);
    const result = currentNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
    return [...result.map(n => n.id === parentId ? updatedDeployment : n), ...laidOut];
  }
  return currentNodes;
};

/**
 * Handles node structure updates when a pod is moved into a Deployment or ReplicaSet container.
 *
 * @param targetParentId Destination container node ID
 * @param targetParent Destination container node object
 * @param node Pod node being moved
 * @param nextNodes Current array of canvas nodes
 * @param oldParentId Previous container node ID if re-parenting
 * @param get Store state getter
 * @param finalNode Final node object reference
 * @returns Reconciled array of canvas nodes
 */
export const handlePodMoveToDeployment = (targetParentId: string, targetParent: Node, node: Node, nextNodes: Node[], oldParentId: string | undefined, get: () => FlowState, finalNode: Node) => {
  const movingReplicas = getNodeData(node).replicas || 1;
  const { updatedDeployment, laidOut } = syncDeployment(targetParent, nextNodes, movingReplicas, get, finalNode);

  let resultNodes = nextNodes.filter(n => (n.parentId !== targetParentId || n.type !== 'Pod') && n.id !== node.id);
  resultNodes = [...resultNodes.map(n => n.id === targetParentId ? updatedDeployment : n), ...laidOut];

  return oldParentId ? syncOldParentDeployment(oldParentId, resultNodes, movingReplicas, get) : resultNodes;
};

/**
 * Handles generic node movement into non-workload containers (such as Namespaces).
 *
 * @param targetParentId Target container node ID
 * @param node Node being moved
 * @param nextNodes Current array of canvas nodes
 * @param oldParentId Former container node ID if detaching/re-parenting
 * @param absPos Calculated absolute coordinates of the node
 * @param get Store state getter
 * @returns Reconciled array of canvas nodes
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
