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
export const createNodeHandlers = (id: string, get: () => FlowState) => ({
  onDelete: () => {
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node) get().deleteNodes([node]);
  },
  onRename: (newName: string) => {
    const cleanBase = sanitizeSlug(newName) || 'pod';
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node?.type === 'Pod') {
      const podHash = node.data?.podHash;
      const replicaSuffix = node.data?.replicaSuffix;
      const currentParent = node.parentId ? get().nodes.find(n => n.id === node.parentId) : null;

      if (currentParent && (currentParent.type === 'Deployment' || currentParent.type === 'ReplicaSet')) {
        get().updateNodeData(currentParent.id, { label: cleanBase });
      } else {
        const replicas = node.data?.replicas || 1;
        const newLabel = formatPodName(cleanBase, podHash, replicaSuffix, replicas);
        get().updateNodeData(id, {
          baseName: cleanBase,
          label: newLabel,
        });
      }
    } else {
      get().updateNodeData(id, { label: cleanBase });
    }
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
        port: 80,
        targetPort: 80,
        selector: 'app-label',
        displaySettings: { port: true, targetPort: false, selector: false },
        yamlSettings: { targetPort: true, selector: true }
      };
    case 'Pod':
      return {
        ...base,
        replicas: 1,
        image: '',
        restartPolicy: 'Always',
        status: 'pending',
        displaySettings: { image: false, resources: false },
        yamlSettings: { image: true, resources: true }
      };
    case 'Deployment':
      return {
        ...base,
        replicas: 0,
        image: '',
        status: 'pending',
        displaySettings: { image: false, resources: false },
        yamlSettings: { image: true, resources: true }
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
  if (!['Pod', 'Deployment', 'ReplicaSet'].includes(type)) return data;

  const nextData = { ...data };
  if (data.image) {
    nextData.status = 'ready';
  } else if (data.image === '') {
    nextData.status = 'pending';
  }

  return nextData;
};
