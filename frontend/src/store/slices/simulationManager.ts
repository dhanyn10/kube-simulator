import { logger } from '../../lib/logger';
import { Node, Edge } from '@xyflow/react';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sNodeData } from '../../types';
import { validateResourceLimits } from '../../lib/utils';

// Centralize side-effect handlers
const metricsChannel = typeof globalThis !== 'undefined' ? new BroadcastChannel('monitoring-data') : null;
const getRuntime = () => typeof globalThis !== 'undefined' ? (globalThis as any).runtime : undefined;

/**
 * Stops the simulation and resets relevant state.
 */
export const stopSimulation = (set: (state: Partial<FlowState>) => void, get: () => FlowState, simulationInterval: { current: ReturnType<typeof setInterval> | null }) => {
  if (simulationInterval.current) {
    clearInterval(simulationInterval.current);
    simulationInterval.current = null;
  }
  const resetNodes = get().nodes.map(n => n.type === 'PVC' ? { ...n, data: { ...n.data, pvcStatus: 'Pending' } } : n);
  set({ isSimulating: false, activeSimulationEdges: [], simulationMetrics: {}, nodes: resetNodes });
};

/**
 * Broadcasts metrics to detached monitoring window and Wails backend.
 */
export const broadcastMetrics = (metrics: Record<string, SimulationMetricPoint[]>, workloads: Node[]) => {
  const payload = {
    metrics,
    deployments: workloads.map(d => ({ id: d.id, label: d.data.label, replicas: d.data.replicas || 1 }))
  };

  if (metricsChannel) {
    metricsChannel.postMessage({ type: 'METRICS_UPDATE', ...payload });
  }

  const runtime = getRuntime();
  if (runtime) runtime.EventsEmit('metrics-update', JSON.stringify(payload));
};

/**
 * Checks if simulation should be stopped due to critical errors (e.g., all pods pending).
 */
export const checkEmergencyStop = (params: {
  ticks: number,
  workloads: Node[],
  nodes: Node[],
  metrics: Record<string, SimulationMetricPoint[]>,
  set: (state: Partial<FlowState>) => void,
  simulationInterval: { current: ReturnType<typeof setInterval> | null }
}) => {
  const { ticks, workloads, nodes, metrics, set, simulationInterval } = params;
  const activeWorkloads = workloads.filter(w => (metrics[w.id]?.at(-1)?.cpuValue || 0) > 0);
  if (ticks <= 3 || activeWorkloads.length === 0) return false;

  const allPods = nodes.filter(n => n.type === 'Pod' && (
    (n.parentId && activeWorkloads.some(w => w.id === n.parentId)) || (!n.parentId && activeWorkloads.some(w => w.id === n.id))
  ));
  const readyPods = allPods.filter(p => (p.data as K8sNodeData).status === 'ready');

  if (allPods.length > 0 && readyPods.length === 0) {
    logger.error('[Simulation] CRITICAL: All pods are in pending state. Emergency shutdown.');
    if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
    }
    set({ isSimulating: false, activeSimulationEdges: [], simulationMetrics: {}, isMonitoringOpen: false, isMonitoringDetached: false });

    if (metricsChannel) {
        metricsChannel.postMessage({ type: 'DETACHED_CLOSED' });
    }

    const runtime = getRuntime();
    if (runtime) runtime.EventsEmit('detached-closed');
    return true;
  }
  return false;
};

/**
 * Validates HPA targets for required resource limits and ensure limit >= request.
 */
export const validateHpaTargets = (nodes: Node[], edges: Edge[]): boolean => {
    const hpaNodes = nodes.filter(n => n.type === 'HPA');
    if (hpaNodes.length === 0) return true;

    return !hpaNodes.some(hpa => {
        const outgoingEdges = edges.filter(e => e.source === hpa.id);
        const targets = nodes.filter(n => outgoingEdges.some(e => e.target === n.id));
        return targets.some(target => {
            const data = target.data as K8sNodeData;
            const isWorkload = target.type === 'Deployment' || (target.type === 'Pod' && !target.parentId);
            if (!isWorkload) return false;

            // HPA requires limits to be set
            if (!data.cpuLimit || !data.memoryLimit) return true;

            return validateResourceLimits(data).hasError;
        });
    });
};

// Re-export channel for other slices if needed
export const getMetricsChannel = () => metricsChannel;
