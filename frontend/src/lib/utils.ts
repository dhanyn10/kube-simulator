import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dump from 'js-yaml';
import { K8sNodeData } from '../types';
import {
  generateNamespaceYaml,
  generatePodYaml,
  generateDeploymentYaml,
  generateServiceYaml,
  generateIngressYaml,
  generateHPAYaml,
  generatePVCYaml,
  generateConfigMapYaml,
  generateSecretYaml
} from './yaml/generators';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility to generate a cryptographically safe random number between 0 and 1.
 */
export const safeRandom = (): number => {
  const array = new Uint32Array(1);
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  return Math.random(); // nosonar
};

/**
 * Utility to generate a random string for IDs.
 */
export const randomId = (prefix: string = ''): string => {
  const suffix = safeRandom().toString(36).substring(2, 11);
  return prefix ? `${prefix}-${suffix}` : suffix;
};

export function parseCPU(cpu: string | number | undefined): number {
  if (cpu === undefined || cpu === null || cpu === '') return 500;
  if (typeof cpu === 'number') return cpu;
  if (cpu.endsWith('m')) return Number.parseInt(cpu, 10) || 500;
  const val = Number.parseFloat(cpu);
  return Number.isNaN(val) ? 500 : val * 1000;
}

export function parseMemory(mem: string | number | undefined): number {
  if (mem === undefined || mem === null || mem === '') return 512;
  if (typeof mem === 'number') return mem;
  if (mem.endsWith('Mi')) return Number.parseInt(mem, 10) || 512;
  if (mem.endsWith('Gi')) {
    const val = Number.parseFloat(mem);
    return Number.isNaN(val) ? 512 : val * 1024;
  }
  const val = Number.parseFloat(mem);
  return Number.isNaN(val) ? 512 : val;
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
    try {
      const data: K8sNodeData = { ...node.data, id: node.id };
      if (!data.label) return null;
      const name = data.label.toLowerCase().replace(/\s+/g, '-');

      // Determine namespace if node is child of a Namespace node
      let namespace: string | undefined;
      if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent?.type === 'Namespace') {
          namespace = parent.data.label.toLowerCase().replace(/\s+/g, '-');
        }
      }

      switch (node.type) {
        case 'Namespace':
          return generateNamespaceYaml(data, name);
        case 'Internet':
          return null;
        case 'Pod':
          if (node.parentId && nodes.find(n => n.id === node.parentId)?.type !== 'Namespace') return null;
          return generatePodYaml(data, name, nodes, edges, namespace);
        case 'Deployment':
          return generateDeploymentYaml(data, name, nodes, edges, namespace);
        case 'Service':
          return generateServiceYaml(data, name, nodes, edges, namespace);
        case 'Ingress':
          return generateIngressYaml(data, name, nodes, edges, namespace);
        case 'HPA':
          return generateHPAYaml(data, name, nodes, edges, namespace);
        case 'PVC':
          return generatePVCYaml(data, name, namespace);
        case 'ConfigMap':
          return generateConfigMapYaml(data, name, namespace);
        case 'Secret':
          return generateSecretYaml(data, name, namespace);
        case 'PodGroup':
          return null;
        default:
          console.warn('Unknown node type for YAML generation:', node.type);
          return null;
      }
    } catch (err) {
      console.error('Error generating YAML for node', node.id, err);
      return null;
    }
  }).filter(Boolean);

  return manifests.map(m => dump.dump(m, { indent: 2 })).join('---\n');
}
