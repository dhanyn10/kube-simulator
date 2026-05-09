import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dump from 'js-yaml';
import { K8sNodeData } from '../types';
import {
  generatePodYaml,
  generateDeploymentYaml,
  generateServiceYaml,
  generateIngressYaml,
  generateHPAYaml
} from './yaml/generators';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateYaml(nodes: any[], edges: any[]): string {
  const manifests: any[] = nodes.map((node) => {
    const data: K8sNodeData = { ...node.data, id: node.id };
    const name = data.label.toLowerCase().replace(/\s+/g, '-');

    switch (node.type) {
      case 'Pod':
        if (node.parentId) return null;
        return generatePodYaml(data, name);
      case 'Deployment':
        return generateDeploymentYaml(data, name, nodes);
      case 'Service':
        return generateServiceYaml(data, name);
      case 'Ingress':
        return generateIngressYaml(data, name, nodes, edges);
      case 'HPA':
        return generateHPAYaml(data, name, nodes, edges);
      default:
        return null;
    }
  }).filter(Boolean);

  return manifests.map(m => dump.dump(m, { indent: 2 })).join('---\n');
}
