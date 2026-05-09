import { K8sNodeData } from '../../types';

export const generatePodYaml = (data: K8sNodeData, name: string) => {
  // If a standalone Pod has multiple replicas, wrap it in a Deployment
  if ((data.replicas || 1) > 1) {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name },
      spec: {
        replicas: data.replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [{
              name: 'main',
              image: data.image || 'nginx:latest',
              ports: data.port ? [{ containerPort: data.port }] : undefined
            }]
          }
        }
      }
    };
  }

  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name },
    spec: {
      containers: [{
        name: 'main',
        image: data.image || 'nginx:latest',
        ports: data.port ? [{ containerPort: data.port }] : undefined,
        resources: (data.cpuLimit || data.memoryLimit) ? {
          limits: {
            cpu: data.cpuLimit,
            memory: data.memoryLimit
          }
        } : undefined
      }]
    }
  };
};

export const generateDeploymentYaml = (data: K8sNodeData, name: string, nodes: any[]) => {
  const childPods = nodes.filter(n => n.parentId === data.id && n.type === 'Pod');
  const mainPod = childPods[0];
  const podData = mainPod ? mainPod.data : data;
  const containerName = podData.label?.toLowerCase().replace(/\s+/g, '-') || 'main';

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name },
    spec: {
      replicas: data.replicas || 1,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          containers: [{
            name: containerName,
            image: podData.image || 'nginx:latest',
            ports: podData.port ? [{ containerPort: podData.port }] : undefined,
            resources: (podData.cpuLimit || podData.memoryLimit) ? {
              limits: {
                cpu: podData.cpuLimit,
                memory: podData.memoryLimit
              }
            } : undefined
          }]
        }
      }
    }
  };
};

export const generateServiceYaml = (data: K8sNodeData, name: string) => {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name },
    spec: {
      selector: { app: data.selector || 'app-label' },
      ports: [{ protocol: 'TCP', port: data.port || 80, targetPort: data.targetPort || 80 }]
    }
  };
};

export const generateIngressYaml = (data: K8sNodeData, name: string, nodes: any[], edges: any[]) => {
  const outgoingEdges = edges.filter(e => e.source === data.id);
  const targetService = nodes.find(n => n.type === 'Service' && outgoingEdges.some(e => e.target === n.id));
  const serviceName = targetService ? targetService.data.label.toLowerCase().replace(/\s+/g, '-') : 'tbd-service';

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: { name },
    spec: {
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

export const generateHPAYaml = (data: K8sNodeData, name: string, nodes: any[], edges: any[]) => {
  const outgoingEdges = edges.filter(e => e.source === data.id);
  const targetDeployment = nodes.find(n => n.type === 'Deployment' && outgoingEdges.some(e => e.target === n.id));
  const deploymentName = targetDeployment ? targetDeployment.data.label.toLowerCase().replace(/\s+/g, '-') : 'tbd-deployment';

  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: { name },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: deploymentName
      },
      minReplicas: data.minReplicas || 1,
      maxReplicas: data.maxReplicas || 10,
      metrics: [{
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: {
            type: 'Utilization',
            averageUtilization: data.targetCPU || 50
          }
        }
      }]
    }
  };
};
