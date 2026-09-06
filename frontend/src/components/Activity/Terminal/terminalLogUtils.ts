import React from 'react';
import { cleanProjectName, sanitizeSlug } from '../../../lib/utils';

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: string;
}

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

export const getLogLineColorClass = (line: string, colorMode: 'dark' | 'light'): string => {
  const isDark = colorMode === 'dark';
  if (line.includes('[SUCCESS]') || line.includes('READY')) {
    return isDark ? 'text-emerald-400 font-semibold' : 'text-emerald-600 font-semibold';
  }
  if (line.includes('[ERROR]') || line.includes('[FATAL]') || line.includes('Err') || line.includes('Failed')) {
    return isDark ? 'text-rose-400 font-semibold' : 'text-rose-600 font-semibold';
  }
  if (line.includes('[WARN]') || line.includes('[WARNING]') || line.includes('Pending')) {
    return isDark ? 'text-amber-400' : 'text-amber-600';
  }
  if (line.startsWith('$') || line.startsWith('>')) {
    return isDark ? 'text-cyan-400 font-bold' : 'text-cyan-600 font-bold';
  }
  if (line.includes('===') || line.includes('---')) {
    return isDark ? 'text-slate-500 font-bold' : 'text-slate-400 font-bold';
  }
  if (line.includes('POD:') || line.includes('DEPLOYMENT:') || line.includes('SERVICE:')) {
    return isDark ? 'text-purple-400 font-semibold' : 'text-purple-600 font-semibold';
  }
  return isDark ? 'text-slate-300' : 'text-slate-700';
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
