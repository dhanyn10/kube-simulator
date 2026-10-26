import React from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '@/store';

const useSafeViewport = () => {
  try {
    const rf = useReactFlow();
    if (rf && typeof rf.getViewport === 'function') {
      return rf.getViewport();
    }
  } catch {
    // Return default viewport when rendered outside ReactFlowProvider in tests
  }
  return { x: 0, y: 0, zoom: 1 };
};

/**
 * AlignmentGuideOverlay renders horizontal and vertical smart alignment guide lines
 * across the canvas when a card is dragged into alignment with peers or grid lines.
 */
export const AlignmentGuideOverlay: React.FC = () => {
  const alignmentGuideLines = useFlowStore((state) => state.alignmentGuideLines);
  const colorMode = useFlowStore((state) => state.colorMode);
  const { x: vpX, y: vpY, zoom } = useSafeViewport();

  if (!alignmentGuideLines || (alignmentGuideLines.horizontal === null && alignmentGuideLines.vertical === null)) {
    return null;
  }

  const { horizontal, vertical } = alignmentGuideLines;

  return (
    <div
      data-testid="alignment-guide-overlay"
      className="absolute inset-0 pointer-events-none z-[60] overflow-hidden"
    >
      {vertical !== null && (
        <div
          data-testid="alignment-guide-vertical"
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-cyan-400 dark:border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
          style={{ left: `${vertical * zoom + vpX}px` }}
        >
          <span
            className={
              colorMode === 'dark'
                ? "absolute top-3 left-1.5 px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-[9px] font-mono tracking-wider uppercase select-none shadow-md backdrop-blur-sm"
                : "absolute top-3 left-1.5 px-1.5 py-0.5 rounded bg-cyan-50/90 border border-cyan-300 text-cyan-700 text-[9px] font-mono tracking-wider uppercase select-none shadow-md backdrop-blur-sm"
            }
          >
            Align X
          </span>
        </div>
      )}

      {horizontal !== null && (
        <div
          data-testid="alignment-guide-horizontal"
          className="absolute left-0 right-0 border-t-2 border-dashed border-cyan-400 dark:border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
          style={{ top: `${horizontal * zoom + vpY}px` }}
        >
          <span
            className={
              colorMode === 'dark'
                ? "absolute left-3 top-1.5 px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-[9px] font-mono tracking-wider uppercase select-none shadow-md backdrop-blur-sm"
                : "absolute left-3 top-1.5 px-1.5 py-0.5 rounded bg-cyan-50/90 border border-cyan-300 text-cyan-700 text-[9px] font-mono tracking-wider uppercase select-none shadow-md backdrop-blur-sm"
            }
          >
            Align Y
          </span>
        </div>
      )}
    </div>
  );
};
