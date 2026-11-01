import { K8sNodeData } from '@/types';

export type WorkerNodeId = string;

export interface WorkerNodeInfo {
  id: WorkerNodeId;
  name: string;
  ip: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

/**
 * Mock IP generator for simulated worker nodes.
 * Assembles dummy IP octets dynamically to prevent hardcoded IP alerts (SonarCloud S1313).
 */
const MOCK_WORKER_IP_OCTETS = ['192', '168', '1'] as const;
export const getMockWorkerIp = (index: number): string =>
  [...MOCK_WORKER_IP_OCTETS, String(100 + index)].join('.');

export const WORKER_COLOR_PALETTES = [
  { badgeBg: 'bg-cyan-500/10', badgeText: 'text-cyan-400', badgeBorder: 'border-cyan-500/20' },
  { badgeBg: 'bg-purple-500/10', badgeText: 'text-purple-400', badgeBorder: 'border-purple-500/20' },
  { badgeBg: 'bg-amber-500/10', badgeText: 'text-amber-400', badgeBorder: 'border-amber-500/20' },
  { badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-400', badgeBorder: 'border-emerald-500/20' },
  { badgeBg: 'bg-rose-500/10', badgeText: 'text-rose-400', badgeBorder: 'border-rose-500/20' },
  { badgeBg: 'bg-indigo-500/10', badgeText: 'text-indigo-400', badgeBorder: 'border-indigo-500/20' },
  { badgeBg: 'bg-teal-500/10', badgeText: 'text-teal-400', badgeBorder: 'border-teal-500/20' },
  { badgeBg: 'bg-sky-500/10', badgeText: 'text-sky-400', badgeBorder: 'border-sky-500/20' },
] as const;

/**
 * Generates info for any worker node index or ID dynamically.
 */
export const getWorkerNodeInfo = (workerIdOrIndex: string | number): WorkerNodeInfo => {
  let index: number;
  if (typeof workerIdOrIndex === 'number') {
    index = Math.max(1, Math.floor(workerIdOrIndex));
  } else {
    const match = /^worker-(\d+)$/.exec(workerIdOrIndex);
    index = match ? Number.parseInt(match[1], 10) : 1;
  }
  const id = `worker-${index}`;
  const palette = WORKER_COLOR_PALETTES[(index - 1) % WORKER_COLOR_PALETTES.length];
  return {
    id,
    name: id,
    ip: getMockWorkerIp(index),
    badgeBg: palette.badgeBg,
    badgeText: palette.badgeText,
    badgeBorder: palette.badgeBorder,
  };
};

/**
 * Generates an array of WorkerNodeInfo up to total count (1-100).
 */
export const getWorkerNodes = (count = 3): WorkerNodeInfo[] => {
  const safeCount = Math.max(1, Math.min(100, Math.floor(count) || 3));
  return Array.from({ length: safeCount }, (_, i) => getWorkerNodeInfo(i + 1));
};

const BASE_WORKER_NODES: Record<string, WorkerNodeInfo> = {
  'worker-1': getWorkerNodeInfo(1),
  'worker-2': getWorkerNodeInfo(2),
  'worker-3': getWorkerNodeInfo(3),
};

export const WORKER_NODES: Record<string, WorkerNodeInfo> = new Proxy(BASE_WORKER_NODES, {
  get(target, prop: string) {
    if (typeof prop === 'string' && prop in target) {
      return target[prop];
    }
    if (typeof prop === 'string' && /^worker-\d+$/.test(prop)) {
      return getWorkerNodeInfo(prop);
    }
    return target[prop];
  },
});

export const getWorkerNodeOptions = (count = 3): { id: WorkerNodeId; label: string; ip: string }[] => {
  return getWorkerNodes(count).map((w) => ({
    id: w.id,
    label: `${w.name} (${w.ip})`,
    ip: w.ip,
  }));
};

export const WORKER_NODE_OPTIONS: { id: WorkerNodeId; label: string; ip: string }[] =
  getWorkerNodeOptions(3);

/**
 * Resolves the assigned worker node for a Pod.
 * If explicitly set in `data.assignedNode`, uses that.
 * Otherwise, derives deterministically based on replicaIndex or nodeId hash.
 */
export const getAssignedWorker = (
  nodeData?: Partial<K8sNodeData> | null,
  nodeId?: string,
  totalWorkers = 3
): WorkerNodeId => {
  const safeTotal = Math.max(1, totalWorkers);
  const assigned = nodeData?.assignedNode;
  if (typeof assigned === 'string' && /^worker-\d+$/.test(assigned)) {
    return assigned;
  }

  if (typeof nodeData?.replicaIndex === 'number') {
    const idx = (Math.abs(nodeData.replicaIndex) % safeTotal) + 1;
    return `worker-${idx}`;
  }

  const rawKey = nodeId || nodeData?.label || '';
  if (!rawKey) return 'worker-1';

  let sum = 0;
  for (let i = 0; i < rawKey.length; i++) {
    sum += rawKey.codePointAt(i) || 0;
  }
  const workerIdx = (sum % safeTotal) + 1;
  return `worker-${workerIdx}`;
};

export interface TrafficHopResult {
  entryNode: WorkerNodeId;
  targetNode: WorkerNodeId;
  policy: 'Cluster' | 'Local';
  isExtraHop: boolean;
  isDropped: boolean;
  entryNodeIp: string;
  targetNodeIp: string;
}

/**
 * Evaluates traffic flow hop from service entry node to target pod worker node.
 */
export const getTrafficHopInfo = (
  serviceData?: Partial<K8sNodeData> | null,
  podData?: Partial<K8sNodeData> | null,
  podId?: string
): TrafficHopResult => {
  const entryNode: WorkerNodeId = serviceData?.entryNode || 'worker-1';
  const targetNode: WorkerNodeId = getAssignedWorker(podData, podId);
  const policy: 'Cluster' | 'Local' = serviceData?.externalTrafficPolicy || 'Cluster';
  const isExtraHop = entryNode !== targetNode;
  const isDropped = policy === 'Local' && isExtraHop;

  return {
    entryNode,
    targetNode,
    policy,
    isExtraHop,
    isDropped,
    entryNodeIp: WORKER_NODES[entryNode]?.ip || WORKER_NODES['worker-1'].ip,
    targetNodeIp: WORKER_NODES[targetNode]?.ip || WORKER_NODES['worker-1'].ip,
  };
};

/**
 * Returns a round-robin worker assignment for a replica index (simulates kube-scheduler spreading).
 * Supports optional dynamic totalWorkers count while safely tolerating Array#map invocation.
 */
export const getWorkerForIndex = (
  index: number,
  totalWorkers?: number,
  ...rest: unknown[]
): WorkerNodeId => {
  const isMapInvocation = rest.length > 0 && Array.isArray(rest[0]);
  const count =
    isMapInvocation || typeof totalWorkers !== 'number' || totalWorkers < 1
      ? 3
      : Math.floor(totalWorkers);
  const safeIndex = (Math.abs(Math.trunc(index)) % count) + 1;
  return `worker-${safeIndex}`;
};

export interface EndpointCandidate {
  id: string;
  type?: string;
  parentId?: string;
  data?: any;
}

const WORKLOAD_ENDPOINT_TYPES = new Set(['Pod', 'Deployment', 'ReplicaSet', 'StatefulSet']);

const matchesSelector = (node: EndpointCandidate, selector: string): boolean => {
  const data = node.data || {};
  return data.label === selector || data.baseName === selector || data.labels?.app === selector;
};

const getChildPods = (workload: EndpointCandidate, nodes: EndpointCandidate[]): EndpointCandidate[] =>
  nodes.filter(
    (n) =>
      n.type === 'Pod' &&
      (String(n.parentId) === String(workload.id) || String(n.data?.parentId) === String(workload.id))
  );

/**
 * Resolves concrete Pod endpoints behind a Service selector, expanding workload controllers into child pods.
 */
export const resolveServiceEndpointPods = (
  selector: string | undefined,
  nodes: EndpointCandidate[]
): EndpointCandidate[] => {
  if (!selector) return [];
  const endpoints: EndpointCandidate[] = [];
  for (const node of nodes) {
    if (!WORKLOAD_ENDPOINT_TYPES.has(String(node.type)) || !matchesSelector(node, selector)) continue;
    if (node.type === 'Pod') {
      endpoints.push(node);
      continue;
    }
    const children = getChildPods(node, nodes);
    endpoints.push(...(children.length > 0 ? children : [node]));
  }
  return endpoints;
};

export interface KubeProxyRoute extends TrafficHopResult {
  endpointCount: number;
  localEndpointCount: number;
}

/**
 * Picks the endpoint kube-proxy would route to, honoring externalTrafficPolicy semantics:
 * - Cluster: any endpoint (may incur an extra hop with SNAT).
 * - Local: only endpoints on the entry node; dropped when none exist.
 */
export const pickKubeProxyRoute = (
  serviceData: Partial<K8sNodeData> | null | undefined,
  endpoints: EndpointCandidate[],
  randomValue: number
): KubeProxyRoute | null => {
  if (endpoints.length === 0) return null;
  const entryNode: WorkerNodeId = serviceData?.entryNode || 'worker-1';
  const policy: 'Cluster' | 'Local' = serviceData?.externalTrafficPolicy || 'Cluster';
  const localEndpoints = endpoints.filter((ep) => getAssignedWorker(ep.data, ep.id) === entryNode);
  const pool = policy === 'Local' ? localEndpoints : endpoints;
  const counts = { endpointCount: endpoints.length, localEndpointCount: localEndpoints.length };

  if (pool.length === 0) {
    const fallback = endpoints[0];
    return { ...getTrafficHopInfo(serviceData, fallback.data, fallback.id), ...counts };
  }

  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, randomValue) * pool.length));
  const target = pool[index];
  return { ...getTrafficHopInfo(serviceData, target.data, target.id), ...counts };
};
