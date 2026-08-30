import { logger } from '../../lib/logger';
import { StateCreator } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sResourceType } from '../../types';
import { safeRandom } from '../../lib/utils';
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
  isHistoryViewOpen: boolean;
  setHistoryViewOpen: (open: boolean) => void;
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
  canvasBgVariant: 'dots' | 'lines';
  canvasBgColor: string;
  canvasBgOpacity: number;

  // Update check & cheat code state
  simulatedUpdateInfo: { latestVersion: string; releaseUrl: string } | null;
  isAdminAuthenticated: boolean;
  isAwaitingAdminPassword?: boolean;
  adminLoginAttempts: number;
  setSimulatedUpdateInfo: (info: { latestVersion: string; releaseUrl: string } | null) => void;
  setIsAdminAuthenticated: (isAdmin: boolean) => void;

  // Terminal state & actions
  isTerminalOpen: boolean;
  terminalActiveTab: 'activity' | 'logs';
  terminalSelectedResourceId: string | null;
  terminalLogs: Record<string, string[]>;
  activityLogs: string[];
  setTerminalOpen: (open: boolean) => void;
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void;
  setTerminalSelectedResourceId: (id: string | null) => void;
  addTerminalLog: (resourceId: string, line: string) => void;
  addActivityLog: (line: string) => void;
  clearTerminalLogs: () => void;

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
  setCanvasBgVariant: (variant: 'dots' | 'lines') => void;
  setCanvasBgColor: (color: string) => void;
  setCanvasBgOpacity: (opacity: number) => void;
  saveSettingsJson: () => void;
  loadSettingsJson: () => void;
}

const simulationIntervalObj: { current: ReturnType<typeof setInterval> | null } = { current: null };

/**
 * Retrieves the Wails runtime if available.
 * @returns The Wails runtime or undefined.
 */
const getRuntime = () => typeof globalThis !== 'undefined' ? (globalThis as any).runtime : undefined;

const applyParsedSettings = (val: string, set: (state: Partial<FlowState>) => void) => {
  try {
    const settings = JSON.parse(val);
    set({
      ...(typeof settings.isSidebarVisible === 'boolean' ? { isSidebarVisible: settings.isSidebarVisible } : {}),
      ...(typeof settings.isRightSidebarVisible === 'boolean' ? { isRightSidebarVisible: settings.isRightSidebarVisible } : {}),
      ...(typeof settings.isAutofocusEnabled === 'boolean' ? { isAutofocusEnabled: settings.isAutofocusEnabled } : {}),
      ...(typeof settings.isMonitoringOpen === 'boolean' ? { isMonitoringOpen: settings.isMonitoringOpen } : {}),
      ...(settings.canvasBgVariant === 'dots' || settings.canvasBgVariant === 'lines' ? { canvasBgVariant: settings.canvasBgVariant } : {}),
      ...(typeof settings.canvasBgColor === 'string' ? { canvasBgColor: settings.canvasBgColor } : {}),
      ...(typeof settings.canvasBgOpacity === 'number' ? { canvasBgOpacity: settings.canvasBgOpacity } : {}),
    });
  } catch (e) {
    logger.error('Failed to parse app settings json', e);
  }
};

const fallbackToLegacySettings = (set: (state: Partial<FlowState>) => void) => {
  if (!globalThis.go?.main?.App?.GetSetting) return;
  Promise.all([
    globalThis.go.main.App.GetSetting('isSidebarVisible'),
    globalThis.go.main.App.GetSetting('isRightSidebarVisible')
  ]).then(([sidebar, rightSidebar]) => {
    set({
      ...(sidebar !== "" ? { isSidebarVisible: sidebar === 'true' } : {}),
      ...(rightSidebar !== "" ? { isRightSidebarVisible: rightSidebar === 'true' } : {}),
    });
  });
};

/**
 * Builds standard edge maps to classify connected edges
 */
const buildEdgeMaps = (edges: Edge[]) => {
  const edgeMap = new Map<string, Edge[]>();
  const targetEdgeMap = new Map<string, Edge[]>();

  for (const edge of edges) {
    const source = String(edge.source);
    const existingSource = edgeMap.get(source) || [];
    existingSource.push(edge);
    edgeMap.set(source, existingSource);

    const target = String(edge.target);
    const existingTarget = targetEdgeMap.get(target) || [];
    existingTarget.push(edge);
    targetEdgeMap.set(target, existingTarget);
  }

  return { edgeMap, targetEdgeMap };
};

/**
 * Classifies nodes into workloads, internet, children, and maps their indices
 */
const classifyNodes = (currentNodes: Node[]) => {
  const workloads: Node[] = [];
  const internetNodes: Node[] = [];
  const nodeMap = new Map<string, Node>();
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

  return { workloads, internetNodes, nodeMap, childPodMap, nodeIndexMap };
};

/**
 * Generates continuous background log lines for a specific resource node
 */
const createLogLineForResource = (node: Node, point?: SimulationMetricPoint): string | null => {
  const timestamp = new Date().toISOString();
  const name = node.data.label || node.id;

  if (point?.isOOM) {
    return `[${timestamp}] [FATAL] Out of Memory (OOM) error occurred in container ${name}. Process terminated.`;
  }
  if (point?.isThrottled) {
    return `[${timestamp}] [WARNING] CPU limit reached for ${name}. Container execution throttled.`;
  }

  if (safeRandom() > 0.3) {
    const paths = ['/index.html', '/api/v1/data', '/api/v1/status', '/healthz', '/metrics'];
    const path = paths[Math.floor(safeRandom() * paths.length)];
    const clientIp = `10.244.0.${Math.floor(safeRandom() * 254) + 1}`;
    const statusCode = point?.isOOM ? '503' : '200 OK';
    return `[${timestamp}] ${clientIp} - GET ${path} - ${statusCode} - ${name}`;
  }

  return null;
};

/**
 * Simulates real-time continuous log streams for all loggable resources on each tick
 */
const simulateAllResourceLogs = (
  nodes: Node[],
  metrics: Record<string, SimulationMetricPoint[]>,
  set: (state: Partial<FlowState>) => void
) => {
  const loggableNodes = nodes.filter(n => ['Pod', 'Deployment', 'ReplicaSet'].includes(n.type));
  if (loggableNodes.length === 0) return;

  const newLogEntries: Record<string, string[]> = {};

  for (const node of loggableNodes) {
    const metricKey = node.parentId || node.id;
    const points = metrics[metricKey] || [];
    const lastPoint = points.at(-1);

    const logLine = createLogLineForResource(node, lastPoint);
    if (logLine) {
      newLogEntries[node.id] = [logLine];
    }
  }

  if (Object.keys(newLogEntries).length > 0) {
    set((state) => {
      const updatedTerminalLogs = { ...state.terminalLogs };
      for (const [id, lines] of Object.entries(newLogEntries)) {
        const existing = updatedTerminalLogs[id] || [];
        updatedTerminalLogs[id] = [...existing, ...lines].slice(-150);
      }
      return { terminalLogs: updatedTerminalLogs };
    });
  }
};

/**
 * Appends pod creation activity logs on ticks 1, 2, and 3
 */
const handleTicksActivityLogs = (ticks: number, workloads: Node[], set: (state: Partial<FlowState>) => void) => {
  if (ticks === 1) {
    const lines = workloads.map(w => {
      const name = w.data.label || w.id;
      return `${String(name).padEnd(38)} 0/1     Pending             0          1s`;
    });
    set(state => ({ activityLogs: [...state.activityLogs, ...lines] }));
  } else if (ticks === 2) {
    const lines = workloads.map(w => {
      const name = w.data.label || w.id;
      return `${String(name).padEnd(38)} 0/1     ContainerCreating   0          2s`;
    });
    set(state => ({ activityLogs: [...state.activityLogs, ...lines] }));
  } else if (ticks === 3) {
    const lines = workloads.map(w => {
      const name = w.data.label || w.id;
      return `${String(name).padEnd(38)} 1/1     Running             0          3s`;
    });
    set(state => ({ activityLogs: [...state.activityLogs, ...lines] }));
  }
};

/**
 * Helper to transition pending pods to ready
 */
const updatePendingPods = (updatedNodes: Node[], get: () => FlowState): boolean => {
  let hasChanges = false;
  for (let i = 0; i < updatedNodes.length; i++) {
    const node = updatedNodes[i];
    if (node.type === 'Pod' && node.data.status === 'pending') {
      const pendingTicks = (node.data.pendingTicks || 0) + 1;
      updatedNodes[i] = {
        ...node,
        data: {
          ...node.data,
          pendingTicks,
          status: pendingTicks >= 2 ? 'ready' : 'pending'
        }
      };
      if (pendingTicks >= 2) {
        const addActivityLog = get().addActivityLog;
        addActivityLog(`pod/${node.data.label || node.id} status transitioned from Pending to Running`);
      }
      hasChanges = true;
    }
  }
  return hasChanges;
};

/**
 * Helper to process a single deployment's rolling update step
 */
const processSingleDeploymentRollout = (
  dep: Node,
  depIndex: number,
  updatedNodes: Node[],
  get: () => FlowState
): boolean => {
  if (dep.type !== 'Deployment' || !dep.data.isRollingUpdate) {
    return false;
  }

  const childPods = updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
  const hasPendingPod = childPods.some(p => p.data.status === 'pending');
  if (hasPendingPod) {
    return false;
  }

  const oldPods = childPods.filter(p => p.data.image !== dep.data.rolloutTargetImage);
  if (oldPods.length > 0) {
    const firstOldPod = oldPods[0];
    const podIdx = updatedNodes.findIndex(n => n.id === firstOldPod.id);
    if (podIdx === -1) return false;

    updatedNodes[podIdx] = {
      ...updatedNodes[podIdx],
      data: {
        ...updatedNodes[podIdx].data,
        status: 'pending',
        pendingTicks: 0,
        image: dep.data.rolloutTargetImage
      }
    };

    const updatedCount = childPods.length - oldPods.length + 1;
    updatedNodes[depIndex] = {
      ...dep,
      data: {
        ...dep.data,
        rolloutStatus: `Updating ${updatedCount}/${childPods.length} replicas...`
      }
    };

    const addActivityLog = get().addActivityLog;
    addActivityLog(`[rollout] Scaling down old replica pod ${firstOldPod.data.label || firstOldPod.id}...`);
    addActivityLog(`[rollout] Scaling up new replica pod with image ${dep.data.rolloutTargetImage}...`);
    return true;
  }

  updatedNodes[depIndex] = {
    ...dep,
    data: {
      ...dep.data,
      isRollingUpdate: false,
      image: dep.data.rolloutTargetImage,
      rolloutStatus: 'Successfully rolled out'
    }
  };

  const addActivityLog = get().addActivityLog;
  addActivityLog(`deployment.apps/${dep.data.label || dep.id} successfully rolled out`);
  return true;
};

/**
 * Helper to process rolling updates for deployments
 */
const updateRollingDeployments = (updatedNodes: Node[], get: () => FlowState): boolean => {
  let hasChanges = false;
  for (let i = 0; i < updatedNodes.length; i++) {
    if (processSingleDeploymentRollout(updatedNodes[i], i, updatedNodes, get)) {
      hasChanges = true;
    }
  }
  return hasChanges;
};

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

  // 1. Transition pending pods to ready
  if (updatePendingPods(updatedNodes, get)) {
    hasOverallChanges = true;
  }

  // 2. Handle rolling updates for deployments
  if (updateRollingDeployments(updatedNodes, get)) {
    hasOverallChanges = true;
  }

  const { edgeMap, targetEdgeMap } = buildEdgeMaps(currentEdges);
  const { workloads, internetNodes, nodeMap, childPodMap, nodeIndexMap } = classifyNodes(currentNodes);

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

  // Simulate logs for ALL resources continuously in the background
  simulateAllResourceLogs(updatedNodes, newMetrics, set);

  // Append pod creation activity logs on ticks 1, 2, and 3
  handleTicksActivityLogs(ticks, workloads, set);

  set({ simulationMetrics: newMetrics, ...(hasOverallChanges ? { nodes: updatedNodes } : {}) });

  const stopParams = { ticks, workloads, nodes: updatedNodes, metrics: newMetrics, set, simulationInterval: simulationIntervalObj };
  if (!checkEmergencyStop(stopParams)) {
    broadcastMetrics(newMetrics, updatedNodes.filter(n => n.type === 'Deployment' || n.type === 'ReplicaSet' || (n.type === 'Pod' && !n.parentId)));
  }
};

/**
 * Returns group strings based on resource types for yaml activity logs
 */
const getResourceGroup = (type: string) => {
  if (type === 'Deployment' || type === 'ReplicaSet') {
    return '.apps';
  } else if (type === 'Ingress') {
    return '.networking.k8s.io';
  } else if (type === 'HPA') {
    return '.autoscaling';
  }
  return '';
};

/**
 * Build initial list of activity logs
 */
const buildInitialActivity = (nodes: Node[]) => {
  const initialActivity: string[] = [
    `$ kubectl apply -f k8s-manifest.yaml`,
  ];

  const k8sResources = nodes.filter(n =>
    ['Deployment', 'ReplicaSet', 'Pod', 'Service', 'Ingress', 'HPA', 'PVC', 'ConfigMap', 'Secret'].includes(n.type)
  );

  if (k8sResources.length > 0) {
    k8sResources.forEach(n => {
      const typeLower = n.type.toLowerCase();
      const group = getResourceGroup(n.type);
      const label = n.data.label || n.id;
      initialActivity.push(`${typeLower}${group}/${label} created`);
    });
  } else {
    initialActivity.push(`No resources defined in the canvas.`);
  }

  initialActivity.push(
    `$ kubectl get pods -w`,
    `${"NAME".padEnd(38)} READY   STATUS              RESTARTS   AGE`
  );

  return initialActivity;
};

/**
 * Build initial map of workload logs
 */
const buildInitialTerminalLogs = (nodes: Node[]) => {
  const initialTerminalLogs: Record<string, string[]> = {};
  nodes.forEach(n => {
    if (n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet') {
      const name = n.data.label || n.id;
      const image = n.data.image || 'nginx:latest';
      initialTerminalLogs[n.id] = [
        `$ kubectl logs ${n.type.toLowerCase()}/${name} -f`,
        `Initializing container for ${name}...`,
        `Pulling image "${image}"...`,
        `Successfully pulled image "${image}" in 1.45s`,
        `Creating container...`,
        `Started container!`,
        `Server is now listening on port 80/tcp`,
        `[INFO] Application instance is healthy and ready to accept traffic.`,
      ];
    }
  });
  return initialTerminalLogs;
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

      // Clear logs and show terminal
      const initialActivity = buildInitialActivity(nodes);
      const initialTerminalLogs = buildInitialTerminalLogs(nodes);

      set({
        isSimulating: true,
        activeSimulationEdges: activeEdges,
        simulationMetrics: {},
        isTerminalOpen: true,
        terminalActiveTab: 'activity',
        activityLogs: initialActivity,
        terminalLogs: initialTerminalLogs,
      });

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

/**
 * Refactored simulation stop logic to keep cognitive complexity low
 */
const handleStopSimulation = (
  nodes: Node[],
  set: (state: Partial<FlowState>) => void,
  get: () => FlowState
) => {
  stopSimulationInternal(set, get, simulationIntervalObj);
  const deleteActivity: string[] = [
    `$ kubectl delete -f k8s-manifest.yaml`,
  ];
  const k8sResources = nodes.filter(n =>
    ['Deployment', 'ReplicaSet', 'Pod', 'Service', 'Ingress', 'HPA', 'PVC', 'ConfigMap', 'Secret'].includes(n.type)
  );
  k8sResources.forEach(n => {
    const typeLower = n.type.toLowerCase();
    const group = getResourceGroup(n.type);
    const label = n.data.label || n.id;
    deleteActivity.push(`${typeLower}${group}/${label} deleted`);
  });
  set((state) => ({
    activityLogs: [...state.activityLogs, ...deleteActivity].slice(-200)
  }));
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
  canvasBgVariant: 'dots',
  canvasBgColor: 'default',
  canvasBgOpacity: 0.6,
  isHistoryViewOpen: false,

  // Update check & cheat code state
  simulatedUpdateInfo: null,
  isAdminAuthenticated: false,
  isAwaitingAdminPassword: false,
  adminLoginAttempts: 0,
  setSimulatedUpdateInfo: (info) => set({ simulatedUpdateInfo: info }),
  setIsAdminAuthenticated: (isAdmin) => set({ isAdminAuthenticated: isAdmin }),
  setHistoryViewOpen: (open) => set({ isHistoryViewOpen: open, isRightSidebarVisible: open }),

  // Terminal initial states & actions
  isTerminalOpen: false,
  terminalActiveTab: 'activity',
  terminalSelectedResourceId: null,
  terminalLogs: {},
  activityLogs: [],
  setTerminalOpen: (open) => set({ isTerminalOpen: open }),
  setTerminalActiveTab: (tab) => set({ terminalActiveTab: tab }),
  setTerminalSelectedResourceId: (id) => set({ terminalSelectedResourceId: id }),
  addTerminalLog: (resourceId, line) => set((state) => {
    const logs = state.terminalLogs[resourceId] || [];
    return {
      terminalLogs: {
        ...state.terminalLogs,
        [resourceId]: [...logs, line].slice(-200)
      }
    };
  }),
  addActivityLog: (line) => {
    if (globalThis.go?.main?.App?.WriteLog) {
      globalThis.go.main.App.WriteLog('history', 'info', line).catch(() => {});
    }
    set((state) => ({
      activityLogs: [...state.activityLogs, line].slice(-200)
    }));
  },
  clearTerminalLogs: () => set({ terminalLogs: {}, activityLogs: [] }),

  saveSettingsJson: () => {
    const state = get();
    const settings = {
      isSidebarVisible: state.isSidebarVisible,
      isRightSidebarVisible: state.isRightSidebarVisible,
      isAutofocusEnabled: state.isAutofocusEnabled,
      isMonitoringOpen: state.isMonitoringOpen,
      canvasBgVariant: state.canvasBgVariant,
      canvasBgColor: state.canvasBgColor,
      canvasBgOpacity: state.canvasBgOpacity,
    };
    if (globalThis.go?.main?.App?.SaveSetting) {
      globalThis.go.main.App.SaveSetting('app_settings_json', JSON.stringify(settings));
    }
  },
  loadSettingsJson: () => {
    if (globalThis.go?.main?.App?.GetSetting) {
      globalThis.go.main.App.GetSetting('app_settings_json').then((val: string) => {
        if (val) {
          applyParsedSettings(val, set);
        } else {
          fallbackToLegacySettings(set);
        }
      });
    }
  },
  setCanvasBgVariant: (variant) => {
    set({ canvasBgVariant: variant });
    get().saveSettingsJson();
  },
  setCanvasBgColor: (color) => {
    set({ canvasBgColor: color });
    get().saveSettingsJson();
  },
  setCanvasBgOpacity: (opacity) => {
    set({ canvasBgOpacity: opacity });
    get().saveSettingsJson();
  },
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
    if (globalThis.go?.main?.App?.SaveSetting) {
      globalThis.go.main.App.SaveSetting('globalEdgeColor', color);
      globalThis.go.main.App.SaveSetting('globalEdgeErrorColor', errorColor);
    }
  },
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state: FlowState) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  toggleAutofocus: () => {
    set((state: FlowState) => ({ isAutofocusEnabled: !state.isAutofocusEnabled }));
    get().saveSettingsJson();
  },
  setSidebarVisible: (visible) => {
    set({ isSidebarVisible: visible });
    if (globalThis.go?.main?.App?.SaveSetting) {
      globalThis.go.main.App.SaveSetting('isSidebarVisible', String(visible));
    }
    get().saveSettingsJson();
  },
  setRightSidebarVisible: (visible) => {
    set({ isRightSidebarVisible: visible });
    if (globalThis.go?.main?.App?.SaveSetting) {
      globalThis.go.main.App.SaveSetting('isRightSidebarVisible', String(visible));
    }
    get().saveSettingsJson();
  },
  setMonitoringOpen: (open) => {
    set({ isMonitoringOpen: open });
    get().saveSettingsJson();
  },
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
    const { nodes } = get();
    handleStopSimulation(nodes, set, get);
  },
});
