import { logger } from '../../lib/logger';
import { StateCreator } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sResourceType } from '../../types';
import {
  processWorkloadSimulation,
  calculateReachability,
  SimulationContext,
  updateInternetTraffic
} from '../../lib/simulation';
import {
  stopSimulation as stopSimulationInternal,
  broadcastMetrics,
  checkEmergencyStop,
  validateHpaTargets,
  getMetricsChannel
} from './simulationManager';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  isAutofocusEnabled: boolean;
  isSidebarVisible: boolean;
  isRightSidebarVisible: boolean;
  isSimulating: boolean;
  activeSimulationEdges: string[];
  simulationMetrics: Record<string, SimulationMetricPoint[]>;
  isMonitoringOpen: boolean;
  isMonitoringDetached: boolean;
  globalEdgeColor: string;
  globalEdgeErrorColor: string;
  systemResources: { cpuCores: number, totalMemoryGB: number, freeMemoryGB: number, cpuUsage: number } | null;
  visibleWidgets: string[];
  customImages: string[];
  toggleColorMode: () => void;
  setGlobalEdgeColors: (color: string, errorColor: string) => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
  toggleAutofocus: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setRightSidebarVisible: (visible: boolean) => void;
  startSimulation: (internetNodeIds?: string[]) => void;
  stopSimulation: () => void;
  setMonitoringOpen: (open: boolean) => void;
  setMonitoringDetached: (detached: boolean) => void;
  setSystemResources: (resources: { cpuCores: number, totalMemoryGB: number, freeMemoryGB: number, cpuUsage: number }) => void;
  toggleWidget: (widgetId: string) => void;
  addCustomImage: (image: string) => void;
  deleteCustomImage: (image: string) => void;
}

const simulationIntervalObj: { current: ReturnType<typeof setInterval> | null } = { current: null };

/**
 * Retrieves the Wails runtime if available.
 * @returns The Wails runtime or undefined.
 */
const getRuntime = () => typeof window !== 'undefined' ? (window as any).runtime : undefined;

/**
 * Executes a single tick of the simulation.
 * It updates metrics, processes workloads, and broadcasts changes to the UI and backend.
 *
 * @param params Object containing the current flow state, current tick count, and store setters/getters.
 */
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

  const workloads: Node[] = [];
  const internetNodes: Node[] = [];
  const nodeMap = new Map<string, Node>();
  const edgeMap = new Map<string, Edge[]>();
  const targetEdgeMap = new Map<string, Edge[]>();
  const childPodMap = new Map<string, Node[]>();
  const nodeIndexMap = new Map<string, number>();

  for (let i = 0; i < currentNodes.length; i++) {
    const node = currentNodes[i];
    nodeMap.set(node.id, node);
    nodeIndexMap.set(node.id, i);
    if (node.type === 'Deployment' || node.type === 'ReplicaSet' || (node.type === 'Pod' && !node.parentId)) {
      workloads.push(node);
    }
    if (node.type === 'Internet') {
      internetNodes.push(node);
    }
    if (node.parentId) {
      const children = childPodMap.get(node.parentId) || [];
      children.push(node);
      childPodMap.set(node.parentId, children);
    }
  }

  for (const edge of currentEdges) {
    const source = String(edge.source);
    const existingSource = edgeMap.get(source) || [];
    existingSource.push(edge);
    edgeMap.set(source, existingSource);

    const target = String(edge.target);
    const existingTarget = targetEdgeMap.get(target) || [];
    existingTarget.push(edge);
    targetEdgeMap.set(target, existingTarget);
  }

  const ctx: SimulationContext = {
    nodes: currentNodes,
    edges: currentEdges,
    activeSimulationEdges: state.activeSimulationEdges,
    updatedNodes,
    newMetrics,
    ticks,
    get,
    set,
    nodeMap,
    edgeMap,
    targetEdgeMap,
    childPodMap,
    internetNodes,
    nodeIndexMap,
    internetReachableMap: new Map()
  };

  // 1. Update internet traffic first
  for (const node of internetNodes) {
    const { hasChanges } = updateInternetTraffic(node, ctx);
    if (hasChanges) hasOverallChanges = true;
  }

  // 2. Pre-calculate reachability for internet nodes
  const activeEdgesSet = new Set(ctx.activeSimulationEdges);
  for (const node of internetNodes) {
    const reachable = calculateReachability([node], edgeMap, activeEdgesSet);
    ctx.internetReachableMap?.set(node.id, reachable);
  }

  // 3. Process workloads
  workloads.forEach(dep => {
    const { hasChanges } = processWorkloadSimulation(dep, ctx);
    if (hasChanges) hasOverallChanges = true;
  });

  set({ simulationMetrics: newMetrics, ...(hasOverallChanges ? { nodes: updatedNodes } : {}) });

  const stopParams = { ticks, workloads, nodes: updatedNodes, metrics: newMetrics, set, simulationInterval: simulationIntervalObj };
  if (!checkEmergencyStop(stopParams)) {
    broadcastMetrics(newMetrics, updatedNodes.filter(n => n.type === 'Deployment' || n.type === 'ReplicaSet' || (n.type === 'Pod' && !n.parentId)));
  }
};

/**
 * Internal logic for starting the simulation.
 * It validates HPA targets, initializes metrics, and sets up the tick interval.
 *
 * @param internetNodeIds Optional list of internet node IDs to start simulation from.
 * @param set Zustand store setter.
 * @param get Zustand store getter.
 */
const startSimulationInternal = (
    internetNodeIds: string[] | undefined,
    set: (state: Partial<FlowState>) => void,
    get: () => FlowState
  ) => {
      const { nodes, edges, colorMode, simulationMetrics } = get();

      if (!validateHpaTargets(nodes, edges)) {
          logger.error('[Simulation] ERROR: HPA requires resource limits on target workloads.');
          set({ isSimulating: true, activeSimulationEdges: [], simulationMetrics: {} });
          setTimeout(() => {
            stopSimulationInternal(set, get, simulationIntervalObj);
          }, 3000);
          return;
      }

      const workloads = nodes.filter(n => n.type === 'Deployment' || n.type === 'ReplicaSet' || (n.type === 'Pod' && !n.parentId));
      broadcastMetrics(simulationMetrics, workloads);

      const metricsChannel = getMetricsChannel();
      if (metricsChannel) {
        metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode });
      }

      const edgeMap = new Map<string, Edge[]>();
      for (const edge of edges) {
        const source = String(edge.source);
        const existing = edgeMap.get(source) || [];
        existing.push(edge);
        edgeMap.set(source, existing);
      }

      const startNodes = internetNodeIds ? nodes.filter(n => internetNodeIds.includes(n.id)) : nodes.filter(n => n.type === 'Internet');
      if (startNodes.length === 0) return;

      const reachableNodes = calculateReachability(startNodes, edgeMap, edges.map(e => String(e.id)));
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
  globalEdgeColor: 'var(--color-mat-indigo)',
  globalEdgeErrorColor: 'var(--color-mat-red)',
  draggingSidebarItem: null,
  isAutosaveEnabled: false,
  isAutofocusEnabled: false,
  isSidebarVisible: true,
  isRightSidebarVisible: true,
  isSimulating: false,
  activeSimulationEdges: [],
  simulationMetrics: {},
  isMonitoringOpen: false,
  isMonitoringDetached: false,
  systemResources: null,
  visibleWidgets: ['hardware-budget', 'object-stats'],
  customImages: ['my-web-app:v1.0', 'backend-api:latest'],
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
  setGlobalEdgeColors: (color, errorColor) => {
    set({ globalEdgeColor: color, globalEdgeErrorColor: errorColor });
    if (window.go?.main?.App?.SaveSetting) {
      window.go.main.App.SaveSetting('globalEdgeColor', color);
      window.go.main.App.SaveSetting('globalEdgeErrorColor', errorColor);
    }
  },
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state: FlowState) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  toggleAutofocus: () => set((state: FlowState) => ({ isAutofocusEnabled: !state.isAutofocusEnabled })),
  setSidebarVisible: (visible) => {
    set({ isSidebarVisible: visible });
    if (window.go?.main?.App?.SaveSetting) {
      window.go.main.App.SaveSetting('isSidebarVisible', String(visible));
    }
  },
  setRightSidebarVisible: (visible) => {
    set({ isRightSidebarVisible: visible });
    if (window.go?.main?.App?.SaveSetting) {
      window.go.main.App.SaveSetting('isRightSidebarVisible', String(visible));
    }
  },
  setMonitoringOpen: (open) => set({ isMonitoringOpen: open }),
  setMonitoringDetached: (detached) => set({ isMonitoringDetached: detached }),
  setSystemResources: (resources) => set({ systemResources: resources }),
  toggleWidget: (widgetId) => set((state: FlowState) => ({
    visibleWidgets: state.visibleWidgets.includes(widgetId)
      ? state.visibleWidgets.filter(w => w !== widgetId)
      : [...state.visibleWidgets, widgetId]
  })),
  addCustomImage: (image) => set((state: FlowState) => {
    if (state.customImages.includes(image)) return {};
    return { customImages: [...state.customImages, image] };
  }),
  deleteCustomImage: (image) => set((state: FlowState) => ({
    customImages: state.customImages.filter((img) => img !== image)
  })),
  /**
   * Public action to start the simulation.
   * @param internetNodeIds Optional internet node IDs to start from.
   */
  startSimulation: (internetNodeIds) => {
    startSimulationInternal(internetNodeIds, set, get);
  },
  /**
   * Public action to stop the simulation.
   */
  stopSimulation: () => {
    stopSimulationInternal(set, get, simulationIntervalObj);
  },
});
