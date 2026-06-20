import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react';
import { Settings, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
  target,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const toggleEdgeSettings = useFlowStore((state: any) => state.toggleEdgeSettings);
  const setConfiguringEdgeId = useFlowStore((state: any) => state.setConfiguringEdgeId);
  const configuringEdgeId = useFlowStore((state: any) => state.configuringEdgeId);
  const activeSimulationEdges = useFlowStore((state: any) => state.activeSimulationEdges);
  const nodes = useFlowStore((state: any) => state.nodes);
  const globalEdgeColor = useFlowStore((state: any) => state.globalEdgeColor);
  const globalEdgeErrorColor = useFlowStore((state: any) => state.globalEdgeErrorColor);

  const isConfiguring = String(configuringEdgeId) === String(id);
  const isSimulating = activeSimulationEdges.some(eid => String(eid) === String(id));
  const edges = useFlowStore((state: any) => state.edges);

  /**
   * Recursive error check to see if this edge leads to a failure.
   * Traverses downstream from the target node to check if any workload is not ready.
   *
   * @returns boolean
   */
  const checkErrorState = () => {
    if (!isSimulating || validationError) return false;

    const visited = new Set<string>();
    const queue = [target];

    while (queue.length > 0) {
      const currentId = String(queue.shift()!);
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = nodes.find((n: any) => String(n.id) === currentId);
      const data = node?.data;
      const isWorkload = node?.type === 'Pod' || node?.type === 'Deployment';

      // 1. Check current node status
      if (isWorkload && data?.status !== 'ready') return true;

      // 2. If it's a Deployment, explicitly check its child pods
      if (node?.type === 'Deployment') {
        const childPods = nodes.filter((n: any) => String(n.parentId) === currentId && n.type === 'Pod');
        if (childPods.some((p: any) => p.data?.status !== 'ready')) return true;
      }

      // 3. Search downstream via edges
      const outgoingEdges = edges.filter((e: any) =>
        String(e.source) === currentId && activeSimulationEdges.some(eid => String(eid) === String(e.id))
      );

      for (const edge of outgoingEdges) {
        queue.push(String(edge.target));
      }
    }
    return false;
  };

  const validationError = data?.validationError;
  const isTargetError = checkErrorState();

  const getStrokeColor = () => {
    if (validationError) return globalEdgeErrorColor;
    if (isTargetError) return globalEdgeErrorColor;
    return globalEdgeColor;
  };
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeWidth = data?.width || 2;

  const onRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
    if (isConfiguring) setConfiguringEdgeId(null);
  };

  const onSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleEdgeSettings(id);
  };

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        className={cn(isSimulating && "traffic-line")}
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
          {validationError && (
            <div className="group relative flex items-center justify-center">
              <div className="bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse cursor-help">
                <AlertCircle size={16} />
              </div>
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[1100]">
                {validationError}
              </div>
            </div>
          )}

          {selected && (
            <div className="flex gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
              <button
                className={cn(
                  "p-1 rounded transition-colors",
                  isConfiguring 
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
                    : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
                onClick={onSettings}
                title="Settings"
              >
                <Settings size={14} />
              </button>
              <button
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

