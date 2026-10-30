import React from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '@/store';
import { isNodeAccessForbidden } from './rbacNodeHelpers';

const resolveEffectiveZIndex = (node: Node, allNodes: Node[]): number | undefined => {
  let maxZ = node.zIndex;
  let currentParentId = node.parentId;
  let depth = 0;

  while (currentParentId && depth < 5) {
    const parent = allNodes.find((n) => n.id === currentParentId);
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
 *
 * @returns Array of transformed flow nodes with RBAC draggable enforcement applied.
 */
export const useCanvasNodes = () => {
  const rawNodes = useFlowStore((state) => state.nodes);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const iamUsers = useFlowStore((state) => state.iamUsers);

  return React.useMemo(() => {
    return rawNodes.map((node) => {
      const isForbidden = isNodeAccessForbidden(activeIdentity, iamUsers || [], node.type, node.data, rawNodes);
      const effectiveZIndex = resolveEffectiveZIndex(node, rawNodes);
      if (effectiveZIndex !== undefined && effectiveZIndex !== node.zIndex) {
        return {
          ...node,
          zIndex: effectiveZIndex,
          draggable: !isForbidden,
        };
      }
      return {
        ...node,
        draggable: !isForbidden,
      };
    });
  }, [rawNodes, activeIdentity, iamUsers]);
};
