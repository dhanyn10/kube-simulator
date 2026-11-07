import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { safeRandom } from './utils';
import { SimulationContext, updateNodeData, emitSimulationLog } from './simulationTypes';
import { getImageCharacteristics } from './imageCharacteristics';

/**
 * Schedules automated recovery for crashing pods after a delay based on restartPolicy.
 */
export const scheduleRecovery = (_dep: Node, podId: string, ctx: SimulationContext) => {
  const currentState = ctx.get();
  const latestNode = currentState?.nodes?.find(node => node.id === podId);
  const podData = latestNode?.data as K8sNodeData | undefined;
  const isControllerChild = Boolean(latestNode?.parentId || podData?.parentId);

  if (!isControllerChild && podData?.restartPolicy === 'Never') {
    emitSimulationLog(
      ctx,
      'error',
      `[Kubelet] Pod "${podData?.label || podId}" crashed! Automatic restart disabled (restartPolicy: Never). Pod remains down.`,
      'Simulation',
      '[Simulation Recovery] Failed to add log'
    );
    return;
  }

  const speed = currentState?.simulationSpeed || 1;
  const imageName = podData?.image || 'nginx:latest';
  const chars = getImageCharacteristics(imageName);
  // Scale recovery delay using numerical startupDelayTicks factor
  const delayMs = Math.round((1000 * chars.startupDelayTicks) / Math.max(1, speed));
  const policy = isControllerChild ? 'Always' : (podData?.restartPolicy || 'Always');

  emitSimulationLog(
    ctx,
    'warning',
    `[Kubelet] Pod "${podData?.label || podId}" crashed! Restarting container (restartPolicy: ${policy})...`,
    'Simulation',
    '[Simulation Recovery] Failed to add log'
  );

  setTimeout(() => {
    const latestState = ctx.get();
    const nodeToRecover = latestState?.nodes?.find((node: any) => node.id === podId);
    if (nodeToRecover?.data?.status !== 'crashing') return;

    const currentPodData = nodeToRecover.data as K8sNodeData;
    const isReadyConfigured = Boolean(currentPodData.image);
    const nextStatus = isReadyConfigured ? 'ready' : 'pending';

    latestState?.updateNodeData?.(podId, { status: nextStatus, simulatedFailureCM: undefined });
    emitSimulationLog(
      ctx,
      'info',
      `[Kubelet] Pod "${currentPodData.label || podId}" container restarted successfully. Status: ${nextStatus}.`,
      'Simulation',
      '[Simulation Recovery] Failed to add log'
    );
  }, delayMs);
};

/**
 * Simulates random container crashes when memory usage exceeds memory limits (OOM state).
 */
export const handleOomCrashes = (dep: Node, isOOM: boolean, ctx: SimulationContext) => {
  if (!isOOM || safeRandom() <= 0.5) return false;

  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
  if (childPods.length === 0) return false;

  const podToCrash = childPods[Math.floor(safeRandom() * childPods.length)];
  if (podToCrash.data.status === 'crashing') return false;

  const changed = updateNodeData(ctx, podToCrash.id, { status: 'crashing' });
  if (changed) scheduleRecovery(dep, podToCrash.id, ctx);
  return changed;
};
