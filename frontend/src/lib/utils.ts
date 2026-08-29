import { logger } from './logger';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import yaml from 'js-yaml';

/**
 * Merges and resolves Tailwind CSS class names cleanly using `clsx` and `tailwind-merge`.
 *
 * @param inputs - Array of class names, conditional objects, or class strings.
 * @returns Combined string of merged Tailwind CSS classes without duplicate/conflicting utilities.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Trims leading and trailing hyphen (`-`) characters from a string.
 * Uses a linear $O(N)$ scanning approach via character codes instead of regular expression
 * backtracking, preventing Regular Expression Denial of Service (ReDoS) vulnerabilities.
 *
 * @param str - The input string to trim.
 * @returns A new string with all leading and trailing hyphens removed.
 */
export const trimDashes = (str: string): string => {
  let start = 0;
  let end = str.length;
  while (start < end && str.codePointAt(start) === 45) {
    start++;
  }
  while (end > start && str.codePointAt(end - 1) === 45) {
    end--;
  }
  return str.slice(start, end);
};

/**
 * Sanitizes an arbitrary input string into a URL- and filename-safe slug.
 * Converts characters to lowercase, keeps valid alphanumeric characters (`a-z`, `0-9`),
 * underscores (`_`), and hyphens (`-`), replacing all other non-alphanumeric character sequences
 * with a single hyphen delimiter without using regex backtracking.
 *
 * @param input - Raw input string (e.g. user input, node name, or resource label).
 * @returns Clean, slugified string stripped of leading/trailing hyphens.
 */
export const sanitizeSlug = (input: string): string => {
  let result = '';
  let lastWasDash = false;

  const lowerInput = input.toLowerCase();
  for (const ch of lowerInput) {
    const code = ch.codePointAt(0);
    const isValid = code !== undefined && ((code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95 || code === 45);

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
 * Sanitizes Kubernetes project and scenario names into clean filename and URL slugs.
 * Specifically converts prefix `"scenario:"` (case-insensitive) into `"scenario-"` before
 * passing the string to `sanitizeSlug` to maintain standard formatting.
 *
 * @param projectName - Name of the project or scenario (e.g. `"Scenario: Basic Deployment"`).
 * @returns Sanitized slug string (e.g. `"scenario-basic-deployment"`).
 */
export const cleanProjectName = (projectName: string): string => {
  let lower = projectName.toLowerCase();
  if (lower.startsWith('scenario:')) {
    lower = 'scenario-' + lower.slice(9).trimStart();
  }
  return sanitizeSlug(lower);
};

/**
 * Recursively calculates the absolute top-left canvas position (x, y) of a React Flow node
 * by traversing up its parent container hierarchy and summing relative position offsets.
 *
 * @param nodeId - ID of the target node.
 * @param currentNodes - Array of all active canvas nodes.
 * @returns Object containing absolute `{ x, y }` coordinates relative to the canvas origin.
 */
export const getAbsPos = (nodeId: string, currentNodes: any[]): { x: number, y: number } => {
  const n = currentNodes.find(i => i.id === nodeId);
  if (!n?.position) return { x: 0, y: 0 };
  if (!n.parentId) return n.position;
  const pAbs = getAbsPos(n.parentId, currentNodes);
  return { x: n.position.x + pAbs.x, y: n.position.y + pAbs.y };
};

/**
 * Generates a cryptographically secure pseudo-random floating-point number in the range `[0, 1)`.
 * Prefers Web Crypto API (`crypto.getRandomValues`) when available, falling back safely to
 * `Math.random()` in environments lacking crypto primitives.
 *
 * @returns Pseudo-random number between 0 (inclusive) and 1 (exclusive).
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
 * Generates a unique random string ID for dynamic canvas nodes and components.
 * Uses base-36 encoding derived from `safeRandom()`.
 *
 * @param prefix - Optional prefix prepended to the generated identifier (e.g. `'pod'`).
 * @returns Unique string identifier (e.g. `'pod-a1b2c3d4'`).
 */
export const randomId = (prefix: string = ''): string => {
  const suffix = safeRandom().toString(36).substring(2, 11);
  return prefix ? `${prefix}-${suffix}` : suffix;
};

/**
 * Parses a Kubernetes CPU limit or request specification into millicores (`m`).
 * Handles millicore strings (`'500m'`), core strings (`'1.5'`, `'2'`), and numeric inputs.
 *
 * @param cpu - Raw CPU value string or number.
 * @returns CPU value normalized to millicores (e.g. `'1.5'` -> `1500`, `'250m'` -> `250`). Default: `500`.
 */
export function parseCPU(cpu: string | number | undefined): number {
  if (cpu === undefined || cpu === null || cpu === '') return 500;
  if (typeof cpu === 'number') return cpu;
  if (cpu.endsWith('m')) return Number.parseInt(cpu, 10) || 500;
  const val = Number.parseFloat(cpu);
  return Number.isNaN(val) ? 500 : val * 1000;
}

/**
 * Parses a Kubernetes memory limit or request specification into Mebibytes (`Mi`).
 * Handles Mebibytes strings (`'512Mi'`), Gibibytes strings (`'1.5Gi'`), and numeric inputs.
 *
 * @param mem - Raw memory value string or number.
 * @returns Memory value normalized to Mebibytes (e.g. `'1.5Gi'` -> `1536`, `'256Mi'` -> `256`). Default: `512`.
 */
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

/**
 * Formats CPU millicores (`m`) into a human-readable display string.
 *
 * @param milli - CPU value in millicores (e.g. `2500`, `500`).
 * @returns Formatted CPU string (e.g. `2500` -> `'2.5 Core'`, `500` -> `'500m'`).
 */
export function formatCPU(milli: number): string {
  if (milli >= 1000) return `${(milli / 1000).toFixed(1)} Core`;
  return `${Math.round(milli)}m`;
}

/**
 * Formats memory in Mebibytes (`Mi`) into a human-readable display string.
 *
 * @param mib - Memory value in Mebibytes (e.g. `2048`, `512`).
 * @returns Formatted memory string (e.g. `2048` -> `'2.0 Gi'`, `512` -> `'512 Mi'`).
 */
export function formatMemory(mib: number): string {
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} Gi`;
  return `${Math.round(mib)} Mi`;
}

/**
 * Validates that resource limits are greater than or equal to resource requests for Kubernetes workloads.
 *
 * @param data - Object containing `cpuRequest`, `cpuLimit`, `memoryRequest`, and `memoryLimit`.
 * @returns Object with boolean error flags: `{ isCpuError, isMemError, hasError }`.
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

/**
 * Asynchronously converts active canvas nodes and edges into valid Kubernetes YAML specifications.
 * Invokes the Wails Go backend `GenerateYaml` method when running in the Wails runtime environment.
 *
 * @param nodes - Array of React Flow canvas nodes.
 * @param edges - Array of React Flow canvas edges.
 * @returns Promise resolving to a multi-document YAML string separated by `---`.
 */
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
