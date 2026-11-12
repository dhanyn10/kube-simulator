import React from 'react';
import { Panel, MiniMap, type MiniMapNodeProps } from '@xyflow/react';
import { ChevronLeft, ChevronUp, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvasMiniMap } from '@/activities/layout';
import { useFlowStore } from '@/store';
import { getDomMeasuredNodeSize } from '@/store/helpers';

const renderCardDetailLines = (
  x: number,
  y: number,
  finalWidth: number,
  finalHeight: number,
  isService: boolean
) => {
  if (finalHeight < 40) return null;

  return (
    <g opacity="0.4" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="2" strokeLinecap="round">
      <line x1={x + 8} y1={y + 18} x2={x + finalWidth - 14} y2={y + 18} />
      {finalHeight >= 65 && <line x1={x + 8} y1={y + 26} x2={x + finalWidth - 22} y2={y + 26} />}
      {finalHeight >= 90 && <line x1={x + 8} y1={y + 34} x2={x + finalWidth - 18} y2={y + 34} />}
      {isService && finalHeight >= 115 && (
        <>
          <line
            x1={x + 6}
            y1={y + finalHeight - 20}
            x2={x + finalWidth - 6}
            y2={y + finalHeight - 20}
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <line
            x1={x + 8}
            y1={y + finalHeight - 11}
            x2={x + finalWidth - 16}
            y2={y + finalHeight - 11}
          />
        </>
      )}
    </g>
  );
};

export const CanvasMiniMapNode: React.FC<MiniMapNodeProps> = ({
  id,
  x,
  y,
  width,
  height,
  color,
  strokeColor,
  strokeWidth = 2,
  borderRadius = 4,
  className,
  selected,
  onClick,
}) => {
  const node = useFlowStore.getState().nodes.find((n) => n.id === id);
  const domSize = getDomMeasuredNodeSize(id);
  const finalWidth = domSize.width > 0 ? domSize.width : (node?.measured?.width ?? width);
  const finalHeight = domSize.height > 0 ? domSize.height : (node?.measured?.height ?? height);
  const isVertical = finalHeight > finalWidth;
  const isService = node?.type === 'Service';

  return (
    <g
      className={cn('react-flow__minimap-node cursor-pointer', className, selected && 'opacity-90')}
      onClick={onClick ? (e) => onClick(e, id) : undefined}
    >
      <rect
        x={x}
        y={y}
        width={finalWidth}
        height={finalHeight}
        rx={borderRadius}
        ry={borderRadius}
        fill={color || '#94A3B8'}
        stroke={strokeColor || '#334155'}
        strokeWidth={strokeWidth}
      />
      <rect
        x={x}
        y={y}
        width={finalWidth}
        height={Math.min(14, Math.max(6, finalHeight * 0.14))}
        rx={borderRadius}
        ry={borderRadius}
        fill="rgba(0, 0, 0, 0.22)"
      />
      {isVertical && renderCardDetailLines(x, y, finalWidth, finalHeight, isService)}
    </g>
  );
};

export const getMiniMapNodeColor = (
  type: string | undefined,
  colorMode: 'dark' | 'light'
): string => {
  if (type === 'Deployment' || type === 'StatefulSet') return '#8b5cf6';
  if (type === 'Pod') return '#22d3ee';
  if (type === 'Service') return '#f59e0b';
  return colorMode === 'dark' ? '#475569' : '#94A3B8';
};

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
          nodeColor={(node) => getMiniMapNodeColor(node.type, colorMode)}
          nodeStrokeColor={colorMode === 'dark' ? '#334155' : '#cbd5e1'}
          nodeStrokeWidth={2}
          nodeBorderRadius={4}
          maskColor={colorMode === 'dark' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
          nodeComponent={CanvasMiniMapNode}
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
