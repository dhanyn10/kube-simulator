import { K8sNodeData } from '@/types';

/**
 * Hook to calculate status-related colors and flags for nodes.
 */
export const useNodeStatus = (data: K8sNodeData, statusOverride: string | undefined, color: string, colorMode: 'dark' | 'light') => {
  const effectiveStatus = statusOverride || data.status;
  const isPending = (data.type === 'Pod' || data.type === 'Deployment') && effectiveStatus === 'pending';
  const isReady = (data.type === 'Pod' || data.type === 'Deployment') && effectiveStatus === 'ready';
  const isCrashing = effectiveStatus === 'crashing';

  const getStatusColor = (mode: 'icon' | 'text') => {
    if (isCrashing) return "text-red-600";
    if (isPending) return "text-red-500";
    if (isReady) return "text-emerald-500";
    if (colorMode === 'dark') return `text-${color}-400`;

    if (mode === 'icon') {
      return `text-${color}-500`;
    }
    return `text-${color}-600`;
  };

  let statusDotColor = "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]";
  if (isCrashing) {
    statusDotColor = "bg-red-600 animate-ping";
  } else if (isPending) {
    statusDotColor = "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]";
  }

  return {
    effectiveStatus,
    isPending,
    isReady,
    isCrashing,
    statusIconColor: getStatusColor('icon'),
    statusTextColor: getStatusColor('text'),
    statusDotColor
  };
};

export const COLOR_HEX_MAP: Record<string, string> = {
  red: '#ef4444',
  pink: '#ec4899',
  purple: '#a855f7',
  'deep-purple': '#673ab7',
  indigo: '#6366f1',
  blue: '#3b82f6',
  'light-blue': '#03a9f4',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  green: '#10b981',
  emerald: '#10b981',
  'light-green': '#8bc34a',
  lime: '#cddc39',
  yellow: '#eab308',
  amber: '#f59e0b',
  orange: '#f97316',
  'deep-orange': '#ff5722',
  brown: '#795548',
  grey: '#9e9e9e',
  slate: '#64748b',
};

export const getNodeBorderColorHex = (
  isPending: boolean,
  isReady: boolean,
  isCrashing: boolean,
  color?: string
): string => {
  if (isCrashing) return '#dc2626';
  if (isPending) return '#ef4444';
  if (isReady) return '#10b981';
  if (color && COLOR_HEX_MAP[color]) return COLOR_HEX_MAP[color];
  return '#10b981';
};

export interface NodeContainerStylesOptions {
  selected?: boolean;
  isReady: boolean;
  isPending: boolean;
  isCrashing: boolean;
  color: string;
  colorMode: 'dark' | 'light';
  isRoleDragging?: boolean;
  nodeType?: string;
  isInsideNamespace?: boolean;
  isHovered?: boolean;
  isAutocompleteHovered?: boolean;
  borderColorHex?: string;
}

const getSelectionClasses = (selected: boolean | undefined, color: string, isDark: boolean): string => {
  if (!selected) return `hover:border-${color}-500/50`;
  return isDark
    ? "border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]"
    : "border-blue-500 ring-4 ring-blue-500/10 shadow-lg";
};

const getReadyClasses = (isReady: boolean, isDark: boolean): string => {
  if (!isReady) return "";
  return isDark
    ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
    : "border-emerald-500/30";
};

export const COMPATIBLE_ATTACHMENT_TARGETS = ['Pod', 'Deployment', 'Service', 'Namespace', 'Ingress', 'HPA', 'PVC'];

export const getRoleDragClasses = (isRoleDragging?: boolean, nodeType?: string, isHovered?: boolean): string => {
  if (!isRoleDragging) return "";
  const isCompatible = nodeType ? COMPATIBLE_ATTACHMENT_TARGETS.includes(nodeType) : true;
  if (!isCompatible) return "role-drag-outside-ns";
  return isHovered ? "role-drag-inside-ns" : "";
};

/**
 * Hook to calculate container styling classes.
 */
export const useNodeContainerStyles = (options: NodeContainerStylesOptions) => {
  const {
    selected,
    isReady,
    isPending,
    isCrashing,
    color,
    colorMode,
    isRoleDragging,
    isHovered,
    isAutocompleteHovered
  } = options;

  const isDark = colorMode === 'dark';
  let containerBaseClasses = isDark ? "bg-slate-800 border-slate-600 shadow-xl" : "bg-white border-slate-200 shadow-md";
  let selectionClasses = getSelectionClasses(selected, color, isDark);
  let readyClasses = getReadyClasses(isReady, isDark);

  if (isAutocompleteHovered) {
    containerBaseClasses = isDark ? "bg-slate-800 border-transparent" : "bg-white border-transparent";
    selectionClasses = "";
    readyClasses = "";
  }

  const statusClasses = [
    isPending && "border-red-500/50 ring-4 ring-red-500/10 animate-pulse-slow shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    isCrashing && "border-red-600 ring-8 ring-red-600/30 animate-crash-blink shadow-[0_0_30px_rgba(220,38,38,0.6)]"
  ].filter(Boolean).join(' ');

  const roleDragClasses = getRoleDragClasses(isRoleDragging, options.nodeType, isHovered);

  return {
    containerClasses: `group relative border-2 rounded-lg p-3 cursor-grab w-auto min-w-[140px] h-auto flex flex-col min-w-0 ${containerBaseClasses} ${selectionClasses} ${readyClasses} ${statusClasses} ${roleDragClasses}`,
    progressEmptyBgClass: isDark ? "bg-slate-700" : "bg-slate-200"
  };
};
