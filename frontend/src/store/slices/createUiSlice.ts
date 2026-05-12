import { StateCreator } from 'zustand';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sResourceType, K8sNodeData } from '../../types';
import { processWorkloadSimulation, calculateReachability, SimulationContext } from '../../lib/simulation';
import { Node, Edge } from '@xyflow/react';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  isSimulating: boolean;
  activeSimulationEdges: string[];
  simulationMetrics: Record<string, SimulationMetricPoint[]>;
  isMonitoringOpen: boolean;
  isMonitoringDetached: boolean;
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
  setSimulation: (active: boolean, internetNodeIds?: string[]) => void;
  setMonitoringOpen: (open: boolean) => void;
  setMonitoringDetached: (detached: boolean) => void;
}

let simulationInterval: ReturnType<typeof setInterval> | null = null;
const metricsChannel = new BroadcastChannel('monitoring-data');
const runtime = typeof window !== 'undefined' ? window.runtime : undefined;

const stopSimulation = (set: (state: Partial<FlowState>) => void, get: () => FlowState) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  const resetNodes = get().nodes.map(n => n.type === 'PVC' ? { ...n, data: { ...n.data, pvcStatus: 'Pending' } } : n);
  set({ isSimulating: false, activeSimulationEdges: [], simulationMetrics: {}, nodes: resetNodes });
};

const broadcastMetrics = (metrics: Record<string, SimulationMetricPoint[]>, workloads: Node[]) => {
  const payload = {
    metrics,
    deployments: workloads.map(d => ({ id: d.id, label: d.data.label, replicas: d.data.replicas || 1 }))
  };
  metricsChannel.postMessage({ type: 'METRICS_UPDATE', ...payload });
  if (runtime) runtime.EventsEmit('metrics-update', JSON.stringify(payload));
};

const checkEmergencyStop = (params: {
  ticks: number,
  workloads: Node[],
  nodes: Node[],
  metrics: Record<string, SimulationMetricPoint[]>,
  set: (state: Partial<FlowState>) => void
}) => {
  const { ticks, workloads, nodes, metrics, set } = params;
  const activeWorkloads = workloads.filter(w => (metrics[w.id]?.slice(-1)[0]?.cpuValue || 0) > 0);
  if (ticks <= 3 || activeWorkloads.length === 0) return false;

  const allPods = nodes.filter(n => n.type === 'Pod' && (
    (n.parentId && activeWorkloads.some(w => w.id === n.parentId)) || (!n.parentId && activeWorkloads.some(w => w.id === n.id))
  ));
  const readyPods = allPods.filter(p => (p.data as K8sNodeData).status === 'ready');

  if (allPods.length > 0 && readyPods.length === 0) {
    console.error('[Simulation] CRITICAL: All pods are in pending state. Emergency shutdown.');
    if (simulationInterval) { clearInterval(simulationInterval); simulationInterval = null; }
    set({ isSimulating: false, activeSimulationEdges: [], simulationMetrics: {}, isMonitoringOpen: false, isMonitoringDetached: false });
    metricsChannel.postMessage({ type: 'DETACHED_CLOSED' });
    if (runtime) runtime.EventsEmit('detached-closed');
    return true;
  }
  return false;
};

const runSimulationTick = (params: {
  state: FlowState,
  ticks: number,
  set: (state: Partial<FlowState>) => void,
  get: () => FlowState
}) => {
  const { state, ticks, set, get } = params;
  const { nodes: currentNodes, edges: currentEdges, simulationMetrics: currentMetrics } = state;
  const newMetrics = { ...currentMetrics };
  const updatedNodes = [...currentNodes];
  let hasOverallChanges = false;

  const workloads = currentNodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup' || (n.type === 'Pod' && !n.parentId));

  const ctx: SimulationContext = {
    nodes: currentNodes,
    edges: currentEdges,
    activeSimulationEdges: state.activeSimulationEdges,
    updatedNodes,
    newMetrics,
    ticks,
    get,
    set
  };

  workloads.forEach(dep => {
    const { hasChanges } = processWorkloadSimulation(dep, ctx);
    if (hasChanges) hasOverallChanges = true;
  });

  set({ simulationMetrics: newMetrics, ...(hasOverallChanges ? { nodes: updatedNodes } : {}) });

  const stopParams = { ticks, workloads, nodes: updatedNodes, metrics: newMetrics, set };
  if (!checkEmergencyStop(stopParams)) {
    broadcastMetrics(newMetrics, updatedNodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup' || (n.type === 'Pod' && !n.parentId)));
  }
};

const startSimulation = (
    internetNodeIds: string[] | undefined,
    set: (state: Partial<FlowState>) => void,
    get: () => FlowState
  ) => {
      const { nodes, edges, colorMode, simulationMetrics } = get();

      const workloads = nodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup' || (n.type === 'Pod' && !n.parentId));
      broadcastMetrics(simulationMetrics, workloads);
      metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode });

      const startNodes = internetNodeIds ? nodes.filter(n => internetNodeIds.includes(n.id)) : nodes.filter(n => n.type === 'Internet');
      if (startNodes.length === 0) return;

      const reachableNodes = calculateReachability(startNodes, edges, edges.map(e => String(e.id)));
      const activeEdges = edges.filter(e => reachableNodes.has(String(e.source))).map(e => String(e.id));

      set({ isSimulating: true, activeSimulationEdges: activeEdges, simulationMetrics: {} });

      let ticks = 0;
      if (simulationInterval) clearInterval(simulationInterval);
      simulationInterval = setInterval(() => {
        ticks++;
        const state = get();
        if (!state.isSimulating) {
          if (simulationInterval) { clearInterval(simulationInterval); simulationInterval = null; }
          return;
        }
        runSimulationTick({ state, ticks, set, get });
      }, 1000);
};

export const createUiSlice: StateCreator<FlowState, [], [], UiSlice> = (set, get) => ({
  colorMode: 'dark',
  draggingSidebarItem: null,
  isAutosaveEnabled: false,
  isSimulating: false,
  activeSimulationEdges: [],
  simulationMetrics: {},
  isMonitoringOpen: false,
  isMonitoringDetached: false,
  toggleColorMode: () => {
    const newMode = get().colorMode === 'dark' ? 'light' : 'dark';
    set({ colorMode: newMode });
    metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode: newMode });
    if (runtime) runtime.EventsEmit('theme-sync', newMode);
  },
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state: FlowState) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  setMonitoringOpen: (open) => set({ isMonitoringOpen: open }),
  setMonitoringDetached: (detached) => set({ isMonitoringDetached: detached }),
  setSimulation: (active, internetNodeIds) => {
    if (!active) {
      stopSimulation(set, get);
    } else {
      startSimulation(internetNodeIds, set, get);
    }
  },
});
