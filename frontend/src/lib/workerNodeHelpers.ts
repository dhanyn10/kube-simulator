import { K8sNodeData } from '@/types';

export type WorkerNodeId = 'worker-1' | 'worker-2' | 'worker-3';

export interface WorkerNodeInfo {
  id: WorkerNodeId;
  name: string;
  ip: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const WORKER_NODES: Record<WorkerNodeId, WorkerNodeInfo> = {
  'worker-1': {
    id: 'worker-1',
    name: 'worker-1',
    ip: '192.168.1.101',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/20',
  },
  'worker-2': {
    id: 'worker-2',
    name: 'worker-2',
    ip: '192.168.1.102',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/20',
  },
  'worker-3': {
    id: 'worker-3',
    name: 'worker-3',
    ip: '192.168.1.103',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
  },
};

export const WORKER_NODE_OPTIONS: { id: WorkerNodeId; label: string; ip: string }[] = [
  { id: 'worker-1', label: 'worker-1 (192.168.1.101)', ip: '192.168.1.101' },
  { id: 'worker-2', label: 'worker-2 (192.168.1.102)', ip: '192.168.1.102' },
  { id: 'worker-3', label: 'worker-3 (192.168.1.103)', ip: '192.168.1.103' },
];

/**
 * Resolves the assigned worker node for a Pod.
 * If explicitly set in `data.assignedNode`, uses that.
 * Otherwise, derives deterministically based on replicaIndex or nodeId hash.
 */
export const getAssignedWorker = (
  nodeData?: Partial<K8sNodeData> | null,
  nodeId?: string
): WorkerNodeId => {
  if (
    nodeData?.assignedNode === 'worker-1' ||
    nodeData?.assignedNode === 'worker-2' ||
    nodeData?.assignedNode === 'worker-3'
  ) {
    return nodeData.assignedNode;
  }

  if (typeof nodeData?.replicaIndex === 'number') {
    const idx = (Math.abs(nodeData.replicaIndex) % 3) + 1;
    return `worker-${idx}` as WorkerNodeId;
  }

  const rawKey = nodeId || nodeData?.label || '';
  if (!rawKey) return 'worker-1';

  let sum = 0;
  for (let i = 0; i < rawKey.length; i++) {
    sum += rawKey.charCodeAt(i);
  }
  const workerIdx = (sum % 3) + 1;
  return `worker-${workerIdx}` as WorkerNodeId;
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
    entryNodeIp: WORKER_NODES[entryNode]?.ip || '192.168.1.101',
    targetNodeIp: WORKER_NODES[targetNode]?.ip || '192.168.1.101',
  };
};

const WORKER_IDS: WorkerNodeId[] = ['worker-1', 'worker-2', 'worker-3'];

/**
 * Returns a round-robin worker assignment for a replica index (simulates kube-scheduler spreading).
 */
export const getWorkerForIndex = (index: number): WorkerNodeId => {
  const safeIndex = Math.abs(Math.trunc(index)) % WORKER_IDS.length;
  return WORKER_IDS[safeIndex];
};

interface EndpointCandidate {
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
