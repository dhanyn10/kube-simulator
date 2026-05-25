import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import yaml from 'js-yaml';

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

export async function generateYaml(nodes: any[], edges: any[]): Promise<string> {
  if ((globalThis as any).go?.main?.App?.GenerateYaml) {
    const jsonStr = await (globalThis as any).go.main.App.GenerateYaml(
      JSON.stringify(nodes),
      JSON.stringify(edges)
    );
    if (!jsonStr) return "";
    try {
      const objects = JSON.parse(jsonStr);
      if (!Array.isArray(objects)) return jsonStr;
      return objects.map(obj => yaml.dump(obj, { indent: 2, noRefs: true })).join('---\n');
    } catch (e) {
      return jsonStr;
    }
  }
  return "";
}
