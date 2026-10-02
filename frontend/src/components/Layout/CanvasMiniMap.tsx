import React from 'react';
import { Panel, MiniMap } from '@xyflow/react';
import { ChevronLeft, ChevronUp, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasMiniMap } from '@/activities/layout';

export const CanvasMiniMap: React.FC = () => {
  const { minimapPosition, colorMode, moveToPosition } = useCanvasMiniMap();

  const arrowBtnClass = cn(
    'absolute w-7 h-7 rounded-md flex items-center justify-center shadow-lg z-20 cursor-pointer transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110',
    colorMode === 'dark'
      ? 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-500'
      : 'bg-white text-slate-700 border border-slate-300 hover:bg-blue-500 hover:text-white hover:border-blue-400'
  );

  return (
    <Panel position={minimapPosition} className="!m-12 !p-0 border-0 bg-transparent shadow-none pointer-events-auto">
      <div className="relative group w-[200px] h-[150px]">
        <MiniMap
          position={minimapPosition}
          className={cn(
            'rounded-lg shadow-2xl !m-0 !w-full !h-full',
            colorMode === 'dark' ? '!bg-slate-900 !border-slate-800' : '!bg-slate-100 !border-slate-300'
          )}
          nodeColor={(node) => {
            if (node.type === 'Deployment') return '#8b5cf6';
            if (node.type === 'Pod') return '#22d3ee';
            if (node.type === 'Service') return '#f59e0b';
            return colorMode === 'dark' ? '#475569' : '#94A3B8';
          }}
          maskColor={colorMode === 'dark' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />

        {minimapPosition === 'bottom-right' && (
          <>
            <button
              type="button"
              onClick={() => moveToPosition('bottom-left')}
              className={cn(arrowBtnClass, 'right-full mr-2 top-1/2 -translate-y-1/2')}
              title="Move MiniMap to Bottom Left"
              aria-label="Move MiniMap to Bottom Left"
              data-testid="minimap-arrow-left"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => moveToPosition('top-right')}
              className={cn(arrowBtnClass, 'bottom-full mb-2 left-1/2 -translate-x-1/2')}
              title="Move MiniMap to Top Right"
              aria-label="Move MiniMap to Top Right"
              data-testid="minimap-arrow-up"
            >
              <ChevronUp size={16} />
            </button>
          </>
        )}

        {minimapPosition === 'bottom-left' && (
          <button
            type="button"
            onClick={() => moveToPosition('bottom-right')}
            className={cn(arrowBtnClass, 'left-full ml-2 top-1/2 -translate-y-1/2')}
            title="Move MiniMap to Bottom Right"
            aria-label="Move MiniMap to Bottom Right"
            data-testid="minimap-arrow-right"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {minimapPosition === 'top-right' && (
          <button
            type="button"
            onClick={() => moveToPosition('bottom-right')}
            className={cn(arrowBtnClass, 'top-full mt-2 left-1/2 -translate-x-1/2')}
            title="Move MiniMap to Bottom Right"
            aria-label="Move MiniMap to Bottom Right"
            data-testid="minimap-arrow-down"
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>
    </Panel>
  );
};
