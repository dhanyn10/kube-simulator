import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dump from 'js-yaml';
import { K8sNodeData } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateYaml(nodes: any[], edges: any[]): string {
  const manifests: any[] = nodes.map((node) => {
    const data: K8sNodeData = node.data;
    const name = data.label.toLowerCase().replace(/\s+/g, '-');

    if (data.type === 'Pod') {
      // If it has a parent, it's part of a Deployment and shouldn't be generated as a separate Pod
      if (node.parentId) return null;

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
    }

    if (data.type === 'Deployment') {
      const childPods = nodes.filter(n => n.parentId === node.id && n.type === 'Pod');
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
    }

    if (data.type === 'Ingress') {
      const outgoingEdges = edges.filter(e => e.source === node.id);
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
    }

    if (data.type === 'HPA') {
      const outgoingEdges = edges.filter(e => e.source === node.id);
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
    }

    if (data.type === 'Service') {
      return {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name },
        spec: {
          selector: { app: data.selector || 'app' },
          ports: [{ protocol: 'TCP', port: data.port || 80, targetPort: data.targetPort || 80 }]
        }
      };
    }

    return null;
  }).filter(Boolean);

  return manifests.map(m => dump.dump(m, { indent: 2 })).join('---\n');
}
