import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from '@xyflow/react';
import { Settings, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomEdge } from '@/activities/edges';

export {
  checkNodeUnready,
  checkDownstreamErrorState,
  findDownstreamUnreadyNode,
  getTargetLoggableNode,
} from '@/activities/edges';

export const getSettingsButtonClass = (isConfiguring: boolean, isDark: boolean): string => {
  if (isConfiguring) {
    return isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600';
  }
  return isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600';
};

export default function CustomEdge(props: EdgeProps) {
  const { style = {}, markerEnd, selected, id } = props;
  const [isHovered, setIsHovered] = useState(false);

  const {
    isConfiguring,
    isSimulating,
    isDark,
    hasAlert,
    alertTooltip,
    getStrokeColor,
    edgePath,
    labelX,
    labelY,
    edgeWidth,
    onRemove,
    onSettings,
    onAlertClick,
  } = useCustomEdge(props);

  const strokeColor = getStrokeColor();

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(isSimulating && 'traffic-line')}
        style={{
          ...style,
          strokeWidth: selected ? Number(edgeWidth) + 1 : Number(edgeWidth),
          stroke: strokeColor,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />

      {/* Invisible wider interaction edge path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(20, Number(edgeWidth) + 12)}
        className="cursor-pointer pointer-events-stroke"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Directional animated arrow indicators along edge path when hovered */}
      {isHovered && (
        <g data-testid="edge-hover-animation" className="pointer-events-none">
          {/* First arrow */}
          <g>
            <path
              d="M -5 -4 L 5 0 L -5 4 Z"
              fill={strokeColor}
            >
              <animateMotion
                path={edgePath}
                dur="2s"
                repeatCount="indefinite"
                rotate="auto"
              />
            </path>
          </g>
          {/* Second arrow offset by 1 second */}
          <g>
            <path
              d="M -5 -4 L 5 0 L -5 4 Z"
              fill={strokeColor}
            >
              <animateMotion
                path={edgePath}
                dur="2s"
                begin="1s"
                repeatCount="indefinite"
                rotate="auto"
              />
            </path>
          </g>
        </g>
      )}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="flex flex-col items-center gap-2"
        >
          {hasAlert && (
            <div className="group relative flex items-center justify-center">
              <button
                type="button"
                data-testid="edge-alert-badge"
                onClick={onAlertClick}
                title="View logs in Kube Console"
                className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-lg animate-pulse cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <AlertCircle size={16} />
              </button>
              <div
                className={cn(
                  'absolute bottom-full mb-2 hidden group-hover:block text-[10px] px-2 py-1 rounded whitespace-nowrap z-[4] shadow-md border',
                  isDark
                    ? 'bg-slate-900 text-slate-100 border-slate-700'
                    : 'bg-white text-slate-800 border-slate-200'
                )}
              >
                {alertTooltip}
              </div>
            </div>
          )}

          {selected && (
            <div
              data-testid={`edge-settings-panel-${id}`}
              className={cn(
                'flex gap-1 p-1.5 rounded-lg shadow-lg border transition-colors',
                isDark
                  ? 'bg-slate-900 text-slate-200 border-slate-700/80 shadow-black/40'
                  : 'bg-white text-slate-800 border-slate-200 shadow-slate-300/50'
              )}
            >
              <button
                type="button"
                className={cn('p-1 rounded transition-colors', getSettingsButtonClass(isConfiguring, isDark))}
                onClick={onSettings}
                title="Settings"
              >
                <Settings size={14} />
              </button>
              <button
                type="button"
                className={cn(
                  'p-1 rounded text-red-500 transition-colors',
                  isDark ? 'hover:bg-red-950/50' : 'hover:bg-red-100'
                )}
                onClick={onRemove}
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
