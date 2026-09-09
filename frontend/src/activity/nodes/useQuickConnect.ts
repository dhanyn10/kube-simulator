import React from 'react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

export function useQuickConnect(nodeId: string, color: string = 'blue') {
  const onQuickConnect = useFlowStore((state) => state.onQuickConnect);
  const colorMode = useFlowStore((state) => state.colorMode);

  const arrowStyle = cn(
    'absolute flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-[1000] border-none outline-none focus:ring-2',
    colorMode === 'dark'
      ? `bg-${color}-500/20 hover:bg-${color}-500/40 text-${color}-400 focus:ring-${color}-500/50`
      : `bg-${color}-500/10 hover:bg-${color}-500/20 text-${color}-600 focus:ring-${color}-500/30`
  );

  const handleConnect = (direction: 'top' | 'right' | 'bottom' | 'left') => (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    onQuickConnect(nodeId, direction);
  };

  return { arrowStyle, handleConnect };
}
