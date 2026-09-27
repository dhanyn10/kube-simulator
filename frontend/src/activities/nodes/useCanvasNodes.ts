import React from 'react';
import { useFlowStore } from '@/store';
import { isNodeAccessForbidden } from './rbacNodeHelpers';

/**
 * Custom hook to obtain canvas nodes with updated draggable status based on RBAC permissions.
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
