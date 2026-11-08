import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

export interface NodeHandlesProps {
  color?: string;
  className?: string;
  bottomSourceClassName?: string;
  rightSourceClassName?: string;
}

/**
 * Standardized 8-way connection handles for canvas resource cards.
 * Ensures connection edges snap precisely to the exact horizontal and vertical midpoints
 * of each card's boundary across all orthogonal directions (top, bottom, left, right).
 */
export const NodeHandles = memo(({
  color = 'blue',
  className,
  bottomSourceClassName,
  rightSourceClassName,
}: NodeHandlesProps) => {
  return (
    <>
      {/* Top handles: exact horizontal center (50%), top edge */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-t"
        style={{ left: '50%', top: 0, transform: 'translate(-50%, -50%)' }}
        className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`, className)}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-s"
        style={{ left: '50%', top: 0, transform: 'translate(-50%, -50%)' }}
        className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`, className)}
      />

      {/* Bottom handles: exact horizontal center (50%), bottom edge */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-t"
        style={{ left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }}
        className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`, className)}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-s"
        style={{ left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }}
        className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`, bottomSourceClassName, className)}
      />

      {/* Left handles: exact vertical center (50%), left edge */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-t"
        style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)' }}
        className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`, className)}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-s"
        style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)' }}
        className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`, className)}
      />

      {/* Right handles: exact vertical center (50%), right edge */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-t"
        style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)' }}
        className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`, className)}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-s"
        style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)' }}
        className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`, rightSourceClassName, className)}
      />
    </>
  );
});

NodeHandles.displayName = 'NodeHandles';
