import { K8sNodeData } from '../../types';

const getVolumeConfig = (sourceIds: string | string[], nodes: any[], edges: any[]) => {
  const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  const pvcEdges = edges.filter(e => ids.includes(e.source) && nodes.some(n => n.id === e.target && n.type === 'PVC'));
  const volumes = pvcEdges.map((e, idx) => {
    const pvcNode = nodes.find(n => n.id === e.target);
    const pvcName = pvcNode?.data.label.toLowerCase().replace(/\s+/g, '-') || 'pvc-storage';
    return {
      name: `vol-${idx}`,
      persistentVolumeClaim: { claimName: pvcName }
    };
  });

  const volumeMounts = volumes.map((v, idx) => ({
    name: v.name,
    mountPath: `/data-${idx}`
  }));

  return { volumes, volumeMounts };
};

const getEnvFromConnections = (targetIds: string | string[], nodes: any[], edges: any[]) => {
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  const incomingEdges = edges.filter(e => ids.includes(e.target));
  const env: any[] = [];

  incomingEdges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return;

    const resourceName = (sourceNode.data.label || 'config').toLowerCase().replace(/\s+/g, '-');
    const configData = sourceNode.data.configData || [];

    if (sourceNode.type === 'ConfigMap' || sourceNode.type === 'Secret') {
      configData.forEach((item: any) => {
        if (!item.key) return;

        const envEntry: any = {
          name: item.key,
          valueFrom: {}
        };

        if (sourceNode.type === 'ConfigMap') {
          envEntry.valueFrom.configMapKeyRef = {
            name: resourceName,
            key: item.key
          };
        } else {
          envEntry.valueFrom.secretKeyRef = {
            name: resourceName,
            key: item.key
          };
        }

        env.push(envEntry);
      });
    }
  });

  return env;
};

export const generateNamespaceYaml = (data: K8sNodeData, name: string) => {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name }
  };
};

export const generatePodYaml = (data: K8sNodeData, name: string, nodes: any[] = [], edges: any[] = [], namespace?: string) => {
  const { volumes, volumeMounts } = getVolumeConfig(data.id || '', nodes, edges);
  const env = getEnvFromConnections(data.id || '', nodes, edges);

  const containerResources = (data.cpuLimit || data.memoryLimit || data.cpuRequest || data.memoryRequest) ? {
    requests: (data.cpuRequest || data.memoryRequest) ? {
      cpu: data.cpuRequest,
      memory: data.memoryRequest
    } : undefined,
    limits: (data.cpuLimit || data.memoryLimit) ? {
      cpu: data.cpuLimit,
      memory: data.memoryLimit
    } : undefined
  } : undefined;

  // If a standalone Pod has multiple replicas, wrap it in a Deployment
  if ((data.replicas || 1) > 1) {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name, namespace },
      spec: {
        replicas: data.replicas,
        selector: { matchLabels: { app: name } },
        strategy: {
          type: 'RollingUpdate',
          rollingUpdate: { maxSurge: '25%', maxUnavailable: '25%' }
        },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [{
              name: 'main',
              image: data.image || 'nginx:latest',
              imagePullPolicy: 'IfNotPresent',
              ports: data.port ? [{ containerPort: data.port }] : undefined,
              env: env.length > 0 ? env : undefined,
              resources: containerResources,
              volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined
            }],
            volumes: volumes.length > 0 ? volumes : undefined
          }
        }
      }
    };
  }

  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name, namespace },
    spec: {
      containers: [{
        name: 'main',
        image: data.image || 'nginx:latest',
        imagePullPolicy: 'IfNotPresent',
        ports: data.port ? [{ containerPort: data.port }] : undefined,
        env: env.length > 0 ? env : undefined,
        resources: containerResources,
        volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined
      }],
      volumes: volumes.length > 0 ? volumes : undefined
    }
  };
};

export const generateConfigMapYaml = (data: K8sNodeData, name: string, namespace?: string) => {
  const configData: Record<string, string> = {};
  (data.configData || []).forEach(item => {
    if (item.key) configData[item.key] = item.value;
  });

  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name, namespace },
    data: configData
  };
};

export const generateSecretYaml = (data: K8sNodeData, name: string, namespace?: string) => {
  const secretData: Record<string, string> = {};
  (data.configData || []).forEach(item => {
    if (item.key) secretData[item.key] = item.value;
  });

  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name, namespace },
    type: 'Opaque',
    stringData: secretData
  };
};

export const generatePVCYaml = (data: K8sNodeData, name: string, namespace?: string) => {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name, namespace },
    spec: {
      accessModes: [data.accessMode || 'ReadWriteOnce'],
      storageClassName: data.storageClass || 'standard',
      resources: {
        requests: {
          storage: data.storageCapacity || '1Gi'
        }
      }
    }
  };
};

export const generateDeploymentYaml = (data: K8sNodeData, name: string, nodes: any[], edges: any[] = [], namespace?: string) => {
  const childPods = nodes.filter(n => n.parentId === data.id && n.type === 'Pod');
  const mainPod = childPods[0];
  const podData = mainPod ? mainPod.data : data;
  const containerName = podData.label?.toLowerCase().replace(/\s+/g, '-') || 'main';

  // Check for connections either from Deployment itself or from child pod
  const targetIds = [data.id || ''];
  if (mainPod?.id) targetIds.push(mainPod.id);

  const { volumes, volumeMounts } = getVolumeConfig(targetIds, nodes, edges);
  const env = getEnvFromConnections(targetIds, nodes, edges);

  const containerResources = (podData.cpuLimit || podData.memoryLimit || podData.cpuRequest || podData.memoryRequest) ? {
    requests: (podData.cpuRequest || podData.memoryRequest) ? {
      cpu: podData.cpuRequest,
      memory: podData.memoryRequest
    } : undefined,
    limits: (podData.cpuLimit || podData.memoryLimit) ? {
      cpu: podData.cpuLimit,
      memory: podData.memoryLimit
    } : undefined
  } : undefined;

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace },
    spec: {
      replicas: data.replicas || 1,
      selector: { matchLabels: { app: name } },
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: { maxSurge: '25%', maxUnavailable: '25%' }
      },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          containers: [{
            name: containerName,
            image: podData.image || 'nginx:latest',
            imagePullPolicy: 'IfNotPresent',
            ports: podData.port ? [{ containerPort: podData.port }] : undefined,
            env: env.length > 0 ? env : undefined,
            resources: containerResources,
            volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined
          }],
          volumes: volumes.length > 0 ? volumes : undefined
        }
      }
    }
  };
};

export const generateServiceYaml = (data: K8sNodeData, name: string, nodes: any[] = [], edges: any[] = [], namespace?: string) => {
  // Try to find a workload connected to this service to get the correct selector
  const outgoingEdges = edges.filter(e => e.source === data.id);
  const targetWorkload = nodes.find(n => (n.type === 'Deployment' || n.type === 'Pod') && outgoingEdges.some(e => e.target === n.id));
  const selectorLabel = targetWorkload ? targetWorkload.data.label.toLowerCase().replace(/\s+/g, '-') : (data.selector || 'app-label');

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name, namespace },
    spec: {
      selector: { app: selectorLabel },
      ports: [{ protocol: 'TCP', port: data.port || 80, targetPort: data.targetPort || 80 }]
    }
  };
};

export const generateIngressYaml = (data: K8sNodeData, name: string, nodes: any[], edges: any[], namespace?: string) => {
  const outgoingEdges = edges.filter(e => e.source === data.id);
  const targetService = nodes.find(n => n.type === 'Service' && outgoingEdges.some(e => e.target === n.id));
  const serviceName = targetService ? targetService.data.label.toLowerCase().replace(/\s+/g, '-') : 'tbd-service';

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name,
      namespace,
      annotations: {
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
        'kubernetes.io/ingress.class': 'nginx'
      }
    },
    spec: {
      ingressClassName: 'nginx',
      rules: [{
        host: data.ingressHost || 'example.local',
        http: {
          paths: [{
            path: data.ingressPath || '/',
            pathType: 'Prefix',
            backend: {
              service: {
                name: serviceName,
                port: { number: targetService?.data.port || 80 }
              }
            }
          }]
        }
      }]
    }
  };
};

export const generateHPAYaml = (data: K8sNodeData, name: string, nodes: any[], edges: any[], namespace?: string) => {
  const outgoingEdges = edges.filter(e => e.source === data.id);
  const targetDeployment = nodes.find(n => n.type === 'Deployment' && outgoingEdges.some(e => e.target === n.id));
  const deploymentName = targetDeployment ? targetDeployment.data.label.toLowerCase().replace(/\s+/g, '-') : 'tbd-deployment';

  const metrics: any[] = [];

  if (data.targetCPU || !data.targetMemory) {
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: data.targetCPU || 50
        }
      }
    });
  }

  if (data.targetMemory) {
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'memory',
        target: {
          type: 'Utilization',
          averageUtilization: data.targetMemory
        }
      }
    });
  }

  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: { name, namespace },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: deploymentName
      },
      minReplicas: data.minReplicas || 1,
      maxReplicas: data.maxReplicas || 10,
      metrics
    }
  };
};
