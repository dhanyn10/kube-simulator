import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

/**
 * Hook for ReplicaSetNode color mode and CSS styling computations.
 */
export const useReplicaSetNodeHandler = (selected?: boolean) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const containerClass = cn(
    "replicaset-node-base",
    colorMode === 'dark' ? "replicaset-node-container-dark" : "replicaset-node-container-light",
    selected && (colorMode === 'dark' ? "replicaset-node-selected-dark" : "replicaset-node-selected-light")
  );

  const badgeClass = cn(
    "replicaset-node-badge-base",
    colorMode === 'dark' ? "replicaset-node-badge-dark" : "replicaset-node-badge-light"
  );

  return {
    colorMode,
    containerClass,
    badgeClass,
  };
};
