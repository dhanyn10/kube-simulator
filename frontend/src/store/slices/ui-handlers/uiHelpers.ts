import { FlowState, SimulationMetricPoint } from '@/store/types';
import { K8sRoleItem, KubeIAMUser } from '@/types';
import { safeRandom } from '@/lib/utils';
import { Node, Edge } from '@xyflow/react';
import {
  stopSimulation as stopSimulationInternal,
  broadcastMetrics,
  checkEmergencyStop,
} from '@/store/slices/simulationManager';
import { SimulationContext, processWorkloadSimulation, updateInternetTraffic, calculateReachability } from '@/lib/simulation';

/**
 * Parses settings JSON string and applies valid fields to state.
 *
 * @param val Settings JSON string
 * @param set Store state setter
 */
export const applyParsedSettings = (val: string, set: (state: Partial<FlowState>) => void): void => {
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
    // Handled silently
  }
};

/**
 * Builds standard edge maps to classify connected edges.
 *
 * @param edges Current canvas edges
 * @returns Object with edgeMap and targetEdgeMap
 */
export const buildEdgeMaps = (edges: Edge[]) => {
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
 * Classifies nodes into workloads, internet, children, and maps their indices.
 *
 * @param currentNodes Current canvas nodes
 * @returns Categorized node collections and maps
 */
export const classifyNodes = (currentNodes: Node[]) => {
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
 * Generates continuous background log lines for a specific resource node.
 *
 * @param node Target resource node
 * @param point Optional simulation metric point
 * @returns Log line string or null
 */
export const createLogLineForResource = (node: Node, point?: SimulationMetricPoint): string | null => {
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
 * Simulates real-time continuous log streams for all loggable resources on each tick.
 *
 * @param nodes Current nodes
 * @param metrics Current simulation metrics
 * @param set Store state setter
 */
export const simulateAllResourceLogs = (
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
 * Removes assigned username from a role's assignedUsers array.
 *
 * @param role Target K8s role item
 * @param username Username to remove
 * @returns Updated K8s role item
 */
export const removeUserFromRole = (role: K8sRoleItem, username: string): K8sRoleItem => {
  if (!role.assignedUsers) return role;
  return {
    ...role,
    assignedUsers: role.assignedUsers.filter((u) => u !== username),
  };
};

/**
 * Purges deleted IAM user from roles across all canvas nodes.
 *
 * @param nodes Canvas nodes
 * @param username Deleted username
 * @returns Updated nodes array
 */
export const purgeUserFromNodes = (nodes: Node[], username: string): Node[] => {
  return nodes.map((node) => {
    if (!node.data?.roles || !Array.isArray(node.data.roles)) return node;
    const cleanedRoles = (node.data.roles as K8sRoleItem[]).map((role) => removeUserFromRole(role, username));
    return {
      ...node,
      data: {
        ...node.data,
        roles: cleanedRoles,
      },
    };
  });
};

/**
 * Renames user in node's attached roles.
 *
 * @param node Canvas node
 * @param oldName Old username
 * @param newName New username
 * @returns Updated canvas node
 */
export const renameUserInNodeRoles = (node: Node, oldName: string, newName: string): Node => {
  if (!Array.isArray(node.data?.roles)) return node;
  const updatedRoles = node.data.roles.map((role) => ({
    ...role,
    assignedUsers: role.assignedUsers?.map((uname) => (uname === oldName ? newName : uname)),
  }));
  return { ...node, data: { ...node.data, roles: updatedRoles } };
};
