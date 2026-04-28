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
      return {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name },
        spec: {
          containers: [{ name: 'main', image: data.image || 'nginx:latest' }]
        }
      };
    }

    if (data.type === 'Deployment') {
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
              containers: [{ name: 'main', image: data.image || 'nginx:latest' }]
            }
          }
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
