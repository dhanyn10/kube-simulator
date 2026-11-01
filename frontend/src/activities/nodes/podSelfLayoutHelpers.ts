import { useEffect } from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '@/store';
import { isChildPodOf, syncDeployment } from '@/store/nodeHelpers';
import { getPodMinimumSize } from '@/lib/podSizing';
import { K8sNodeData } from '@/types';
import type { FlowState } from '@/store/types';

const WORKLOAD_CONTROLLERS = new Set(['Deployment', 'StatefulSet', 'ReplicaSet']);

// Map to debounce simultaneous auto-adjustments for the same workload controller
const lastAdjustmentTimestamp = new Map<string, number>();

/**
 * Calculates effective bounding box for a Pod node.
 *
 * @param pod - Pod canvas node
 * @returns Bounding box with x, y, width, and height
 */
export const getPodEffectiveBounds = (pod: Node): { x: number; y: number; width: number; height: number } => {
  const data = (pod.data as unknown as K8sNodeData) || {};
  const minSize = getPodMinimumSize(data);
  const width = pod.width || pod.measured?.width || minSize.width;
  const height = pod.height || pod.measured?.height || minSize.height;
  return {
    x: pod.position.x,
    y: pod.position.y,
    width,
    height,
  };
};

/**
 * Evaluates whether two sibling pod canvas nodes are overlapping or stacked.
 *
 * @param podA - First sibling pod node
 * @param podB - Second sibling pod node
 * @returns Boolean indicating collision or stacking
 */
export const isPodOverlappingWithSibling = (podA: Node, podB: Node): boolean => {
  if (podA.id === podB.id) return false;
  const bA = getPodEffectiveBounds(podA);
  const bB = getPodEffectiveBounds(podB);

  // 1. Exact or near-identical coordinates (e.g., stacked at {x: 25, y: 80})
  const isNearlySamePos = Math.abs(bA.x - bB.x) < 5 && Math.abs(bA.y - bB.y) < 5;
  if (isNearlySamePos) return true;

  // 2. 2D Bounding Box AABB intersection
  return (
    bA.x < bB.x + bB.width - 4 &&
    bA.x + bA.width > bB.x + 4 &&
    bA.y < bB.y + bB.height - 4 &&
    bA.y + bA.height > bB.y + 4
  );
};

/**
 * Checks whether a given Pod node is inside a workload controller and overlapping with any sibling Pod.
 *
 * @param podId - Canvas node ID of the target Pod
 * @param allNodes - Array of all active canvas nodes
 * @returns Object with boolean `hasOverlap` flag and `parentNode` reference
 */
export const checkPodOverlapWithSiblings = (
  podId: string,
  allNodes: Node[]
): { hasOverlap: boolean; parentNode: Node | null } => {
  const currentPod = allNodes.find((n) => n.id === podId);
  if (!currentPod || currentPod.type !== 'Pod') {
    return { hasOverlap: false, parentNode: null };
  }

  const parentId = currentPod.parentId ?? (currentPod.data as any)?.parentId;
  if (!parentId) {
    return { hasOverlap: false, parentNode: null };
  }

  const parentNode = allNodes.find((n) => n.id === parentId);
  if (!parentNode || !WORKLOAD_CONTROLLERS.has(parentNode.type || '')) {
    return { hasOverlap: false, parentNode: null };
  }

  const siblingPods = allNodes.filter((n) => n.id !== podId && isChildPodOf(n, parentId));
  const hasOverlap = siblingPods.some((sibling) => isPodOverlappingWithSibling(currentPod, sibling));

  return { hasOverlap, parentNode };
};

/**
 * Performs immediate Yoga layout auto-adjustment on a workload controller and its child pods.
 *
 * @param parentNode - Workload controller node (Deployment, ReplicaSet, StatefulSet)
 * @param get - FlowStore state getter
 * @param set - FlowStore state setter
 * @returns Boolean indicating whether layout updates were applied
 */
export const autoAdjustWorkloadPodLayout = (
  parentNode: Node,
  get: () => FlowState,
  set: (patch: Partial<FlowState>) => void
): boolean => {
  const state = get();
  if (state.draggedNodeId) return false;

  const now = Date.now();
  const lastTime = lastAdjustmentTimestamp.get(parentNode.id) || 0;
  if (now - lastTime < 50) return false;
  lastAdjustmentTimestamp.set(parentNode.id, now);

  const currentNodes = state.nodes;
  const { updatedDeployment, laidOut } = syncDeployment(parentNode, currentNodes, 0, get);

  // Check if positions actually changed
  const hasPositionChanged = laidOut.some((laidPod) => {
    const existing = currentNodes.find((n) => n.id === laidPod.id);
    if (!existing) return true;
    return (
      Math.abs(existing.position.x - laidPod.position.x) > 1 ||
      Math.abs(existing.position.y - laidPod.position.y) > 1
    );
  });

  if (!hasPositionChanged) return false;

  const others = currentNodes.filter((n) => n.id !== parentNode.id && !isChildPodOf(n, parentNode.id));
  const nextNodes = [...others, updatedDeployment, ...laidOut];

  set({ nodes: nextNodes });
  return true;
};

/**
 * React hook attached to each Pod node to perform self-checking inside workload controllers
 * and automatically adjust itself and sibling pods when overlapping or stacking is detected.
 *
 * @param podId - Canvas node ID of the Pod
 */
export const usePodOverlapAutoCorrection = (podId: string) => {
  const nodes = useFlowStore((state) => state.nodes);
  const draggedNodeId = useFlowStore((state) => state.draggedNodeId);

  useEffect(() => {
    if (draggedNodeId) return;

    const { hasOverlap, parentNode } = checkPodOverlapWithSiblings(podId, nodes);
    if (hasOverlap && parentNode) {
      autoAdjustWorkloadPodLayout(
        parentNode,
        () => useFlowStore.getState(),
        (patch) => useFlowStore.setState(patch)
      );
    }
  }, [podId, nodes, draggedNodeId]);
};
