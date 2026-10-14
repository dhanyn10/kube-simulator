import { K8sNodeData } from '@/types';

/**
 * Checks whether an HPA warning banner should be rendered above a Deployment card
 * when HPA is connected/attached but container CPU and Memory requests are missing.
 *
 * @param nodeId - Target node ID.
 * @param data - Deployment node data properties.
 * @param edges - Array of active canvas edges.
 * @param nodes - Array of active canvas nodes.
 * @returns Boolean indicating whether the HPA warning banner should be displayed.
 */
export const checkShowHPAWarning = (nodeId: string, data: K8sNodeData, edges: any[], nodes: any[]): boolean => {
  const hasRequests = Boolean(data.cpuRequest && data.memoryRequest);
  if (hasRequests) return false;

  const hasAttachedHpa = Array.isArray(data.hpas) && data.hpas.length > 0;
  const hasConnectedHpa = edges.some(
    (edge) => edge.target === nodeId && nodes.find((node) => node.id === edge.source)?.type === 'HPA'
  );

  return hasAttachedHpa || hasConnectedHpa;
};
