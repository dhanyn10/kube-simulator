import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

/**
 * Hook for ReplicaSetNode color mode and CSS styling computations.
 */
export const useReplicaSetNodeHandler = (selected?: boolean) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const containerClass = cn(
    "w-full h-full rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col justify-between p-2 min-h-[100px]",
    colorMode === 'dark' ? "replicaset-node-container-dark" : "replicaset-node-container-light",
    selected && (colorMode === 'dark' ? "replicaset-node-selected-dark" : "replicaset-node-selected-light")
  );

  const badgeClass = cn(
    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
    colorMode === 'dark' ? "replicaset-node-badge-dark" : "replicaset-node-badge-light"
  );

  return {
    colorMode,
    containerClass,
    badgeClass,
  };
};
