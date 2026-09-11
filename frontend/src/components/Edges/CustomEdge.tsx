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

export default function CustomEdge(props: EdgeProps) {
  const { style = {}, markerEnd, selected } = props;
  const {
    isConfiguring,
    isSimulating,
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

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(isSimulating && 'traffic-line')}
        style={{
          ...style,
          strokeWidth: selected ? Number(edgeWidth) + 1 : Number(edgeWidth),
          stroke: getStrokeColor(),
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />

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
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[1100]">
                {alertTooltip}
              </div>
            </div>
          )}

          {selected && (
            <div className="flex gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                className={cn(
                  'p-1 rounded transition-colors',
                  isConfiguring
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                )}
                onClick={onSettings}
                title="Settings"
              >
                <Settings size={14} />
              </button>
              <button
                type="button"
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-colors"
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
