import { Node } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '@/types';
import type { FlowState } from '@/store/types';
import { formatPodName, sanitizeSlug } from '@/lib/utils';

/**
 * Creates node-level interaction handlers (`onDelete`, `onRename`) for a specific canvas node ID.
 *
 * @param id Unique target node ID
 * @param get Store state getter function
 * @returns Object containing `onDelete` and `onRename` callback handlers
 */
/**
 * Resolves target resource type, namespace parentId, and exclusion node ID
 * for name validation and duplicate detection across workload pods and standalone resources.
 *
 * @param nodeId Canvas node ID being evaluated
 * @param nodes List of all nodes in store
 * @param targetType Optional override type
 * @param targetParentId Optional override parentId
 * @param excludeNodeId Optional override excludeId
 * @returns Resolved type, parentId, and excludeId
 */
export const resolveTargetInfo = (
  nodeId: string,
  nodes: Node[] | any[],
  targetType?: string,
  targetParentId?: string,
  excludeNodeId?: string
): { type: string; parentId: string | undefined; excludeId: string } => {
  const targetNode = nodes.find((n) => n.id === nodeId);
  if (!targetNode) {
    return {
      type: targetType || '',
      parentId: targetParentId,
      excludeId: excludeNodeId || nodeId,
    };
  }

  const isPod = targetType === 'Pod' || (!targetType && targetNode.type === 'Pod');
  if (isPod && targetNode.parentId) {
    const parent = nodes.find((n) => n.id === targetNode.parentId);
    if (parent && ['Deployment', 'StatefulSet', 'ReplicaSet'].includes(parent.type || '')) {
      return {
        type: parent.type || '',
        parentId: targetParentId !== undefined ? targetParentId : parent.parentId,
        excludeId: excludeNodeId || parent.id,
      };
    }
  }

  return {
    type: targetType || targetNode.type || '',
    parentId: targetParentId !== undefined ? targetParentId : targetNode.parentId,
    excludeId: excludeNodeId || targetNode.id,
  };
};

/**
 * Checks whether a candidate resource name already exists for the given resource type
 * within the specified Namespace (or cluster-wide for Namespaces).
 *
 * @param candidateName Name to check
 * @param type K8s resource type (Kind)
 * @param parentId Namespace parent ID (or undefined for cluster/root)
 * @param currentNodes Current canvas nodes
 * @param excludeNodeId Node ID to exclude from comparison (e.g. self)
 * @returns boolean indicating if the candidate name is duplicate
 */
export const isDuplicateResourceName = (
  candidateName: string,
  type: string,
  parentId: string | undefined,
  currentNodes: Node[],
  excludeNodeId?: string
): boolean => {
  const sanitized = sanitizeSlug(candidateName);
  if (!sanitized) return false;

  const targetLower = sanitized.toLowerCase();

  return currentNodes.some((n) => {
    if (!n.type) return false;
    if (excludeNodeId && (n.id === excludeNodeId || n.parentId === excludeNodeId)) return false;

    // Namespaces are cluster-scoped, so their names must be globally unique
    if (type === 'Namespace' && n.type === 'Namespace') {
      const data = n.data as K8sNodeData;
      return (data?.label || '').toLowerCase() === targetLower;
    }

    if (n.type !== type) return false;

    const sameNamespace = (n.parentId || undefined) === (parentId || undefined);
    if (!sameNamespace) return false;

    const data = n.data as K8sNodeData;
    const existingName = (data?.baseName || data?.label || '').toLowerCase();
    return existingName === targetLower;
  });
};

/**
 * Ensures a resource name is unique for a given resource type (Kind) within a specific Namespace.
 * Two resources with the same Kind in the same Namespace cannot share the exact same name.
 * Resources with different Kinds in the same Namespace are allowed to have the same name.
 *
 * @param desiredName Desired resource name
 * @param type K8s resource type (Kind)
 * @param parentId Namespace parent ID (or undefined)
 * @param currentNodes Current canvas nodes
 * @param excludeNodeId Optional node ID to exclude (e.g. self during rename)
 * @returns Unique resource name compliant with RFC 1123
 */
export const ensureUniqueResourceName = (
  desiredName: string,
  type: string,
  parentId: string | undefined,
  currentNodes: Node[],
  excludeNodeId?: string
): string => {
  const sanitized = sanitizeSlug(desiredName) || `${type.toLowerCase()}`;

  if (!isDuplicateResourceName(sanitized, type, parentId, currentNodes, excludeNodeId)) {
    return sanitized;
  }

  let counter = 1;
  while (counter < 1000) {
    const candidate = sanitizeSlug(`${sanitized}-${counter}`);
    if (!isDuplicateResourceName(candidate, type, parentId, currentNodes, excludeNodeId)) {
      return candidate;
    }
    counter++;
  }

  return sanitizeSlug(`${sanitized}-${Date.now().toString(36)}`);
};

const handleRenamePod = (node: Node, rawClean: string, get: () => FlowState) => {
  let cleanBase = rawClean || 'pod';
  const currentParent = node.parentId ? get().nodes.find((n) => n.id === node.parentId) : null;
  if (currentParent && ['Deployment', 'StatefulSet', 'ReplicaSet'].includes(currentParent.type || '')) {
    if (currentParent.type === 'StatefulSet' || currentParent.data?.workloadType === 'StatefulSet') {
      cleanBase = rawClean.replace(/-\d+$/, '') || 'statefulset';
    }
    if (isDuplicateResourceName(cleanBase, currentParent.type || '', currentParent.parentId, get().nodes, currentParent.id)) {
      get().addLog?.('warn', `[Validation] Cannot rename: ${currentParent.type} '${cleanBase}' already exists in this namespace.`, 'UI');
      return;
    }
    get().updateNodeData(currentParent.id, { label: cleanBase });
    return;
  }

  if (isDuplicateResourceName(cleanBase, 'Pod', node.parentId, get().nodes, node.id)) {
    get().addLog?.('warn', `[Validation] Cannot rename: Pod '${cleanBase}' already exists in this namespace.`, 'UI');
    return;
  }
  const podHash = node.data?.podHash;
  const replicaSuffix = node.data?.replicaSuffix;
  const replicas = node.data?.replicas || 1;
  const newLabel = formatPodName(cleanBase, podHash, replicaSuffix, replicas);
  get().updateNodeData(node.id, {
    baseName: cleanBase,
    label: newLabel,
  });
};

export const createNodeHandlers = (id: string, get: () => FlowState) => ({
  onDelete: () => {
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node) get().deleteNodes([node]);
  },
  onRename: (newName: string) => {
    const rawClean = sanitizeSlug(newName);
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node?.type === 'Pod') {
      handleRenamePod(node, rawClean, get);
      return;
    }
    const cleanBase = rawClean || node?.type?.toLowerCase() || 'resource';
    if (node && isDuplicateResourceName(cleanBase, node.type || '', node.parentId, get().nodes, id)) {
      get().addLog?.('warn', `[Validation] Cannot rename: ${node.type} '${cleanBase}' already exists.`, 'UI');
      return;
    }
    get().updateNodeData(id, { label: cleanBase });
  }
});

/**
 * Generates initial default node data payload according to Kubernetes resource type.
 *
 * @param type K8s resource node type
 * @param id Unique node ID
 * @param get Store state getter
 * @returns Initial node data object with defaults and handlers attached
 */
export const getInitialData = (type: K8sResourceType, id: string, get: () => FlowState): K8sNodeData => {
  const handlers = createNodeHandlers(id, get);
  const base: K8sNodeData = {
    label: `new-${type.toLowerCase()}`,
    type,
    image: '',
    status: 'pending',
    ...handlers,
    displaySettings: {},
    yamlSettings: {}
  };

  switch (type) {
    case 'Service':
      return {
        ...base,
        serviceType: 'ClusterIP',
        port: 80,
        targetPort: 80,
        nodePort: undefined,
        selector: 'app-label',
        displaySettings: { serviceType: true, nodePort: true, port: true, targetPort: true, selector: true },
        yamlSettings: { serviceType: true, nodePort: true, targetPort: true, selector: true }
      };
    case 'Pod':
      return {
        ...base,
        replicas: 1,
        image: '',
        restartPolicy: 'Always',
        workloadType: 'Deployment',
        status: 'pending',
        displaySettings: { image: true, resources: false, restartPolicy: true, workloadType: true },
        yamlSettings: { image: true, resources: true, restartPolicy: true, workloadType: true }
      };
    case 'Deployment':
    case 'StatefulSet':
      return {
        ...base,
        replicas: 0,
        image: '',
        workloadType: type === 'StatefulSet' ? 'StatefulSet' : 'Deployment',
        status: 'pending',
        displaySettings: { image: true, resources: false, workloadType: true },
        yamlSettings: { image: true, resources: true, workloadType: true }
      };
    case 'Ingress':
      return {
        ...base,
        ingressHost: 'example.local',
        ingressPath: '/',
        displaySettings: { host: true, path: false },
        yamlSettings: { path: true }
      };
    case 'HPA':
      return {
        ...base,
        minReplicas: 1,
        maxReplicas: 10,
        targetCPU: 50,
        displaySettings: { replicas: false, targetCPU: false, targetMemory: false },
        yamlSettings: { replicas: true, targetCPU: true, targetMemory: true }
      };
    case 'Internet':
      return {
        ...base,
        displaySettings: { traffic: false }
      };
    case 'PVC':
      return {
        ...base,
        displaySettings: { storageClass: false },
        yamlSettings: { storageClass: true }
      };
    case 'ConfigMap':
    case 'Secret':
      return {
        ...base,
        displaySettings: { data: false },
        yamlSettings: { data: true }
      };
    case 'Role':
      return {
        ...base,
        rules: [
          {
            apiGroups: [''],
            resources: ['pods', 'services'],
            verbs: ['get', 'list', 'watch']
          }
        ],
        displaySettings: { rules: true },
        yamlSettings: { rules: true }
      };
    default:
      return base;
  }
};

/**
 * Sanitizes and clamps numerical resource limits (replicas, minReplicas, maxReplicas) within safe bounds.
 *
 * @param data Node data updates patch
 * @returns Sanitized node data patch
 */
export const sanitizeResourceLimits = (data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  const res = { ...data };
  const limit = (val: any, min: number, max: number) => Math.max(min, Math.min(max, Number(val)));
  if (res.replicas !== undefined) res.replicas = limit(res.replicas, 0, 1000);
  if (res.minReplicas !== undefined) res.minReplicas = limit(res.minReplicas, 1, 1000);
  if (res.maxReplicas !== undefined) res.maxReplicas = limit(res.maxReplicas, 1, 1000);
  return res;
};

/**
 * Resolves standard Docker container image names based on selected runtime and webserver frameworks.
 *
 * @param runtime Target runtime identifier ('nodejs', 'go', 'python', 'java', 'php')
 * @param webserver Target webserver identifier ('nginx', 'apache')
 * @returns Container image tag string
 */
export const resolveAutoImage = (runtime: string, webserver: string) => {
  if (runtime === 'nodejs') return 'node:18-alpine';
  if (runtime === 'go') return 'golang:1.21-alpine';
  if (runtime === 'python') return 'python:3.11-slim';
  if (runtime === 'java') return 'openjdk:17-jdk-slim';
  if (runtime === 'php') {
    if (webserver === 'nginx') return 'php:8.2-fpm-alpine';
    if (webserver === 'apache') return 'php:8.2-apache';
    return 'php:8.2-cli-alpine';
  }
  if (webserver === 'nginx') return 'nginx:latest';
  if (webserver === 'apache') return 'httpd:latest';
  return 'nginx:latest';
};

/**
 * Automatically updates node container image tag when runtime or webserver settings change.
 *
 * @param targetData Current node data object
 * @param data Incoming data updates
 * @returns Patch object with resolved auto-image tag if auto-image mode is active
 */
export const applyAutoImageLogic = (targetData: K8sNodeData, data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  if (data.runtime === undefined && data.webserver === undefined) return data;
  const rt = data.runtime ?? targetData.runtime ?? 'none';
  const ws = data.webserver ?? targetData.webserver ?? 'none';
  if (!targetData.image || targetData.isAutoImage) {
    return { ...data, image: resolveAutoImage(rt, ws), isAutoImage: true };
  }
  return data;
};

/**
 * Synchronizes workload status ('ready' vs 'pending') and auto-image properties based on metadata configuration.
 *
 * @param type K8s resource node type
 * @param data Workload data object
 * @returns Updated workload node data patch
 */
export const syncWorkloadMetadata = (type: string, data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  if (!['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet'].includes(type)) return data;

  const nextData = { ...data };
  if (data.image) {
    nextData.status = 'ready';
  } else if (data.image === '') {
    nextData.status = 'pending';
  }

  return nextData;
};