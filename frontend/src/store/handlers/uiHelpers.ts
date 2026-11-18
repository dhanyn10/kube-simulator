import type { FlowState } from '@/store/types';
import { Node } from '@xyflow/react';
import { safeRandom } from '@/lib/utils';
import { pickKubeProxyRoute, resolveServiceEndpointPods } from '@/lib/workerNodeHelpers';

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
      ...(typeof settings.isTerminalAutoOpenOnPlay === 'boolean' ? { isTerminalAutoOpenOnPlay: settings.isTerminalAutoOpenOnPlay } : {}),
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
export const buildEdgeMaps = (edges: any[]) => {
  const edgeMap = new Map<string, any[]>();
  const targetEdgeMap = new Map<string, any[]>();

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
    if (node.type === 'Deployment' || node.type === 'StatefulSet' || node.type === 'ReplicaSet' || (node.type === 'Pod' && !node.parentId)) {
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
 * Formats a live kube-proxy log line for NodePort or LoadBalancer services.
 */
export const createServiceKubeProxyLog = (node: Node, allNodes: Node[]): string | null => {
  const serviceType = node.data?.serviceType || 'ClusterIP';
  if (serviceType !== 'NodePort' && serviceType !== 'LoadBalancer') return null;

  const endpoints = resolveServiceEndpointPods(node.data?.selector as string | undefined, allNodes);
  const route = pickKubeProxyRoute(node.data, endpoints, safeRandom());
  if (!route) return null;

  const timestamp = new Date().toISOString();
  const svcName = node.data?.label || node.id;
  const prefix = `[${timestamp}] [kube-proxy] svc/${svcName}`;

  if (route.isDropped) {
    return `${prefix} externalTrafficPolicy=Local: No local endpoints on ${route.entryNode} (0/${route.endpointCount}). Packet dropped (client IP preserved).`;
  }
  if (route.isExtraHop) {
    return `${prefix} [Node Hop] Ingress on ${route.entryNode} (${route.entryNodeIp}) -> Extra hop to ${route.targetNode} (${route.targetNodeIp}) via SNAT.`;
  }
  return `${prefix} Ingress on ${route.entryNode} -> Direct local routing to ${route.targetNode} (${route.localEndpointCount}/${route.endpointCount} local endpoints, client IP preserved).`;
};

export interface ParsedLogLine {
  timestamp: string | null;
  coreMessage: string;
  count: number;
}

const parseTimestampPrefix = (line: string): { timestamp: string | null; rest: string } => {
  if (line.startsWith('[')) {
    const closeBracketIdx = line.indexOf(']');
    if (closeBracketIdx > 0 && closeBracketIdx <= 40) {
      return {
        timestamp: line.slice(1, closeBracketIdx),
        rest: line.slice(closeBracketIdx + 1).trimStart(),
      };
    }
  }
  return { timestamp: null, rest: line };
};

const parseRepeatCountSuffix = (rest: string): { coreMessage: string; count: number } => {
  if (rest.endsWith(')')) {
    const openParenIdx = rest.lastIndexOf(' (x');
    if (openParenIdx !== -1) {
      const countStr = rest.slice(openParenIdx + 3, -1);
      const parsedNum = Number(countStr);
      if (!Number.isNaN(parsedNum) && parsedNum > 1 && parsedNum < 1_000_000) {
        return {
          coreMessage: rest.slice(0, openParenIdx),
          count: parsedNum,
        };
      }
    }
  }
  return { coreMessage: rest, count: 1 };
};

/**
 * Parses a log line string, separating optional timestamp prefix and repeat count suffix.
 */
export const parseLogLine = (line: string): ParsedLogLine => {
  const { timestamp, rest } = parseTimestampPrefix(line);
  const { coreMessage, count } = parseRepeatCountSuffix(rest);
  return { timestamp, coreMessage, count };
};

/**
 * Re-constructs a log line with optional timestamp and repeat count suffix.
 */
export const formatLogLineWithCount = (
  coreMessage: string,
  timestamp: string | null,
  count: number
): string => {
  const prefix = timestamp ? `[${timestamp}] ` : '';
  const suffix = count > 1 ? ` (x${count})` : '';
  return `${prefix}${coreMessage}${suffix}`;
};

/**
 * Deduplicates consecutive similar log lines by updating the timestamp in-place
 * and incrementing the repeat counter badge (e.g. `(x2)`, `(x3)`).
 */
export const deduplicateOrAppendLogLine = (
  existingLines: string[],
  newLine: string
): string[] => {
  if (existingLines.length === 0) {
    return [newLine];
  }

  const lastLine = existingLines[existingLines.length - 1];
  const lastParsed = parseLogLine(lastLine);
  const newParsed = parseLogLine(newLine);

  if (lastParsed.coreMessage === newParsed.coreMessage) {
    const nextTimestamp = newParsed.timestamp ?? lastParsed.timestamp;
    const updatedLine = formatLogLineWithCount(
      lastParsed.coreMessage,
      nextTimestamp,
      lastParsed.count + 1
    );
    return [...existingLines.slice(0, -1), updatedLine];
  }

  return [...existingLines, newLine];
};

/**
 * Sequentially appends and deduplicates an array of log lines.
 */
export const deduplicateOrAppendLogLines = (
  existingLines: string[],
  newLines: string[]
): string[] => {
  let result = existingLines;
  for (const line of newLines) {
    result = deduplicateOrAppendLogLine(result, line);
  }
  return result;
};

export interface LogLineOptions {
  hasTraffic?: boolean;
  allowAccessLogs?: boolean;
}

export interface SimulateLogsOptions {
  ticks?: number;
  hasActiveInternetTraffic?: boolean;
  reachableNodeIds?: Set<string>;
}

const generateHttpAccessLogLine = (nodeName: string, point?: any): string => {
  const timestamp = new Date().toISOString();
  const paths = ['/index.html', '/api/v1/data', '/api/v1/status', '/healthz', '/metrics'];
  const path = paths[Math.floor(safeRandom() * paths.length)];
  const clientIp = `10.244.0.${Math.floor(safeRandom() * 254) + 1}`;
  const statusCode = point?.isOOM ? '503' : '200 OK';
  return `[${timestamp}] ${clientIp} - GET ${path} - ${statusCode} - ${nodeName}`;
};

/**
 * Generates continuous background log lines for a specific resource node.
 *
 * @param node Target resource node
 * @param point Optional simulation metric point
 * @param allNodes Optional list of all canvas nodes
 * @param options Optional flags controlling access log generation
 * @returns Log line string or null
 */
export const createLogLineForResource = (
  node: Node,
  point?: any,
  allNodes?: Node[],
  options?: LogLineOptions
): string | null => {
  if (node.type === 'Service') {
    return allNodes ? createServiceKubeProxyLog(node, allNodes) : null;
  }

  const timestamp = new Date().toISOString();
  const name = node.data.label || node.id;

  if (point?.isOOM) {
    return `[${timestamp}] [FATAL] Out of Memory (OOM) error occurred in container ${name}. Process terminated.`;
  }
  if (point?.isThrottled) {
    return `[${timestamp}] [WARNING] CPU limit reached for ${name}. Container execution throttled.`;
  }

  const allowAccessLogs = options?.allowAccessLogs ?? true;
  const hasTraffic = options?.hasTraffic ?? true;
  if (allowAccessLogs && hasTraffic && safeRandom() > 0.3) {
    return generateHttpAccessLogLine(name, point);
  }

  return null;
};

const collectServiceActivityLog = (node: Node, logLine: string, ticks?: number): string | null => {
  if (node.type !== 'Service') return null;
  const isCrucial = logLine.includes('Packet dropped') || logLine.includes('Node Hop');
  const isSampleTick = ticks === undefined || ticks % 20 === 0;
  return isCrucial || isSampleTick ? logLine : null;
};

/**
 * Simulates real-time continuous log streams for all loggable resources on each tick.
 *
 * @param nodes Current nodes
 * @param metrics Current simulation metrics
 * @param set Store state setter
 * @param options Optional flags and active internet state to throttle synthetic access logs
 */
export const simulateAllResourceLogs = (
  nodes: Node[],
  metrics: Record<string, any[]>,
  set: (partial: Partial<FlowState> | ((state: FlowState) => Partial<FlowState>)) => void,
  options?: SimulateLogsOptions
) => {
  const loggableNodes = nodes.filter(n => ['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet', 'Service'].includes(n.type));
  if (loggableNodes.length === 0) return;

  const newLogEntries: Record<string, string[]> = {};
  const newActivityLines: string[] = [];
  const allowAccessLogs = options?.ticks === undefined || options.ticks % 10 === 0;
  const hasActiveInternet = options?.hasActiveInternetTraffic ?? true;

  for (const node of loggableNodes) {
    const metricKey = node.parentId || node.id;
    const points = metrics[metricKey] || [];
    const lastPoint = points.at(-1);

    const logLine = createLogLineForResource(node, lastPoint, nodes, {
      hasTraffic: hasActiveInternet,
      allowAccessLogs,
    });

    if (logLine) {
      newLogEntries[node.id] = [logLine];
      const svcActivity = collectServiceActivityLog(node, logLine, options?.ticks);
      if (svcActivity) newActivityLines.push(svcActivity);
    }
  }

  if (Object.keys(newLogEntries).length > 0 || newActivityLines.length > 0) {
    set((state) => {
      const updatedTerminalLogs = { ...state.terminalLogs };
      for (const [id, lines] of Object.entries(newLogEntries)) {
        const existing = updatedTerminalLogs[id] || [];
        updatedTerminalLogs[id] = deduplicateOrAppendLogLines(existing, lines).slice(-150);
      }
      return {
        terminalLogs: updatedTerminalLogs,
        ...(newActivityLines.length > 0
          ? { activityLogs: deduplicateOrAppendLogLines(state.activityLogs, newActivityLines).slice(-200) }
          : {}),
      };
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
export const removeUserFromRole = (role: any, username: string): any => {
  if (!role.assignedUsers) return role;
  return {
    ...role,
    assignedUsers: role.assignedUsers.filter((u: string) => u !== username),
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
    const cleanedRoles = (node.data.roles as any[]).map((role) => removeUserFromRole(role, username));
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
  const updatedRoles = node.data.roles.map((role: any) => ({
    ...role,
    assignedUsers: role.assignedUsers?.map((uname: string) => (uname === oldName ? newName : uname)),
  }));
  return { ...node, data: { ...node.data, roles: updatedRoles } };
};
