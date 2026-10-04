import yaml from 'js-yaml';

const sanitizeName = (label: string): string => {
  if (!label) return '';
  const clean = label.toLowerCase().replaceAll(' ', '-').replaceAll(/[^a-z0-9-]/g, '').replaceAll(/-+/g, '-');
  return clean.replace(/^-+|-+$/g, '').slice(0, 63);
};

export const generateYamlClientSide = (nodes: any[], edges: any[]): string => {
  const manifests: any[] = [];

  const nodeMap = new Map<string, any>(nodes.map(n => [n.id, n]));
  const sourceEdgeMap = new Map<string, any[]>();
  const targetEdgeMap = new Map<string, any[]>();

  edges.forEach(e => {
    if (!sourceEdgeMap.has(e.source)) sourceEdgeMap.set(e.source, []);
    sourceEdgeMap.get(e.source)!.push(e);

    if (!targetEdgeMap.has(e.target)) targetEdgeMap.set(e.target, []);
    targetEdgeMap.get(e.target)!.push(e);
  });

  const getNamespace = (node: any): string => {
    if (!node.parentId) return '';
    const parent = nodeMap.get(node.parentId);
    if (parent?.type === 'Namespace') {
      return sanitizeName(parent.data?.label || '');
    }
    return '';
  };

  const getResourceConfig = (data: any, targetIDs: string[]) => {
    if (data.yamlSettings?.resources === false) return undefined;

    let hasResourceLimit = Array.isArray(data.resourceLimits) && data.resourceLimits.length > 0;

    if (!hasResourceLimit) {
      for (const id of targetIDs) {
        const targetEdges = targetEdgeMap.get(id) || [];
        for (const e of targetEdges) {
          const sourceNode = nodeMap.get(e.source);
          if (sourceNode?.type === 'ResourceLimit') {
            hasResourceLimit = true;
            break;
          }
        }
        if (!hasResourceLimit) {
          const sourceEdges = sourceEdgeMap.get(id) || [];
          for (const e of sourceEdges) {
            const targetNode = nodeMap.get(e.target);
            if (targetNode?.type === 'ResourceLimit') {
              hasResourceLimit = true;
              break;
            }
          }
        }
        if (hasResourceLimit) break;
      }
    }

    if (!hasResourceLimit) return undefined;

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

  const createPodSpec = (data: any, nodeID: string) => {
    const targetIDs = [nodeID];
    const containerName = sanitizeName(data.label || 'main');
    const image = (data.yamlSettings?.image !== false && data.image) ? data.image : 'nginx:latest';

    const resources = getResourceConfig(data, targetIDs);

    const container: any = {
      name: containerName,
      image,
      imagePullPolicy: 'IfNotPresent'
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
      containers: [container]
    };
    if (restartPolicy) {
      spec.restartPolicy = restartPolicy;
    }

    return spec;
  };

  nodes.forEach(node => {
    if (!node.type || !node.data?.label || node.type === 'Internet') return;

    if (node.type === 'Pod' && node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent && parent.type !== 'Namespace') return;
    }

    const name = sanitizeName(node.data.label);
    const namespace = getNamespace(node);
    const metadata: any = { name };
    if (namespace) metadata.namespace = namespace;

    if (node.type === 'Pod') {
      const replicas = Number(node.data.replicas || 1);
      if (replicas > 1) {
        manifests.push({
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata,
          spec: {
            replicas,
            selector: { matchLabels: { app: name } },
            template: {
              metadata: { labels: { app: name } },
              spec: createPodSpec(node.data, node.id)
            }
          }
        });
      } else {
        manifests.push({
          apiVersion: 'v1',
          kind: 'Pod',
          metadata,
          spec: createPodSpec(node.data, node.id)
        });
      }
    } else if (node.type === 'Deployment') {
      const replicas = Number(node.data.replicas || 1);
      manifests.push({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata,
        spec: {
          replicas,
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: createPodSpec(node.data, node.id)
          }
        }
      });
    } else if (node.type === 'Service') {
      manifests.push({
        apiVersion: 'v1',
        kind: 'Service',
        metadata,
        spec: {
          ports: [{ protocol: 'TCP', port: Number(node.data.port || 80), targetPort: Number(node.data.targetPort || node.data.port || 80) }],
          selector: node.data.yamlSettings?.selector !== false ? { app: sanitizeName(node.data.selector || name) } : undefined
        }
      });
    } else if (node.type === 'Namespace') {
      manifests.push({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name }
      });
    } else if (node.type === 'ConfigMap') {
      const configData: Record<string, string> = {};
      if (Array.isArray(node.data.configData)) {
        node.data.configData.forEach((kv: any) => {
          if (kv.key) configData[kv.key] = kv.value || '';
        });
      }
      manifests.push({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata,
        data: configData
      });
    } else if (node.type === 'Secret') {
      const stringData: Record<string, string> = {};
      if (Array.isArray(node.data.configData)) {
        node.data.configData.forEach((kv: any) => {
          if (kv.key) stringData[kv.key] = kv.value || '';
        });
      }
      manifests.push({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata,
        type: 'Opaque',
        stringData
      });
    } else if (node.type === 'PVC') {
      manifests.push({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata,
        spec: {
          accessModes: [node.data.accessMode || 'ReadWriteOnce'],
          storageClassName: node.data.yamlSettings?.storageClass !== false ? (node.data.storageClass || 'standard') : undefined,
          resources: { requests: { storage: node.data.storageCapacity || '1Gi' } }
        }
      });
    }
  });

  if (manifests.length === 0) return '';

  return manifests.map(obj => yaml.dump(obj, { indent: 2, noRefs: true })).join('---\n');
};
