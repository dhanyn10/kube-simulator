import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

interface QuickConnectArrowsProps {
  nodeId: string;
  color?: string;
}

export const QuickConnectArrows = ({ nodeId, color = 'blue' }: QuickConnectArrowsProps) => {
  const onQuickConnect = useFlowStore((state) => state.onQuickConnect);
  const colorMode = useFlowStore((state) => state.colorMode);

  const arrowStyle = cn(
    "absolute flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-[1000] border-none outline-none focus:ring-2",
    colorMode === 'dark'
        ? `bg-${color}-500/20 hover:bg-${color}-500/40 text-${color}-400 focus:ring-${color}-500/50`
        : `bg-${color}-500/10 hover:bg-${color}-500/20 text-${color}-600 focus:ring-${color}-500/30`
  );

  const handleConnect = (direction: 'top' | 'right' | 'bottom' | 'left') => (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    onQuickConnect(nodeId, direction);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Connect Top"
        className={cn(arrowStyle, "-top-6 left-1/2 -translate-x-1/2")}
        onClick={handleConnect('top')}
        onKeyDown={handleConnect('top')}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        aria-label="Connect Right"
        className={cn(arrowStyle, "-right-6 top-1/2 -translate-y-1/2")}
        onClick={handleConnect('right')}
        onKeyDown={handleConnect('right')}
      >
        <ChevronRight size={14} />
      </button>
      <button
        type="button"
        aria-label="Connect Bottom"
        className={cn(arrowStyle, "-bottom-6 left-1/2 -translate-x-1/2")}
        onClick={handleConnect('bottom')}
        onKeyDown={handleConnect('bottom')}
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        aria-label="Connect Left"
        className={cn(arrowStyle, "-left-6 top-1/2 -translate-y-1/2")}
        onClick={handleConnect('left')}
        onKeyDown={handleConnect('left')}
      >
        <ChevronLeft size={14} />
      </button>
    </>
  );
};
