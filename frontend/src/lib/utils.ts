import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dump from 'js-yaml';
import { K8sNodeData } from '../types';
import {
  generateNamespaceYaml,
  generatePodYaml,
  generateDeploymentYaml,
  generateReplicaSetYaml,
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

/**
 * Validates that resource limits are greater than or equal to requests.
 */
export function validateResourceLimits(data: any) {
  const cpuReq = parseCPU(data.cpuRequest);
  const cpuLim = parseCPU(data.cpuLimit);
  const memReq = parseMemory(data.memoryRequest);
  const memLim = parseMemory(data.memoryLimit);

  const isCpuError = !!data.cpuLimit && cpuLim < cpuReq;
  const isMemError = !!data.memoryLimit && memLim < memReq;

  return {
    isCpuError,
    isMemError,
    hasError: isCpuError || isMemError
  };
}

const generatorMap: Record<string, (data: K8sNodeData, name: string, nodes: any[], edges: any[], namespace?: string) => any> = {
  Namespace: (data, name) => generateNamespaceYaml(data, name),
  Pod: (data, name, nodes, edges, namespace) => generatePodYaml(data, name, nodes, edges, namespace),
  Deployment: (data, name, nodes, edges, namespace) => generateDeploymentYaml(data, name, nodes, edges, namespace),
  ReplicaSet: (data, name, nodes, edges, namespace) => generateReplicaSetYaml(data, name, nodes, edges, namespace),
  Service: (data, name, nodes, edges, namespace) => generateServiceYaml(data, name, nodes, edges, namespace),
  Ingress: (data, name, nodes, edges, namespace) => generateIngressYaml(data, name, nodes, edges, namespace),
  HPA: (data, name, nodes, edges, namespace) => generateHPAYaml(data, name, nodes, edges, namespace),
  PVC: (data, name, _nodes, _edges, namespace) => generatePVCYaml(data, name, namespace),
  ConfigMap: (data, name, _nodes, _edges, namespace) => generateConfigMapYaml(data, name, namespace),
  Secret: (data, name, _nodes, _edges, namespace) => generateSecretYaml(data, name, namespace),
};

export function generateYaml(nodes: any[], edges: any[]): string {
  const manifests = nodes.map((node) => {
    try {
      const data: K8sNodeData = { ...node.data, id: node.id };
      if (!data.label || !node.type) return null;

      // Skip nodes that don't produce YAML directly
      if (['Internet'].includes(node.type)) return null;

      // Special check for nested pods (only top-level or Namespace-child pods are generated)
      if (node.type === 'Pod' && node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent?.type !== 'Namespace') return null;
      }

      const name = data.label.toLowerCase().replace(/\s+/g, '-');
      const parent = node.parentId ? nodes.find(n => n.id === node.parentId) : null;
      const namespace = parent?.type === 'Namespace' ? parent.data.label.toLowerCase().replace(/\s+/g, '-') : undefined;

      const generator = generatorMap[node.type];
      if (generator) {
        return generator(data, name, nodes, edges, namespace);
      }

      console.warn('Unknown node type for YAML generation:', node.type);
      return null;
    } catch (err) {
      console.error('Error generating YAML for node', node.id, err);
      return null;
    }
  }).filter(Boolean);

  return manifests.map(m => dump.dump(m, { indent: 2 })).join('---\n');
}
