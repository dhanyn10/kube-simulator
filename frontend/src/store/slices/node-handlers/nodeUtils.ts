import { Node } from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../../../types';
import { FlowState } from '../../types';

export const createNodeHandlers = (id: string, get: () => FlowState) => ({
  onDelete: () => {
    const node = get().nodes.find((n: Node) => n.id === id);
    if (node) get().deleteNodes([node]);
  },
  onRename: (newName: string) => {
    const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
    get().updateNodeData(id, { label: cleanName });
  }
});

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
        image: 'nginx:latest',
        isAutoImage: true,
        displaySettings: { runtime: false, webserver: false, image: false, resources: false },
        yamlSettings: { image: true, resources: true }
      };
    case 'Deployment':
      return {
        ...base,
        replicas: 0,
        displaySettings: { runtime: false, webserver: false, image: false, resources: false },
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
        displaySettings: { traffic: false, duration: false }
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
    default:
      return base;
  }
};


export const sanitizeResourceLimits = (data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  const res = { ...data };
  const limit = (val: any, min: number, max: number) => Math.max(min, Math.min(max, Number(val)));
  if (res.replicas !== undefined) res.replicas = limit(res.replicas, 0, 1000);
  if (res.minReplicas !== undefined) res.minReplicas = limit(res.minReplicas, 1, 1000);
  if (res.maxReplicas !== undefined) res.maxReplicas = limit(res.maxReplicas, 1, 1000);
  return res;
};

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

export const applyAutoImageLogic = (targetData: K8sNodeData, data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  if (data.runtime === undefined && data.webserver === undefined) return data;
  const rt = data.runtime ?? targetData.runtime ?? 'none';
  const ws = data.webserver ?? targetData.webserver ?? 'none';
  if (!targetData.image || targetData.isAutoImage) {
    return { ...data, image: resolveAutoImage(rt, ws), isAutoImage: true };
  }
  return data;
};

export const syncWorkloadMetadata = (type: string, data: Partial<K8sNodeData>): Partial<K8sNodeData> => {
  if (!['Pod', 'Deployment', 'ReplicaSet'].includes(type)) return data;

  const hasRuntime = data.runtime && data.runtime !== 'none';
  const hasWebserver = data.webserver && data.webserver !== 'none';

  const nextData = { ...data };
  if (hasRuntime || hasWebserver) {
    nextData.status = 'ready';
    if (data.isAutoImage !== false) {
      nextData.image = resolveAutoImage(data.runtime || 'none', data.webserver || 'none');
      nextData.isAutoImage = true;
    }
  } else {
    nextData.status = 'pending';
  }

  return nextData;
};
