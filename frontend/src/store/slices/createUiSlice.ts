import { StateCreator } from 'zustand';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sResourceType } from '../../types';
import { processWorkloadSimulation, calculateReachability, SimulationContext } from '../../lib/simulation';
import { Node } from '@xyflow/react';
import {
  stopSimulation,
  broadcastMetrics,
  checkEmergencyStop,
  validateHpaTargets,
  getMetricsChannel
} from './simulationManager';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  isSimulating: boolean;
  activeSimulationEdges: string[];
  simulationMetrics: Record<string, SimulationMetricPoint[]>;
  isMonitoringOpen: boolean;
  isMonitoringDetached: boolean;
  systemResources: { cpuCores: number, totalMemoryGB: number, freeMemoryGB: number, cpuUsage: number } | null;
  visibleWidgets: string[];
  isCanvasConfigOpen: boolean;
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
  setSimulation: (active: boolean, internetNodeIds?: string[]) => void;
  setMonitoringOpen: (open: boolean) => void;
  setMonitoringDetached: (detached: boolean) => void;
  setSystemResources: (resources: { cpuCores: number, totalMemoryGB: number, freeMemoryGB: number, cpuUsage: number }) => void;
  toggleWidget: (widgetId: string) => void;
  setCanvasConfigOpen: (open: boolean) => void;
}

const simulationIntervalObj: { current: ReturnType<typeof setInterval> | null } = { current: null };
const getRuntime = () => typeof window !== 'undefined' ? (window as any).runtime : undefined;

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

  const stopParams = { ticks, workloads, nodes: updatedNodes, metrics: newMetrics, set, simulationInterval: simulationIntervalObj };
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

      if (!validateHpaTargets(nodes, edges)) {
          console.error('[Simulation] ERROR: HPA requires resource limits on target workloads.');
          set({ isSimulating: true, activeSimulationEdges: [], simulationMetrics: {} });
          setTimeout(() => {
            stopSimulation(set, get, simulationIntervalObj);
          }, 3000);
          return;
      }

      const workloads = nodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup' || (n.type === 'Pod' && !n.parentId));
      broadcastMetrics(simulationMetrics, workloads);

      const metricsChannel = getMetricsChannel();
      if (metricsChannel) {
        metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode });
      }

      const startNodes = internetNodeIds ? nodes.filter(n => internetNodeIds.includes(n.id)) : nodes.filter(n => n.type === 'Internet');
      if (startNodes.length === 0) return;

      const reachableNodes = calculateReachability(startNodes, edges, edges.map(e => String(e.id)));
      const activeEdges = edges.filter(e => reachableNodes.has(String(e.source))).map(e => String(e.id));

      set({ isSimulating: true, activeSimulationEdges: activeEdges, simulationMetrics: {} });

      let ticks = 0;
      if (simulationIntervalObj.current) clearInterval(simulationIntervalObj.current);
      simulationIntervalObj.current = setInterval(() => {
        ticks++;
        const state = get();
        if (!state.isSimulating) {
          if (simulationIntervalObj.current) {
              clearInterval(simulationIntervalObj.current);
              simulationIntervalObj.current = null;
          }
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
  systemResources: null,
  visibleWidgets: ['object-stats', 'inspector-btn', 'target-indicator'],
  isCanvasConfigOpen: false,
  toggleColorMode: () => {
    const newMode = get().colorMode === 'dark' ? 'light' : 'dark';
    set({ colorMode: newMode });

    const metricsChannel = getMetricsChannel();
    if (metricsChannel) {
        metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode: newMode });
    }

    const runtime = getRuntime();
    if (runtime) runtime.EventsEmit('theme-sync', newMode);
  },
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state: FlowState) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  setMonitoringOpen: (open) => set({ isMonitoringOpen: open }),
  setMonitoringDetached: (detached) => set({ isMonitoringDetached: detached }),
  setSystemResources: (resources) => set({ systemResources: resources }),
  toggleWidget: (widgetId) => set((state: FlowState) => ({
    visibleWidgets: state.visibleWidgets.includes(widgetId)
      ? state.visibleWidgets.filter(w => w !== widgetId)
      : [...state.visibleWidgets, widgetId]
  })),
  setCanvasConfigOpen: (open) => set({ isCanvasConfigOpen: open }),
  setSimulation: (active, internetNodeIds) => {
    if (!active) {
      stopSimulation(set, get, simulationIntervalObj);
    } else {
      startSimulation(internetNodeIds, set, get);
    }
  },
});
