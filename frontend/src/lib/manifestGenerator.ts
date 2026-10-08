import yaml from 'js-yaml';

const sanitizeName = (label: string): string => {
  if (!label) return '';
  const lower = label.toLowerCase();
  let result = '';
  let prevDash = false;

  for (const char of lower) {
    const c = char === ' ' ? '-' : char;
    const isAlphaNum = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
    if (isAlphaNum) {
      result += c;
      prevDash = false;
    } else if (c === '-') {
      if (!prevDash && result.length > 0) {
        result += '-';
        prevDash = true;
      }
    }
  }

  while (result.endsWith('-')) {
    result = result.slice(0, -1);
  }

  return result.slice(0, 63);
};

const buildEdgeMaps = (edges: any[]) => {
  const sourceEdgeMap = new Map<string, any[]>();
  const targetEdgeMap = new Map<string, any[]>();

  edges.forEach((e) => {
    if (!sourceEdgeMap.has(e.source)) sourceEdgeMap.set(e.source, []);
    sourceEdgeMap.get(e.source)!.push(e);

    if (!targetEdgeMap.has(e.target)) targetEdgeMap.set(e.target, []);
    targetEdgeMap.get(e.target)!.push(e);
  });

  return { sourceEdgeMap, targetEdgeMap };
};

const getNamespace = (node: any, nodeMap: Map<string, any>): string => {
  if (!node.parentId) return '';
  const parent = nodeMap.get(node.parentId);
  if (parent?.type === 'Namespace') {
    return sanitizeName(parent.data?.label || '');
  }
  return '';
};

const hasConnectedResourceLimit = (
  targetIDs: string[],
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
): boolean => {
  return targetIDs.some((id) => {
    const targetEdges = targetEdgeMap.get(id) || [];
    if (targetEdges.some((e) => nodeMap.get(e.source)?.type === 'ResourceLimit')) {
      return true;
    }

    const sourceEdges = sourceEdgeMap.get(id) || [];
    return sourceEdges.some((e) => nodeMap.get(e.target)?.type === 'ResourceLimit');
  });
};

const createResourceObject = (data: any) => {
  const requests: Record<string, string> = {};
  if (data.cpuRequest) requests.cpu = data.cpuRequest;
  if (data.memoryRequest) requests.memory = data.memoryRequest;

  const limits: Record<string, string> = {};
  if (data.cpuLimit) limits.cpu = data.cpuLimit;
  if (data.memoryLimit) limits.memory = data.memoryLimit;

  if (Object.keys(requests).length === 0 && Object.keys(limits).length === 0) {
    return undefined;
  }

  const res: any = {};
  if (Object.keys(requests).length > 0) res.requests = requests;
  if (Object.keys(limits).length > 0) res.limits = limits;
  return res;
};

const getResourceConfig = (
  data: any,
  targetIDs: string[],
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
) => {
  if (data.yamlSettings?.resources === false) return undefined;

  let hasResourceLimit = Array.isArray(data.resourceLimits) && data.resourceLimits.length > 0;
  if (!hasResourceLimit) {
    hasResourceLimit = hasConnectedResourceLimit(targetIDs, targetEdgeMap, sourceEdgeMap, nodeMap);
  }

  if (!hasResourceLimit) return undefined;

  return createResourceObject(data);
};

const createPodSpec = (
  data: any,
  nodeID: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
) => {
  const targetIDs = [nodeID];
  const containerName = sanitizeName(data.label || 'main');
  const image = data.yamlSettings?.image !== false && data.image ? data.image : 'nginx:latest';

  const resources = getResourceConfig(data, targetIDs, targetEdgeMap, sourceEdgeMap, nodeMap);

  const container: any = {
    name: containerName,
    image,
    imagePullPolicy: 'IfNotPresent',
  };

  if (data.port) {
    container.ports = [{ containerPort: Number(data.port) }];
  }
  if (resources) {
    container.resources = resources;
  }

  let restartPolicy = 'Always';
  if (data.restartPolicy) {
    restartPolicy = data.restartPolicy;
  }
  if (data.yamlSettings?.restartPolicy === false) {
    restartPolicy = '';
  }

  const spec: any = {
    containers: [container],
  };
  if (restartPolicy) {
    spec.restartPolicy = restartPolicy;
  }

  return spec;
};

const buildPodOrDeploymentManifest = (
  node: any,
  metadata: any,
  name: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
) => {
  const replicas = Number(node.data.replicas || 1);
  const podSpec = createPodSpec(node.data, node.id, targetEdgeMap, sourceEdgeMap, nodeMap);

  if (node.type === 'Deployment' || replicas > 1) {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata,
      spec: {
        replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: podSpec,
        },
      },
    };
  }

  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata,
    spec: podSpec,
  };
};

const determineServiceNodePort = (nodeData: any): number | undefined => {
  const serviceType = nodeData.serviceType || 'ClusterIP';
  const showNodePort = (serviceType === 'NodePort' || serviceType === 'LoadBalancer') && nodeData.nodePort;
  return showNodePort && nodeData.yamlSettings?.nodePort !== false ? Number(nodeData.nodePort) : undefined;
};

const determineServiceSelector = (
  node: any,
  name: string,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
): string => {
  if (node.data?.selector) {
    return sanitizeName(node.data.selector);
  }
  if (sourceEdgeMap) {
    const outgoing = sourceEdgeMap.get(node.id) || [];
    for (const e of outgoing) {
      const target = nodeMap.get(e.target);
      if (target && (target.type === 'Pod' || target.type === 'Deployment' || target.type === 'ReplicaSet')) {
        return sanitizeName(target.data?.label || name);
      }
    }
  }
  return sanitizeName(name);
};

const buildServiceManifest = (
  node: any,
  metadata: any,
  name: string,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
) => {
  const serviceType = node.data.serviceType || 'ClusterIP';
  const nodePort = determineServiceNodePort(node.data);

  const portObject: Record<string, any> = {
    protocol: 'TCP',
    port: Number(node.data.port || 80),
    targetPort: Number(node.data.targetPort || node.data.port || 80),
  };
  if (nodePort !== undefined) {
    portObject.nodePort = nodePort;
  }

  const selectorLabel = determineServiceSelector(node, name, nodeMap, sourceEdgeMap);

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: node.data.yamlSettings?.serviceType !== false ? serviceType : undefined,
      ports: [portObject],
      selector:
        node.data.yamlSettings?.selector !== false
          ? { app: selectorLabel }
          : undefined,
    },
  };
};

const buildIngressManifest = (
  node: any,
  metadata: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
) => {
  let serviceName = node.data.backendServiceName || node.data.serviceName || '';
  let servicePort = Number(node.data.servicePort || 80);

  if (!serviceName) {
    const outgoing = sourceEdgeMap.get(node.id) || [];
    for (const e of outgoing) {
      const target = nodeMap.get(e.target);
      if (target && target.type === 'Service') {
        serviceName = sanitizeName(target.data?.label || '');
        if (target.data?.port) {
          servicePort = Number(target.data.port);
        }
        break;
      }
    }
  }

  if (!serviceName) {
    serviceName = 'app-service';
  }

  const path = node.data.ingressPath || '/';
  const host = node.data.ingressHost || 'example.local';

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      ...metadata,
      annotations: {
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
        'kubernetes.io/ingress.class': 'nginx',
      },
    },
    spec: {
      ingressClassName: 'nginx',
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path,
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: sanitizeName(serviceName),
                    port: { number: servicePort },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
};

const buildConfigMapManifest = (node: any, metadata: any) => {
  const configData: Record<string, string> = {};
  if (Array.isArray(node.data.configData)) {
    node.data.configData.forEach((kv: any) => {
      if (kv.key) configData[kv.key] = kv.value || '';
    });
  }
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata,
    data: configData,
  };
};

const buildSecretManifest = (node: any, metadata: any) => {
  const stringData: Record<string, string> = {};
  if (Array.isArray(node.data.configData)) {
    node.data.configData.forEach((kv: any) => {
      if (kv.key) stringData[kv.key] = kv.value || '';
    });
  }
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata,
    type: 'Opaque',
    stringData,
  };
};

const buildPvcManifest = (node: any, metadata: any) => ({
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata,
  spec: {
    accessModes: [node.data.accessMode || 'ReadWriteOnce'],
    storageClassName:
      node.data.yamlSettings?.storageClass !== false
        ? node.data.storageClass || 'standard'
        : undefined,
    resources: { requests: { storage: node.data.storageCapacity || '1Gi' } },
  },
});

const buildNodeManifest = (
  node: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>,
  targetEdgeMap: Map<string, any[]>
) => {
  if (!node.type || !node.data?.label || node.type === 'Internet') return null;

  if (node.type === 'Pod' && node.parentId) {
    const parent = nodeMap.get(node.parentId);
    if (parent && parent.type !== 'Namespace') return null;
  }

  const name = sanitizeName(node.data.label);
  const namespace = getNamespace(node, nodeMap);
  const metadata: any = { name };
  if (namespace) metadata.namespace = namespace;

  switch (node.type) {
    case 'Pod':
    case 'Deployment':
      return buildPodOrDeploymentManifest(
        node,
        metadata,
        name,
        targetEdgeMap,
        sourceEdgeMap,
        nodeMap
      );
    case 'Service':
      return buildServiceManifest(node, metadata, name, nodeMap, sourceEdgeMap);
    case 'Ingress':
      return buildIngressManifest(node, metadata, nodeMap, sourceEdgeMap);
    case 'Namespace':
      return { apiVersion: 'v1', kind: 'Namespace', metadata: { name } };
    case 'ConfigMap':
      return buildConfigMapManifest(node, metadata);
    case 'Secret':
      return buildSecretManifest(node, metadata);
    case 'PVC':
      return buildPvcManifest(node, metadata);
    default:
      return null;
  }
};

export const generateYamlClientSide = (nodes: any[], edges: any[]): string => {
  const nodeMap = new Map<string, any>(nodes.map((n) => [n.id, n]));
  const { sourceEdgeMap, targetEdgeMap } = buildEdgeMaps(edges);

  const manifests: any[] = [];
  nodes.forEach((node) => {
    const manifest = buildNodeManifest(node, nodeMap, sourceEdgeMap, targetEdgeMap);
    if (manifest) {
      manifests.push(manifest);
    }
  });

  if (manifests.length === 0) return '';

  return manifests.map((obj) => yaml.dump(obj, { indent: 2, noRefs: true })).join('---\n');
};
