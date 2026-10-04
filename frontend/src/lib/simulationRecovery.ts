import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { safeRandom } from './utils';
import { SimulationContext, updateNodeData } from './simulationTypes';

/**
 * Schedules automated recovery for crashing pods after a delay.
 */
export const scheduleRecovery = (_dep: Node, podId: string, ctx: SimulationContext) => {
  const currentState = ctx.get();
  const speed = currentState?.simulationSpeed || 1;
  const delayMs = Math.round(3000 / Math.max(1, speed));

  setTimeout(() => {
    const latestState = ctx.get();
    const nodeToRecover = latestState.nodes.find(n => n.id === podId);
    if (nodeToRecover?.data.status !== 'crashing') return;

    const pData = nodeToRecover.data as K8sNodeData;
    const isReadyConfigured = !!(pData.webserver && pData.webserver !== 'none') || !!(pData.runtime && pData.runtime !== 'none');
    const nextStatus = isReadyConfigured ? 'ready' : 'pending';

    latestState.updateNodeData?.(podId, { status: nextStatus, simulatedFailureCM: undefined });
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
