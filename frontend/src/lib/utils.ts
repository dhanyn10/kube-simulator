import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dump from 'js-yaml';
import { K8sNodeData } from '../types';
import {
  generatePodYaml,
  generateDeploymentYaml,
  generateServiceYaml,
  generateIngressYaml,
  generateHPAYaml,
  generatePVCYaml
} from './yaml/generators';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseCPU(cpu: string | number | undefined): number {
  if (cpu === undefined || cpu === null || cpu === '') return 500;
  if (typeof cpu === 'number') return cpu;
  if (cpu.endsWith('m')) return parseInt(cpu) || 500;
  const val = parseFloat(cpu);
  return isNaN(val) ? 500 : val * 1000;
}

export function parseMemory(mem: string | number | undefined): number {
  if (mem === undefined || mem === null || mem === '') return 512;
  if (typeof mem === 'number') return mem;
  if (mem.endsWith('Mi')) return parseInt(mem) || 512;
  if (mem.endsWith('Gi')) {
    const val = parseFloat(mem);
    return isNaN(val) ? 512 : val * 1024;
  }
  const val = parseFloat(mem);
  return isNaN(val) ? 512 : val;
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
        return generatePodYaml(data, name, nodes, edges);
      case 'Deployment':
        return generateDeploymentYaml(data, name, nodes, edges);
      case 'Service':
        return generateServiceYaml(data, name);
      case 'Ingress':
        return generateIngressYaml(data, name, nodes, edges);
      case 'HPA':
        return generateHPAYaml(data, name, nodes, edges);
      case 'PVC':
        return generatePVCYaml(data, name);
      default:
        return null;
    }
  }).filter(Boolean);

  return manifests.map(m => dump.dump(m, { indent: 2 })).join('---\n');
}
