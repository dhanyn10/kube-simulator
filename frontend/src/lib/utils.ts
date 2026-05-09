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

export function parseCPU(cpu: string | undefined): number {
  if (!cpu) return 500; // Default to 500m if not set
  if (cpu.endsWith('m')) return parseInt(cpu);
  return parseFloat(cpu) * 1000;
}

export function parseMemory(mem: string | undefined): number {
  if (!mem) return 512; // Default to 512Mi if not set
  if (mem.endsWith('Mi')) return parseInt(mem);
  if (mem.endsWith('Gi')) return parseFloat(mem) * 1024;
  return parseFloat(mem);
}

export function formatCPU(milli: number): string {
  if (milli >= 1000) return `${(milli / 1000).toFixed(1)} Core`;
  return `${Math.round(milli)}m`;
}

export function formatMemory(mib: number): string {
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} Gi`;
  return `${Math.round(mib)} Mi`;
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
