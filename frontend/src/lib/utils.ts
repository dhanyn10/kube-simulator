import { logger } from './logger';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import yaml from 'js-yaml';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Trims leading and trailing dash characters without using regex backtracking.
 */
export const trimDashes = (str: string): string => {
  let start = 0;
  let end = str.length;
  while (start < end && str.charCodeAt(start) === 45) {
    start++;
  }
  while (end > start && str.charCodeAt(end - 1) === 45) {
    end--;
  }
  return str.slice(start, end);
};

/**
 * Sanitizes input string into a URL/file-safe slug without regex backtracking.
 */
export const sanitizeSlug = (input: string): string => {
  let result = '';
  let lastWasDash = false;

  const lowerInput = input.toLowerCase();
  for (let i = 0; i < lowerInput.length; i++) {
    const ch = lowerInput[i];
    const code = ch.charCodeAt(0);
    const isValid = (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95 || code === 45;

    if (isValid) {
      result += ch;
      lastWasDash = ch === '-';
    } else if (!lastWasDash && result.length > 0) {
      result += '-';
      lastWasDash = true;
    }
  }

  return trimDashes(result);
};

/**
 * Sanitizes scenario and project names into slug strings without regex backtracking.
 */
export const cleanProjectName = (projectName: string): string => {
  let lower = projectName.toLowerCase();
  if (lower.startsWith('scenario:')) {
    lower = 'scenario-' + lower.slice(9).trimStart();
  }
  return sanitizeSlug(lower);
};

export const getAbsPos = (nodeId: string, currentNodes: any[]): { x: number, y: number } => {
  const n = currentNodes.find(i => i.id === nodeId);
  if (!n?.position) return { x: 0, y: 0 };
  if (!n.parentId) return n.position;
  const pAbs = getAbsPos(n.parentId, currentNodes);
  return { x: n.position.x + pAbs.x, y: n.position.y + pAbs.y };
};

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
  const generateYamlFn = (globalThis as any).go?.main?.App?.GenerateYaml;
  if (generateYamlFn) {
    const jsonStr = await generateYamlFn(
      JSON.stringify(nodes),
      JSON.stringify(edges)
    );
    if (!jsonStr) return "";
    try {
      const objects = JSON.parse(jsonStr);
      if (!Array.isArray(objects)) return jsonStr;
      return objects.map(obj => yaml.dump(obj, { indent: 2, noRefs: true })).join('---\n');
    } catch (e) {
      logger.error('Failed to parse objects for YAML generation:', e);
      return jsonStr;
    }
  }
  return "";
}
