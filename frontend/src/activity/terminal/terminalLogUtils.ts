import React from 'react';
import { Node } from '@xyflow/react';
import { cleanProjectName, sanitizeSlug } from '../../lib/utils';

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: string;
}

/**
 * Finds a canvas node matching by ID or label case-insensitively.
 */
export const findNodeByTargetName = (
  nodes: Node[],
  targetName: string,
  filterType?: string | string[]
): Node | undefined => {
  const normalized = targetName.toLowerCase();
  const types = filterType ? (Array.isArray(filterType) ? filterType : [filterType]) : null;

  return nodes.find((n) => {
    if (types && !types.includes(n.type)) return false;
    const label = n.data?.label ? String(n.data.label).toLowerCase() : '';
    return n.id.toLowerCase() === normalized || label === normalized;
  });
};

/**
 * Extract attached resources (e.g. secrets, configMaps, roles, hpas) from all nodes.
 */
export const extractAttachedResources = <T>(
  nodes: Node[],
  key: string
): { item: T; ownerLabel: string }[] => {
  const result: { item: T; ownerLabel: string }[] = [];
  nodes.forEach((n) => {
    const list = n.data?.[key];
    if (Array.isArray(list)) {
      list.forEach((item: T) => {
        result.push({ item, ownerLabel: (n.data?.label as string) || n.id });
      });
    }
  });
  return result;
};

/**
 * Computes standard K8s pod ready string and display status.
 */
export const getPodDisplayStatus = (
  rawStatus: string | undefined,
  isSimulating: boolean
): { ready: string; displayStatus: string } => {
  const status = rawStatus || (isSimulating ? 'Running' : 'Pending');
  const ready = status === 'ready' || status === 'Running' ? '1/1' : '0/1';
  let displayStatus = status;
  if (status === 'ready') displayStatus = 'Running';
  if (status === 'pending') displayStatus = 'Pending';
  return { ready, displayStatus };
};

export const formatCommandTimestamp = (d = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const makeDivider = (char = '-', length = 50): string => char.repeat(length);

export const generateLogFilename = (
  projectName?: string | null,
  activeTab?: 'activity' | 'logs',
  resourceName?: string
): string => {
  let prefix = activeTab === 'activity' ? 'activity-history' : 'resource-logs';
  if (projectName) {
    const cleanProject = cleanProjectName(projectName);
    if (cleanProject) {
      prefix = `${prefix}-${cleanProject}`;
    }
  }
  if (activeTab === 'logs' && resourceName) {
    const cleanResource = sanitizeSlug(String(resourceName).toLowerCase());
    if (cleanResource) {
      prefix = `${prefix}-${cleanResource}`;
    }
  }

  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${prefix}_${dateStr}_${timeStr}.log`;
};

export const exportLogFile = (logs: string[], filename: string) => {
  if (!logs || logs.length === 0) return;
  const content = logs.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

type LogCategory = 'success' | 'error' | 'warn' | 'cmd' | 'divider' | 'resource' | 'default';

const getLogCategory = (line: string): LogCategory => {
  if (line.includes('[SUCCESS]') || line.includes('READY')) return 'success';
  if (line.includes('[ERROR]') || line.includes('[FATAL]') || line.includes('Err') || line.includes('Failed')) return 'error';
  if (line.includes('[WARN]') || line.includes('[WARNING]') || line.includes('Pending')) return 'warn';
  if (line.startsWith('$') || line.startsWith('>')) return 'cmd';
  if (line.includes('===') || line.includes('---')) return 'divider';
  if (line.includes('POD:') || line.includes('DEPLOYMENT:') || line.includes('SERVICE:')) return 'resource';
  return 'default';
};

const LOG_COLOR_MAP: Record<LogCategory, { dark: string; light: string }> = {
  success: { dark: 'text-emerald-400 font-semibold', light: 'text-emerald-600 font-semibold' },
  error: { dark: 'text-rose-400 font-semibold', light: 'text-rose-600 font-semibold' },
  warn: { dark: 'text-amber-400', light: 'text-amber-600' },
  cmd: { dark: 'text-cyan-400 font-bold', light: 'text-cyan-600 font-bold' },
  divider: { dark: 'text-slate-500 font-bold', light: 'text-slate-400 font-bold' },
  resource: { dark: 'text-purple-400 font-semibold', light: 'text-purple-600 font-semibold' },
  default: { dark: 'text-slate-300', light: 'text-slate-700' },
};

export const getLogLineColorClass = (line: string, colorMode: 'dark' | 'light'): string => {
  const category = getLogCategory(line);
  const modeKey = colorMode === 'dark' ? 'dark' : 'light';
  return LOG_COLOR_MAP[category][modeKey];
};

export const formatLogLineContent = (line: string, colorMode: 'dark' | 'light', searchQuery: string): React.ReactNode => {
  const textClass = getLogLineColorClass(line, colorMode);

  if (!searchQuery) {
    return React.createElement('span', { className: textClass }, line);
  }

  const q = searchQuery.toLowerCase();
  const escapedSearch = searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
  const parts = line.split(new RegExp(`(${escapedSearch})`, 'gi'));
  const partsWithObjects = parts.map((part, index) => ({
    key: `highlight-part-${index}-${part}`,
    text: part,
    isMatch: part.toLowerCase() === q,
  }));

  return React.createElement(
    'span',
    { className: textClass },
    partsWithObjects.map((item) => {
      if (item.isMatch) {
        return React.createElement('mark', { key: item.key, className: 'bg-yellow-500 text-black px-0.5 rounded' }, item.text);
      }
      return item.text;
    })
  );
};
