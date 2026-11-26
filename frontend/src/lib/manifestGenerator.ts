import yaml from 'js-yaml';
import type { Pod, Service, ConfigMap, Secret, PersistentVolumeClaim, Namespace } from 'kubernetes-types/core/v1';
import type { Deployment, StatefulSet, ReplicaSet } from 'kubernetes-types/apps/v1';
import type { Ingress } from 'kubernetes-types/networking/v1';
import type { HorizontalPodAutoscaler } from 'kubernetes-types/autoscaling/v2';
import { sanitizeSlug, parseCPU, parseMemory } from './utils';
import { logger } from './logger';

export type K8sManifest =
  | Pod
  | Service
  | ConfigMap
  | Secret
  | PersistentVolumeClaim
  | Namespace
  | Deployment
  | StatefulSet
  | ReplicaSet
  | Ingress
  | HorizontalPodAutoscaler;

const sanitizeName = (label: string): string => {
  if (!label) return '';
  return sanitizeSlug(label);
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
    return sanitizeName(parent?.data?.label || '');
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
  let effectiveCpuReq = data.cpuRequest || data.cpuLimit;
  let effectiveMemReq = data.memoryRequest || data.memoryLimit;

  // QoS Admission Control integrity: requests must be <= limits
  if (data.cpuLimit && effectiveCpuReq && parseCPU(effectiveCpuReq) > parseCPU(data.cpuLimit)) {
    effectiveCpuReq = data.cpuLimit;
  }
  if (data.memoryLimit && effectiveMemReq && parseMemory(effectiveMemReq) > parseMemory(data.memoryLimit)) {
    effectiveMemReq = data.memoryLimit;
  }

  const requests: Record<string, string> = {};
  if (effectiveCpuReq) requests.cpu = effectiveCpuReq;
  if (effectiveMemReq) requests.memory = effectiveMemReq;

  const limits: Record<string, string> = {};
  if (data.cpuLimit) limits.cpu = data.cpuLimit;
  if (data.memoryLimit) limits.memory = data.memoryLimit;

  if (Object.keys(requests).length === 0 && Object.keys(limits).length === 0) {
    return undefined;
  }

  const res: any = { requests };
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

const getEnvFromAttachedConfigMaps = (
  configMaps: any[],
  seenKeys: Set<string>,
  env: any[]
) => {
  configMaps.forEach((cm: any) => {
    if (!cm) return;
    const cmName = sanitizeName(cm.name) || 'configmap';
    if (!Array.isArray(cm.configData)) return;
    cm.configData.forEach((item: any) => {
      if (item.key && !seenKeys.has(item.key)) {
        seenKeys.add(item.key);
        env.push({
          name: item.key,
          valueFrom: {
            configMapKeyRef: {
              name: cmName,
              key: item.key,
            },
          },
        });
      }
    });
  });
};

const getEnvFromAttachedSecrets = (
  secrets: any[],
  seenKeys: Set<string>,
  env: any[]
) => {
  secrets.forEach((sec: any) => {
    if (!sec) return;
    const secName = sanitizeName(sec.name) || 'secret';
    const items = sec.secretData || sec.configData;
    if (!Array.isArray(items)) return;
    items.forEach((item: any) => {
      if (item.key && !seenKeys.has(item.key)) {
        seenKeys.add(item.key);
        env.push({
          name: item.key,
          valueFrom: {
            secretKeyRef: {
              name: secName,
              key: item.key,
            },
          },
        });
      }
    });
  });
};

const getEnvFromConnectedNode = (
  sourceNode: any,
  seenKeys: Set<string>,
  env: any[]
) => {
  if (!sourceNode) return;
  const isCm = sourceNode.type === 'ConfigMap';
  const isSec = sourceNode.type === 'Secret';
  if (!isCm && !isSec) return;

  const resourceName = sanitizeName(sourceNode.data?.label) || (isCm ? 'configmap' : 'secret');
  const items = isCm ? sourceNode.data?.configData : (sourceNode.data?.secretData || sourceNode.data?.configData);
  if (!Array.isArray(items)) return;

  items.forEach((item: any) => {
    if (!item.key || seenKeys.has(item.key)) return;
    seenKeys.add(item.key);
    env.push({
      name: item.key,
      valueFrom: isCm
        ? { configMapKeyRef: { name: resourceName, key: item.key } }
        : { secretKeyRef: { name: resourceName, key: item.key } },
    });
  });
};

const getEnvFromNodeAndConnections = (
  data: any,
  nodeID: string,
  targetEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
): any[] | undefined => {
  const env: any[] = [];
  const seenKeys = new Set<string>();

  if (Array.isArray(data?.configMaps)) {
    getEnvFromAttachedConfigMaps(data.configMaps, seenKeys, env);
  }
  if (Array.isArray(data?.secrets)) {
    getEnvFromAttachedSecrets(data.secrets, seenKeys, env);
  }

  const incoming = targetEdgeMap.get(nodeID) || [];
  incoming.forEach((edge) => {
    getEnvFromConnectedNode(nodeMap.get(edge.source), seenKeys, env);
  });

  return env.length > 0 ? env : undefined;
};

const createPodSpec = (
  data: any,
  nodeID: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>,
  isController = false
) => {
  const targetIDs = [nodeID];
  const containerName = sanitizeName(data.label);

  const resources = getResourceConfig(data, targetIDs, targetEdgeMap, sourceEdgeMap, nodeMap);

  const container: any = {
    name: containerName,
  };

  if (data.yamlSettings?.image !== false && data.image) {
    container.image = data.image;
  }

  const env = getEnvFromNodeAndConnections(data, nodeID, targetEdgeMap, nodeMap);
  if (env) {
    container.env = env;
  }

  if (data.port) {
    container.ports = [{ containerPort: Number(data.port) }];
  }
  if (resources) {
    container.resources = resources;
  }

  let restartPolicy = 'Always';
  if (!isController && data.restartPolicy) {
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

const isMatchingServiceSelector = (svc: any, node: any): boolean => {
  const sel = svc?.data?.selector;
  if (!sel) return false;
  const nodeLabel = node.data?.label;
  return (
    sel === node.id ||
    sel === nodeLabel ||
    sel === node.data?.baseName ||
    sanitizeName(sel) === sanitizeName(nodeLabel)
  );
};

const findCandidateServicesForStatefulSet = (
  node: any,
  _name: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
): any[] => {
  const candidates: any[] = [];
  const seen = new Set<string>();

  const addCandidate = (s: any) => {
    if (s?.type === 'Service' && !seen.has(s.id)) {
      seen.add(s.id);
      candidates.push(s);
    }
  };

  for (const e of targetEdgeMap.get(node.id) || []) {
    addCandidate(nodeMap.get(e.source));
  }
  for (const e of sourceEdgeMap.get(node.id) || []) {
    addCandidate(nodeMap.get(e.target));
  }
  for (const n of nodeMap.values()) {
    if (n?.type === 'Service' && isMatchingServiceSelector(n, node)) {
      addCandidate(n);
    }
  }
  return candidates;
};

const resolveStatefulSetServiceName = (
  node: any,
  name: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
): string => {
  if (node.data?.serviceName) {
    return sanitizeName(node.data.serviceName);
  }
  const candidates = findCandidateServicesForStatefulSet(node, name, targetEdgeMap, sourceEdgeMap, nodeMap);
  if (candidates.length === 0) {
    return name;
  }
  const headlessSvc = candidates.find((s) => s.data?.serviceType === 'Headless');
  const chosen = headlessSvc || candidates[0];
  return sanitizeName(chosen.data?.label || chosen.id || name);
};

const buildStatefulSetManifest = (
  node: any,
  metadata: any,
  name: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
) => {
  const replicas = Number(node.data.replicas ?? 1);
  const podSpec = createPodSpec(node.data, node.id, targetEdgeMap, sourceEdgeMap, nodeMap, true);

  const outgoing = sourceEdgeMap.get(node.id) || [];
  const pvcNodes: any[] = [];
  outgoing.forEach((e) => {
    const target = nodeMap.get(e.target);
    if (target?.type === 'PVC') {
      pvcNodes.push(target);
    }
  });

  let volumeClaimTemplates: any[] | undefined;
  if (pvcNodes.length > 0) {
    const vctVolumeMounts: any[] = [];
    volumeClaimTemplates = pvcNodes.map((pvcNode, index) => {
      const pvcName = sanitizeName(pvcNode.data?.label || 'data');
      vctVolumeMounts.push({
        name: pvcName,
        mountPath: `/data-${index}`,
      });
      return {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: pvcName },
        spec: {
          accessModes: [pvcNode.data?.accessMode || 'ReadWriteOnce'],
          storageClassName:
            pvcNode.data?.yamlSettings?.storageClass !== false
              ? pvcNode.data?.storageClass || 'standard'
              : undefined,
          resources: { requests: { storage: pvcNode.data?.storageCapacity || '1Gi' } },
        },
      };
    });

    podSpec.volumes = undefined;
    podSpec.containers[0].volumeMounts = vctVolumeMounts;
  }

  const serviceName = resolveStatefulSetServiceName(
    node,
    name,
    targetEdgeMap,
    sourceEdgeMap,
    nodeMap
  );

  return {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata,
    spec: {
      serviceName,
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: podSpec,
      },
      volumeClaimTemplates,
    },
  };
};

const buildPodOrDeploymentManifest = (
  node: any,
  metadata: any,
  name: string,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap: Map<string, any[]>,
  nodeMap: Map<string, any>
) => {
  const replicas = Number(node.data?.replicas ?? 1);

  if (node.type === 'StatefulSet' || node.data?.workloadType === 'StatefulSet') {
    return buildStatefulSetManifest(node, metadata, name, targetEdgeMap, sourceEdgeMap, nodeMap);
  }

  const isDeployment = node.type === 'Deployment' || (node.type !== 'Pod' && node.data?.workloadType === 'Deployment');
  const isReplicaSet = node.type === 'ReplicaSet' || node.data?.workloadType === 'ReplicaSet';
  const isController = isDeployment || isReplicaSet || replicas > 1;
  const podSpec = createPodSpec(node.data, node.id, targetEdgeMap, sourceEdgeMap, nodeMap, isController);

  if (isController) {
    const kind = isReplicaSet ? 'ReplicaSet' : 'Deployment';
    return {
      apiVersion: 'apps/v1',
      kind,
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
    metadata: {
      ...metadata,
      labels: { ...(metadata?.labels || {}), app: name },
    },
    spec: podSpec,
  };
};

const determineServiceNodePort = (nodeData: any): number | undefined => {
  const serviceType = nodeData.serviceType || 'ClusterIP';
  const showNodePort = (serviceType === 'NodePort' || serviceType === 'LoadBalancer') && nodeData.nodePort;
  if (!showNodePort || nodeData.yamlSettings?.nodePort === false) {
    return undefined;
  }
  const port = Number(nodeData.nodePort);
  if (Number.isNaN(port) || port < 30000 || port > 32767) {
    return undefined;
  }
  return port;
};

const isTargetingIngress = (
  node: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
): boolean => {
  if (node.data?.serviceType !== 'LoadBalancer') {
    return false;
  }
  if (Array.isArray(node.data?.ingressTargets) && node.data.ingressTargets.length > 0) {
    return true;
  }
  if (node.data?.selector) {
    for (const [, n] of nodeMap) {
      if (n.type === 'Ingress' && (n.data?.label === node.data.selector || n.id === node.data.selector)) {
        return true;
      }
    }
  }
  const outgoing = sourceEdgeMap.get(node.id) || [];
  for (const e of outgoing) {
    const target = nodeMap.get(e.target);
    if (target?.type === 'Ingress') {
      return true;
    }
  }
  return false;
};

const determineServiceSelector = (
  node: any,
  name: string,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
): Record<string, string> => {
  if (isTargetingIngress(node, nodeMap, sourceEdgeMap)) {
    return {
      'app.kubernetes.io/name': 'ingress-nginx',
      'app.kubernetes.io/component': 'controller',
    };
  }

  if (node.data?.selector) {
    return { app: sanitizeName(node.data.selector) };
  }
  const outgoing = sourceEdgeMap.get(node.id) || [];
  for (const e of outgoing) {
    const target = nodeMap.get(e.target);
    if (target && ['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet'].includes(target.type)) {
      return { app: sanitizeName(target.data?.label || name) };
    }
  }
  return { app: sanitizeName(name) };
};

const isStatefulWorkloadNode = (n: any, nodeMap: Map<string, any>): boolean => {
  if (!n) return false;
  if (n.type === 'StatefulSet' || n.data?.workloadType === 'StatefulSet') return true;
  if (n.parentId) {
    const parent = nodeMap.get(n.parentId);
    if (parent?.type === 'StatefulSet' || parent?.data?.workloadType === 'StatefulSet') {
      return true;
    }
  }
  return false;
};

const isServiceTargetingStatefulSet = (
  node: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>,
  targetEdgeMap?: Map<string, any[]>
): boolean => {
  const outgoing = sourceEdgeMap.get(node.id) || [];
  for (const e of outgoing) {
    if (isStatefulWorkloadNode(nodeMap.get(e.target), nodeMap)) {
      return true;
    }
  }
  const incoming = targetEdgeMap?.get(node.id) || [];
  for (const e of incoming) {
    if (isStatefulWorkloadNode(nodeMap.get(e.source), nodeMap)) {
      return true;
    }
  }
  const selector = node.data?.selector;
  if (!selector) return false;
  const sanitizedSel = sanitizeName(selector);
  for (const n of nodeMap.values()) {
    if (isStatefulWorkloadNode(n, nodeMap)) {
      const match =
        n.id === selector ||
        n.data?.label === selector ||
        n.data?.baseName === selector ||
        sanitizeName(n.data?.label || n.data?.baseName || '') === sanitizedSel;
      if (match) return true;
    }
  }
  return false;
};

const buildServiceManifest = (
  node: any,
  metadata: any,
  name: string,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>,
  targetEdgeMap?: Map<string, any[]>
) => {
  const serviceType = node.data.serviceType || 'ClusterIP';
  const nodePort = determineServiceNodePort(node.data);

  const portObject: Record<string, any> = {
    protocol: 'TCP',
    port: Number(node.data.port || 80),
  };
  if (node.data.yamlSettings?.targetPort !== false && node.data.targetPort) {
    portObject.targetPort = Number(node.data.targetPort);
  }
  if (nodePort !== undefined) {
    portObject.nodePort = nodePort;
  }

  const selectorObject = determineServiceSelector(node, name, nodeMap, sourceEdgeMap);

  const isStatefulTarget = isServiceTargetingStatefulSet(node, nodeMap, sourceEdgeMap, targetEdgeMap);

  let specType: string | undefined = serviceType;
  let clusterIP: string | undefined = node.data.clusterIP;

  if (serviceType === 'Headless' || (isStatefulTarget && (serviceType === 'ClusterIP' || !serviceType))) {
    specType = 'ClusterIP';
    clusterIP = 'None';
  }

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: node.data.yamlSettings?.serviceType !== false ? specType : undefined,
      clusterIP: node.data.yamlSettings?.clusterIP !== false ? clusterIP : undefined,
      ports: [portObject],
      selector:
        node.data.yamlSettings?.selector !== false
          ? selectorObject
          : undefined,
      externalTrafficPolicy:
        node.data.yamlSettings?.externalTrafficPolicy !== false &&
        (serviceType === 'LoadBalancer' || serviceType === 'NodePort') &&
        node.data.externalTrafficPolicy
          ? node.data.externalTrafficPolicy
          : undefined,
    },
  };
};

const buildIngressPathEntry = (
  rule: { path?: string; pathType?: string; serviceName?: string; servicePort?: number },
  defaultServiceName: string,
  defaultServicePort: number,
  includePath: boolean,
  includeBackend: boolean
) => {
  const entry: Record<string, any> = {
    pathType: rule.pathType || 'Prefix',
  };
  if (includePath) {
    entry.path = rule.path || '/';
  }
  if (includeBackend) {
    entry.backend = {
      service: {
        name: sanitizeName(rule.serviceName || defaultServiceName),
        port: { number: Number(rule.servicePort || defaultServicePort) },
      },
    };
  }
  return entry;
};

const buildIngressRulePaths = (
  nodeData: any,
  connectedServices: Array<{ name: string; port: number }>,
  defaultServiceName: string,
  defaultServicePort: number
): any[] => {
  const includePath = nodeData?.yamlSettings?.path !== false;
  const includeBackend = nodeData?.yamlSettings?.backendService !== false;

  if (Array.isArray(nodeData?.ingressPaths) && nodeData.ingressPaths.length > 0) {
    return nodeData.ingressPaths.map((rule: any) =>
      buildIngressPathEntry(rule, defaultServiceName, defaultServicePort, includePath, includeBackend)
    );
  }
  if (connectedServices.length > 1) {
    return connectedServices.map((svc) =>
      buildIngressPathEntry(
        {
          path: `/${svc.name.replace(/-service$/, '')}`,
          serviceName: svc.name,
          servicePort: svc.port,
        },
        defaultServiceName,
        defaultServicePort,
        includePath,
        includeBackend
      )
    );
  }
  return [
    buildIngressPathEntry(
      {
        path: nodeData?.ingressPath || '/',
        serviceName: defaultServiceName,
        servicePort: defaultServicePort,
      },
      defaultServiceName,
      defaultServicePort,
      includePath,
      includeBackend
    ),
  ];
};

const collectConnectedIngressServices = (
  nodeId: string,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
): Array<{ name: string; port: number }> => {
  const outgoing = sourceEdgeMap.get(nodeId) || [];
  const connectedServices: Array<{ name: string; port: number }> = [];
  for (const e of outgoing) {
    const target = nodeMap.get(e.target);
    if (target?.type !== 'Service') continue;
    const sName = sanitizeName(target?.data?.label || '');
    const sPort = Number(target?.data?.port || 80);
    if (sName && !connectedServices.some((s) => s.name === sName)) {
      connectedServices.push({ name: sName, port: sPort });
    }
  }
  return connectedServices;
};

const buildIngressManifest = (
  node: any,
  metadata: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
) => {
  const connectedServices = collectConnectedIngressServices(node.id, nodeMap, sourceEdgeMap);
  const configuredServiceName = node.data?.backendServiceName || node.data?.serviceName || '';
  const serviceName = configuredServiceName || connectedServices[0]?.name || 'app-service';
  const servicePort = configuredServiceName
    ? Number(node.data?.servicePort || 80)
    : Number(connectedServices[0]?.port || node.data?.servicePort || 80);

  const host = (node.data?.ingressHost as string)?.trim().toLowerCase() || 'example.local';
  const ingressClassName = node.data?.ingressClassName || 'nginx';
  const paths = buildIngressRulePaths(node.data, connectedServices, serviceName, servicePort);

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata,
    spec: {
      ingressClassName,
      rules: [
        {
          host,
          http: {
            paths,
          },
        },
      ],
    },
  };
};

const buildConfigMapManifest = (node: any, metadata: any) => {
  const manifest: Record<string, any> = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata,
  };
  if (node.data.yamlSettings?.data === false) {
    return manifest;
  }

  const configData: Record<string, string> = {};
  if (Array.isArray(node.data.configData)) {
    node.data.configData.forEach((kv: any) => {
      if (kv.key) configData[kv.key] = kv.value || '';
    });
  }
  manifest.data = configData;
  return manifest;
};

const buildSecretManifest = (node: any, metadata: any) => {
  const manifest: Record<string, any> = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata,
    type: 'Opaque',
  };
  if (node.data.yamlSettings?.data === false) {
    return manifest;
  }

  const stringData: Record<string, string> = {};
  if (Array.isArray(node.data.configData)) {
    node.data.configData.forEach((kv: any) => {
      if (kv.key) stringData[kv.key] = kv.value || '';
    });
  }
  manifest.stringData = stringData;
  return manifest;
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

/**
 * Returns `true` if a PVC node is used as a `volumeClaimTemplates` entry by a connected StatefulSet.
 *
 * @param pvcNode - The PVC node to check.
 * @param allNodes - All nodes in the canvas.
 * @param allEdges - All edges in the canvas.
 * @returns `true` if the PVC is a StatefulSet volumeClaimTemplate.
 */
export const isStatefulSetVolumeClaimTemplate = (
  pvcNodeId: string,
  nodeMap: Map<string, any>,
  targetEdgeMap: Map<string, any[]>,
  sourceEdgeMap?: Map<string, any[]>
): boolean => {
  const incoming = targetEdgeMap.get(pvcNodeId) || [];
  for (const edge of incoming) {
    const sourceNode = nodeMap.get(edge.source);
    if (sourceNode && (sourceNode.type === 'StatefulSet' || sourceNode.data?.workloadType === 'StatefulSet')) {
      return true;
    }
  }
  if (sourceEdgeMap) {
    const outgoing = sourceEdgeMap.get(pvcNodeId) || [];
    for (const edge of outgoing) {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && (targetNode.type === 'StatefulSet' || targetNode.data?.workloadType === 'StatefulSet')) {
        return true;
      }
    }
  }
  return false;
};

const HPA_SCALE_TARGET_TYPES = new Set(['Deployment', 'StatefulSet', 'ReplicaSet']);

const findHpaScaleTarget = (
  hpaId: string,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
) => {
  const outgoing = sourceEdgeMap.get(hpaId) || [];
  for (const edge of outgoing) {
    const target = nodeMap.get(edge.target);
    if (target && HPA_SCALE_TARGET_TYPES.has(target.type)) {
      return target;
    }
  }
  return null;
};

const buildHpaMetrics = (data: any) => {
  const metrics: any[] = [];

  if (data?.yamlSettings?.targetCPU !== false && data?.targetCPU != null) {
    const targetCpuUtilization = Number(data.targetCPU);
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: targetCpuUtilization,
        },
      },
    });
  }

  if (data?.yamlSettings?.targetMemory !== false && data?.targetMemory != null) {
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'memory',
        target: {
          type: 'Utilization',
          averageUtilization: Number(data.targetMemory),
        },
      },
    });
  }

  return metrics;
};

const buildHpaManifest = (
  node: any,
  metadata: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>
) => {
  const targetWorkload = findHpaScaleTarget(node.id, nodeMap, sourceEdgeMap);
  if (!targetWorkload) {
    logger.warn(
      `[YAML Export] Skipped HPA "${node.data?.label || node.id}": no Deployment, StatefulSet, or ReplicaSet target is connected.`
    );
    return null;
  }

  const workloadKind = targetWorkload.type;
  const workloadName = sanitizeName(targetWorkload.data?.label) || targetWorkload.id;

  const spec = {
    scaleTargetRef: {
      apiVersion: 'apps/v1',
      kind: workloadKind,
      name: workloadName,
    },
  } as HorizontalPodAutoscaler['spec'];

  if (node.data?.yamlSettings?.replicas !== false) {
    spec.minReplicas = node.data?.minReplicas ?? 1;
    spec.maxReplicas = node.data?.maxReplicas ?? 10;
  }

  const metrics = buildHpaMetrics(node.data);
  if (metrics.length > 0) {
    spec.metrics = metrics;
  }

  return {
    apiVersion: 'autoscaling/v2' as const,
    kind: 'HorizontalPodAutoscaler' as const,
    metadata,
    spec,
  };
};

const buildNodeManifest = (
  node: any,
  nodeMap: Map<string, any>,
  sourceEdgeMap: Map<string, any[]>,
  targetEdgeMap: Map<string, any[]>
): K8sManifest | null => {
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
    case 'StatefulSet':
    case 'ReplicaSet':
      return buildPodOrDeploymentManifest(
        node,
        metadata,
        name,
        targetEdgeMap,
        sourceEdgeMap,
        nodeMap
      ) as K8sManifest;
    case 'Service':
      return buildServiceManifest(node, metadata, name, nodeMap, sourceEdgeMap, targetEdgeMap) as K8sManifest;
    case 'Ingress':
      return buildIngressManifest(node, metadata, nodeMap, sourceEdgeMap) as K8sManifest;
    case 'Namespace':
      return { apiVersion: 'v1', kind: 'Namespace', metadata: { name } };
    case 'ConfigMap':
      return buildConfigMapManifest(node, metadata) as K8sManifest;
    case 'Secret':
      return buildSecretManifest(node, metadata) as K8sManifest;
    case 'PVC':
      if (isStatefulSetVolumeClaimTemplate(node.id, nodeMap, targetEdgeMap, sourceEdgeMap)) {
        return null;
      }
      return buildPvcManifest(node, metadata) as K8sManifest;
    case 'HPA':
      return buildHpaManifest(node, metadata, nodeMap, sourceEdgeMap);
    default:
      return null;
  }
};

const buildAttachedConfigMapManifest = (
  cmItem: any,
  node: any,
  nodeMap: Map<string, any>
): ConfigMap | null => {
  if (!cmItem) return null;
  const name = sanitizeName(cmItem.name) || 'configmap';
  const namespace = getNamespace(node, nodeMap);
  const metadata: Record<string, string> = { name };
  if (namespace) {
    metadata.namespace = namespace;
  }

  const data: Record<string, string> = {};
  if (Array.isArray(cmItem.configData)) {
    cmItem.configData.forEach((item: any) => {
      if (item.key) {
        data[item.key] = String(item.value ?? '');
      }
    });
  }

  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata,
    data,
  };
};

const buildAttachedSecretManifest = (
  secretItem: any,
  node: any,
  nodeMap: Map<string, any>
): Secret | null => {
  if (!secretItem) return null;
  const name = sanitizeName(secretItem.name) || 'secret';
  const namespace = getNamespace(node, nodeMap);
  const metadata: Record<string, string> = { name };
  if (namespace) {
    metadata.namespace = namespace;
  }

  const stringData: Record<string, string> = {};
  const items = secretItem.secretData || secretItem.configData;
  if (Array.isArray(items)) {
    items.forEach((item: any) => {
      if (item.key) {
        stringData[item.key] = String(item.value ?? '');
      }
    });
  }

  return {
    apiVersion: 'v1' as const,
    kind: 'Secret' as const,
    metadata,
    type: 'Opaque',
    stringData,
  };
};

const buildAttachedHpaManifest = (
  hpaItem: any,
  node: any,
  nodeMap: Map<string, any>
): HorizontalPodAutoscaler | null => {
  if (!hpaItem) return null;
  if (!HPA_SCALE_TARGET_TYPES.has(node.type) && node.type !== 'Pod') return null;
  const hpaName = sanitizeName(hpaItem.name) || `${sanitizeName(node.data?.label || node.id)}-hpa`;
  const namespace = getNamespace(node, nodeMap);
  const metadata: Record<string, string> = { name: hpaName };
  if (namespace) {
    metadata.namespace = namespace;
  }

  const podReplicas = Number(node.data?.replicas ?? 1);
  const workloadKind =
    node.type === 'Pod' ? (podReplicas > 1 ? 'Deployment' : 'Pod') : node.type;
  const workloadApiVersion = workloadKind === 'Pod' ? 'v1' : 'apps/v1';
  const workloadName = sanitizeName(node.data?.label) || node.id;

  const minReplicas = Math.max(1, Number(hpaItem.minReplicas) || 1);
  const maxReplicas = Math.max(minReplicas, Number(hpaItem.maxReplicas) || 10);
  const targetCpu = Number(hpaItem.targetCPU);

  const metrics: any[] = [];

  if (Number.isFinite(targetCpu) && targetCpu > 0) {
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: targetCpu,
        },
      },
    });
  }

  if (hpaItem.targetMemory != null && Number(hpaItem.targetMemory) > 0) {
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'memory',
        target: {
          type: 'Utilization',
          averageUtilization: Number(hpaItem.targetMemory),
        },
      },
    });
  }

  const spec: HorizontalPodAutoscaler['spec'] = {
    scaleTargetRef: {
      apiVersion: workloadApiVersion,
      kind: workloadKind,
      name: workloadName,
    },
    minReplicas,
    maxReplicas,
  };
  if (metrics.length > 0) {
    spec.metrics = metrics;
  }

  return {
    apiVersion: 'autoscaling/v2' as const,
    kind: 'HorizontalPodAutoscaler' as const,
    metadata,
    spec,
  };
};

/**
 * Generates multi-document Kubernetes YAML manifests client-side from the current canvas nodes and edges.
 *
 * @param nodes - All React Flow nodes on the canvas.
 * @param edges - All React Flow edges on the canvas.
 * @returns A YAML string containing all generated Kubernetes resource manifests.
 */
export const generateYamlClientSide = (nodes: any[], edges: any[]): string => {
  const nodeMap = new Map<string, any>(nodes.map((n) => [n.id, n]));
  const { sourceEdgeMap, targetEdgeMap } = buildEdgeMaps(edges);

  const manifests: K8sManifest[] = [];
  nodes.forEach((node) => {
    const manifest = buildNodeManifest(node, nodeMap, sourceEdgeMap, targetEdgeMap);
    if (manifest) {
      manifests.push(manifest);
    }

    const isNonNamespaceChildPod =
      node.type === 'Pod' &&
      Boolean(node.parentId) &&
      nodeMap.get(node.parentId)?.type !== 'Namespace';
    if (node.type === 'Namespace' || isNonNamespaceChildPod) {
      return;
    }

    if (Array.isArray(node.data?.configMaps)) {
      node.data.configMaps.forEach((cmItem: any) => {
        const attachedCmManifest = buildAttachedConfigMapManifest(cmItem, node, nodeMap);
        if (attachedCmManifest) {
          manifests.push(attachedCmManifest);
        }
      });
    }
    if (Array.isArray(node.data?.secrets)) {
      node.data.secrets.forEach((secretItem: any) => {
        const attachedSecretManifest = buildAttachedSecretManifest(secretItem, node, nodeMap);
        if (attachedSecretManifest) {
          manifests.push(attachedSecretManifest);
        }
      });
    }
    if (Array.isArray(node.data?.hpas)) {
      node.data.hpas.forEach((hpaItem: any) => {
        const attachedHpaManifest = buildAttachedHpaManifest(hpaItem, node, nodeMap);
        if (attachedHpaManifest) {
          manifests.push(attachedHpaManifest);
        }
      });
    }
  });

  if (manifests.length === 0) return '';

  return manifests.map((obj) => yaml.dump(obj, { indent: 2, noRefs: true, lineWidth: -1 }).trim()).join('\n---\n');
};
