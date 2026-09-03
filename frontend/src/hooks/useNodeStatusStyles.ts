import { K8sNodeData } from '../types';

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

/**
 * Hook to calculate container styling classes.
 */
export const useNodeContainerStyles = (selected: boolean | undefined, isReady: boolean, isPending: boolean, isCrashing: boolean, color: string, colorMode: 'dark' | 'light', isRoleDragging?: boolean, isInsideNamespace?: boolean) => {
  const containerBaseClasses = colorMode === 'dark' ? "bg-slate-800 border-slate-600 shadow-xl" : "bg-white border-slate-200 shadow-md";
  let selectionClasses = `hover:border-${color}-500/50`;
  if (selected) {
    selectionClasses = colorMode === 'dark'
      ? "border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]"
      : "border-blue-500 ring-4 ring-blue-500/10 shadow-lg";
  }

  let readyClasses = "";
  if (isReady) {
    readyClasses = colorMode === 'dark'
      ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
      : "border-emerald-500/30";
  }

  const statusClasses = [
    isPending && "border-red-500/50 ring-4 ring-red-500/10 animate-pulse-slow shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    isCrashing && "border-red-600 ring-8 ring-red-600/30 animate-crash-blink shadow-[0_0_30px_rgba(220,38,38,0.6)]"
  ].filter(Boolean).join(' ');

  const roleDragClasses = isRoleDragging
    ? (isInsideNamespace ? "role-drag-inside-ns" : "role-drag-outside-ns")
    : "";

  return {
    containerClasses: `group relative border-2 rounded-lg p-3 cursor-grab w-auto min-w-[140px] h-auto flex flex-col min-w-0 ${containerBaseClasses} ${selectionClasses} ${readyClasses} ${statusClasses} ${roleDragClasses}`,
    progressEmptyBgClass: colorMode === 'dark' ? "bg-slate-700" : "bg-slate-200"
  };
};
