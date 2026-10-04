import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { safeRandom } from './utils';
import { logger } from './logger';
import { SimulationContext, updateNodeData } from './simulationTypes';

/**
 * Schedules automated recovery for crashing pods after a delay based on restartPolicy.
 */
export const scheduleRecovery = (_dep: Node, podId: string, ctx: SimulationContext) => {
  const currentState = ctx.get();
  const latestNode = currentState?.nodes?.find(n => n.id === podId);
  const pData = latestNode?.data as K8sNodeData | undefined;

  if (pData?.restartPolicy === 'Never') {
    try {
      currentState?.addLog?.(
        'error',
        `[Kubelet] Pod "${pData.label || podId}" crashed! Automatic restart disabled (restartPolicy: Never). Pod remains down.`,
        'Simulation'
      );
    } catch (e) {
      logger.error('[Simulation Recovery] Failed to add log', e);
    }
    return;
  }

  const speed = currentState?.simulationSpeed || 1;
  const delayMs = Math.round(3000 / Math.max(1, speed));
  const policy = pData?.restartPolicy || 'Always';

  try {
    currentState?.addLog?.(
      'warning',
      `[Kubelet] Pod "${pData?.label || podId}" crashed! Restarting container (restartPolicy: ${policy})...`,
      'Simulation'
    );
  } catch (e) {
    logger.error('[Simulation Recovery] Failed to add log', e);
  }

  setTimeout(() => {
    const latestState = ctx.get();
    const nodeToRecover = latestState.nodes.find(n => n.id === podId);
    if (nodeToRecover?.data.status !== 'crashing') return;

    const currentPData = nodeToRecover.data as K8sNodeData;
    const isReadyConfigured = !!(currentPData.webserver && currentPData.webserver !== 'none') || !!(currentPData.runtime && currentPData.runtime !== 'none');
    const nextStatus = isReadyConfigured ? 'ready' : 'pending';

    latestState.updateNodeData?.(podId, { status: nextStatus, simulatedFailureCM: undefined });
    try {
      latestState.addLog?.(
        'info',
        `[Kubelet] Pod "${currentPData.label || podId}" container restarted successfully. Status: ${nextStatus}.`,
        'Simulation'
      );
    } catch (e) {
      logger.error('[Simulation Recovery] Failed to add log', e);
    }
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
