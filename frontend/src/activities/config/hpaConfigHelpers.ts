import { K8sNodeData } from '@/types';

/** Initial value for a newly created HPA. Never re-applied while editing. */
export const HPA_DEFAULT_MAX_REPLICAS = 10;
export const HPA_TARGET_MIN_PERCENT = 1;
export const HPA_TARGET_MAX_PERCENT = 100;

const positiveInt = (value: number, fallback: number): number => {
  const parsed = Math.floor(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};

/**
 * Keeps min <= max while editing. Raising min also raises max; lowering max
 * also lowers min. No creation default is injected here: once the HPA exists,
 * its saved values are the only source of truth.
 */
export const clampReplicaRange = (
  minReplicas: number,
  maxReplicas: number,
  changed: 'min' | 'max' = 'min'
): { minReplicas: number; maxReplicas: number } => {
  let min = positiveInt(minReplicas, 1);
  let max = positiveInt(maxReplicas, 1);

  // The field the user just edited wins; the other boundary follows it.
  if (changed === 'min') {
    max = Math.max(min, max);
  } else {
    min = Math.min(min, max);
  }

  return { minReplicas: min, maxReplicas: max };
};

/**
 * Fills only the missing resource limits, so the fix never creates
 * limit < request (see validateResourceLimits).
 */
export const resolveMissingLimits = (data?: K8sNodeData): Record<string, string> => {
  const updates: Record<string, string> = {};
  if (!data?.cpuLimit) updates.cpuLimit = data?.cpuRequest || '500m';
  if (!data?.memoryLimit) updates.memoryLimit = data?.memoryRequest || '256Mi';
  return updates;
};
