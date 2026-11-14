import React from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '@/store';
import { isNodeAccessForbidden } from './rbacNodeHelpers';

export const resolveEffectiveZIndex = (
  node: Node,
  allNodesOrMap: Node[] | Map<string, Node>
): number | undefined => {
  let maxZ = node.zIndex;
  let currentParentId = node.parentId;
  let depth = 0;

  const nodeMap = allNodesOrMap instanceof Map
    ? allNodesOrMap
    : new Map<string, Node>(allNodesOrMap.map((n) => [n.id, n]));

  while (currentParentId && depth < 5) {
    const parent = nodeMap.get(currentParentId);
    if (!parent) break;
    if (parent.zIndex !== undefined) {
      maxZ = Math.max(maxZ ?? 0, parent.zIndex);
    }
    currentParentId = parent.parentId;
    depth++;
  }

  return maxZ;
};

/**
 * Custom React hook managing canvas node permissions and interactive state.
 * Selects raw nodes and RBAC state from Zustand store and returns transformed node objects
 * with updated `draggable` flags determined by active identity permissions.
 * Preserves object reference equality when draggable and zIndex remain unchanged.
 *
 * @returns Array of transformed flow nodes with RBAC draggable enforcement applied.
 */
export const useCanvasNodes = () => {
  const rawNodes = useFlowStore((state) => state.nodes);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const iamUsers = useFlowStore((state) => state.iamUsers);

  return React.useMemo(() => {
    const nodeMap = new Map<string, Node>(rawNodes.map((n) => [n.id, n]));
    let hasAnyChange = false;

    const transformedNodes = rawNodes.map((node) => {
      const isForbidden = isNodeAccessForbidden(activeIdentity, iamUsers || [], node.type, node.data, rawNodes);
      const effectiveZIndex = resolveEffectiveZIndex(node, nodeMap);

      const targetDraggable = !isForbidden;
      const targetZIndex = effectiveZIndex !== undefined && effectiveZIndex !== node.zIndex
        ? effectiveZIndex
        : node.zIndex;

      if (node.draggable === targetDraggable && node.zIndex === targetZIndex) {
        return node;
      }

      hasAnyChange = true;
      return {
        ...node,
        ...(targetZIndex !== undefined ? { zIndex: targetZIndex } : {}),
        draggable: targetDraggable,
      };
    });

    return hasAnyChange ? transformedNodes : rawNodes;
  }, [rawNodes, activeIdentity, iamUsers]);
};
