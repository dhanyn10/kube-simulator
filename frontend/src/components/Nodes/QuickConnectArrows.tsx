import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQuickConnect } from '../../activity/nodes';

interface QuickConnectArrowsProps {
  nodeId: string;
  color?: string;
}

export const QuickConnectArrows = ({ nodeId, color = 'blue' }: QuickConnectArrowsProps) => {
  const { arrowStyle, handleConnect } = useQuickConnect(nodeId, color);

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
