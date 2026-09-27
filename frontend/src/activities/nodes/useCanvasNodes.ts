import React from 'react';
import { useFlowStore } from '@/store';
import { isNodeAccessForbidden } from './rbacNodeHelpers';

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
      return {
        ...node,
        draggable: !isForbidden,
      };
    });
  }, [rawNodes, activeIdentity, iamUsers]);
};
