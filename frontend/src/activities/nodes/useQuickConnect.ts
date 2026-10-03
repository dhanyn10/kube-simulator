import React from 'react';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { isNodeAccessForbidden } from './rbacNodeHelpers';

export function useQuickConnect(nodeId: string, color: string = 'blue') {
  const onQuickConnect = useFlowStore((state) => state.onQuickConnect);
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const node = nodes?.find((n) => n.id === nodeId);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const iamUsers = useFlowStore((state) => state.iamUsers);

  const isForbidden = isNodeAccessForbidden(activeIdentity, iamUsers || [], node?.type, node?.data, nodes);
  const isChildPod = Boolean(node?.parentId || node?.data?.parentId);

  let colorClasses = `bg-${color}-500/10 hover:bg-${color}-500/20 text-${color}-600 focus:ring-${color}-500/30`;
  if (colorMode === 'dark') {
    colorClasses = `bg-${color}-500/20 hover:bg-${color}-500/40 text-${color}-400 focus:ring-${color}-500/50`;
  }

  let arrowStyle = cn(
    'absolute flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-[1] border-none outline-none focus:ring-2',
    colorClasses
  );

  if (isForbidden || isChildPod) {
    arrowStyle = 'hidden';
  }

  const handleConnect = (direction: 'top' | 'right' | 'bottom' | 'left') => (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (isForbidden || isChildPod) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    onQuickConnect(nodeId, direction);
  };

  return { arrowStyle, handleConnect };
}
