import { Node, Edge } from '@xyflow/react';
import type { FlowState, SimulationMetricPoint } from '@/store/types';
import { K8sNodeData } from '@/types';
import { validateResourceLimits } from '@/lib/utils';
import { getBackendGateway } from '@/gateway';

// Centralize side-effect handlers
let metricsChannel: BroadcastChannel | null = new BroadcastChannel('monitoring-data');

/**
 * Retrieves the Wails runtime if available.
 * @returns The Wails runtime or undefined.
 */
const getRuntime = () => (globalThis as any).runtime;

/**
 * Resets dynamic simulation runtime fields on nodes back to their idle/initial state.
 * Restores Pods from 'crashing' back to 'ready' or 'pending', resets PVCs to 'Pending',
 * and resets Internet traffic profile indices.
 *
 * @param nodes List of canvas nodes to reset
 * @returns Reconciled nodes with runtime fields cleared
 */
export const resetSimulationNodes = (nodes: Node[]): Node[] => {
  return nodes.map(n => {
    if (n.type === 'PVC') {
      return { ...n, data: { ...n.data, pvcStatus: 'Pending' } };
    }
    if (n.type === 'Internet') {
      return { ...n, data: { ...n.data, currentHourIndex: 0, currentMinuteIndex: 0, profileTicks: 0 } };
    }
    if (n.type === 'Deployment' || n.type === 'StatefulSet' || n.type === 'ReplicaSet') {
      return { ...n, data: { ...n.data, lowCpuTicks: 0 } };
    }
    if (n.type === 'Pod') {
      const podData = n.data as K8sNodeData;
      const initialStatus = podData.image ? 'ready' : 'pending';
      return {
        ...n,
        data: {
          ...podData,
          status: initialStatus,
          simulatedFailureCM: undefined,
          simulatedFailureSecret: undefined,
        }
      };
    }
    return n;
  });
};

/**
 * Pauses the simulation without resetting metrics or traffic positions.
 * @param set Zustand store setter.
 * @param simulationInterval Ref to the current interval object.
 */
export const pauseSimulation = (set: (state: Partial<FlowState>) => void, simulationInterval: { current: ReturnType<typeof setInterval> | null }) => {
  if (simulationInterval.current) {
    clearInterval(simulationInterval.current);
    simulationInterval.current = null;
  }
  set({ isSimulating: false, isPaused: true });
};

/**
 * Stops the simulation and resets relevant state.
 * @param set Zustand store setter.
 * @param get Zustand store getter.
 * @param simulationInterval Ref to the current interval object.
 */
export const stopSimulation = (set: (state: Partial<FlowState>) => void, get: () => FlowState, simulationInterval: { current: ReturnType<typeof setInterval> | null }) => {
  if (simulationInterval.current) {
    clearInterval(simulationInterval.current);
    simulationInterval.current = null;
  }
  const resetNodes = resetSimulationNodes(get().nodes);
  set({ isSimulating: false, isPaused: false, activeSimulationEdges: [], simulationMetrics: {}, nodes: resetNodes });
};

/**
 * Determines whether the canvas has sufficient components to start simulation.
 * Requires at least one Internet node for traffic.
 */
export const canStartSimulation = (nodes: Node[]): boolean => {
  if (!nodes || nodes.length === 0) return false;
  return nodes.some((n) => n.type === 'Internet');
};

let lastBroadcastTimestamp = 0;
let lastBackendSnapshotTimestamp = 0;

const getBroadcastThrottleMs = (speed: number): number => {
  if (speed >= 10) return 100;
  if (speed >= 5) return 60;
  return 30;
};

/**
 * Broadcasts metrics to detached monitoring window and Wails backend.
 * Dynamically throttles high-speed 10x simulation to ~10 FPS (100ms) to prevent IPC flooding and GC freezes.
 * @param metrics The current simulation metrics.
 * @param workloads List of active workload nodes.
 */
export const broadcastMetrics = (
  metrics: Record<string, SimulationMetricPoint[]>,
  workloads: Node[],
  extraState?: {
    isSimulating?: boolean;
    isPaused?: boolean;
    speed?: number;
    canStart?: boolean;
    hasInternet?: boolean;
    hasHpa?: boolean;
    hpaTarget?: number;
    force?: boolean;
  }
) => {
  const isLive = Boolean(extraState?.isSimulating && !extraState?.isPaused);
  const now = Date.now();
  const speed = extraState?.speed ?? 1;
  const throttleMs = getBroadcastThrottleMs(speed);

  if (
    process.env.NODE_ENV !== 'test' &&
    isLive &&
    !extraState?.force &&
    now - lastBroadcastTimestamp < throttleMs
  ) {
    return;
  }
  lastBroadcastTimestamp = now;

  const canStart = extraState?.canStart ?? (extraState?.hasInternet ?? false);
  const hasWorkloadHpa = workloads.some(d => Array.isArray(d.data?.hpas) && d.data.hpas.length > 0);
  const hasHpa = extraState?.hasHpa ?? hasWorkloadHpa;
  let hpaTarget = extraState?.hpaTarget;
  if (hpaTarget === undefined) {
    for (const d of workloads) {
      if (Array.isArray(d.data?.hpas) && d.data.hpas.length > 0 && d.data.hpas[0]?.targetCPU) {
        hpaTarget = Number(d.data.hpas[0].targetCPU);
        break;
      }
    }
  }

  const payload = {
    metrics,
    deployments: workloads.map(d => ({
      id: d.id,
      label: d.data.label || d.id,
      replicas: d.data.replicas || 1,
      type: d.type,
      hasHpa: Array.isArray(d.data?.hpas) && d.data.hpas.length > 0,
      hpas: d.data?.hpas,
    })),
    isSimulating: extraState?.isSimulating ?? true,
    isPaused: extraState?.isPaused ?? false,
    speed: extraState?.speed ?? 1,
    canStart,
    hasInternet: extraState?.hasInternet ?? false,
    hasHpa,
    hpaTarget: hpaTarget ?? 80,
    timestamp: Date.now()
  };

  if (metricsChannel) {
    metricsChannel.postMessage({ type: 'METRICS_UPDATE', ...payload });
  }

  const serialized = JSON.stringify(payload);
  const runtime = getRuntime();
  runtime?.EventsEmit?.('metrics-update', serialized);

  // Throttle backend Go snapshot caching to once per second during live simulation
  // or immediately when force/state change to prevent multi-megabyte IPC loopback echoes
  const shouldBroadcastBackendSnapshot =
    process.env.NODE_ENV === 'test' ||
    !isLive ||
    Boolean(extraState?.force) ||
    now - lastBackendSnapshotTimestamp >= 1000;

  if (shouldBroadcastBackendSnapshot) {
    lastBackendSnapshotTimestamp = now;
    void getBackendGateway().broadcastSimulationSnapshot(serialized);
  }
};

const ERROR_POD_STATUSES = new Set(['crashing', 'error', 'CrashLoopBackOff']);

/**
 * Reports an error as soon as it is visible in the system monitor: a red metric point
 * (OOM / CPU throttle) or a failed pod. No grace period and no speed-dependent delay, so
 * the caller can pause the simulation on the very tick the chart turns red.
 *
 * @param params Latest metrics and nodes from the current tick.
 * @returns true when at least one monitored error is present.
 */
export const hasMonitorError = (params: {
  metrics: Record<string, SimulationMetricPoint[]>,
  nodes: Node[],
}): boolean => {
  const { metrics, nodes } = params;
  // Ignore stale metric series from a previous run that are no longer on the canvas.
  const activeIds = new Set(nodes.flatMap(n => [n.id, n.parentId].filter(Boolean)) as string[]);
  for (const [workloadId, points] of Object.entries(metrics)) {
    if (!activeIds.has(workloadId)) continue;
    const last = points.at(-1);
    if (last?.isOOM || last?.isThrottled) return true;
  }
  return nodes.some(n => n.type === 'Pod' &&
    ERROR_POD_STATUSES.has(String((n.data as K8sNodeData).status)));
};

/**
 * Validates HPA targets for required resource limits and ensure limit >= request.
 *
 * @param nodes List of all flow nodes.
 * @param edges List of all flow edges.
 * @returns boolean True if all HPA targets are valid.
 */
export const validateHpaTargets = (nodes: Node[], edges: Edge[]): boolean => {
    const workloads = nodes.filter(n =>
      n.type === 'Deployment' ||
      n.type === 'StatefulSet' ||
      n.type === 'ReplicaSet' ||
      (n.type === 'Pod' && !n.parentId)
    );

    for (const target of workloads) {
      const data = target.data as K8sNodeData;
      const hasAttachedHpa = Array.isArray(data.hpas) && data.hpas.length > 0;
      const hasConnectedHpa = edges.some(e => e.target === target.id && nodes.find(n => n.id === e.source)?.type === 'HPA');

      if (hasAttachedHpa || hasConnectedHpa) {
        if (!data.cpuLimit || !data.memoryLimit) return false;
        if (validateResourceLimits(data).hasError) return false;
      }
    }
    return true;
};

/**
 * Returns the centralized metrics broadcast channel.
 * @returns BroadcastChannel | null
 */
export const getMetricsChannel = () => metricsChannel;

/**
 * Sets or clears the centralized metrics broadcast channel for testing.
 * @param channel BroadcastChannel instance or null.
 */
export const setMetricsChannel = (channel: BroadcastChannel | null) => {
  metricsChannel = channel;
};
