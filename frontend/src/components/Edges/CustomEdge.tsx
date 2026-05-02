import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react';
import { Settings, Trash2 } from 'lucide-react';
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
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const setConfiguringEdgeId = useFlowStore((state: any) => state.setConfiguringEdgeId);
  const configuringEdgeId = useFlowStore((state: any) => state.configuringEdgeId);
  const isConfiguring = configuringEdgeId === id;
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = (data?.color as string) || '#1d4ed8';
  const edgeWidth = (data?.width as number) || 2;

  const onRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
    if (isConfiguring) setConfiguringEdgeId(null);
  };

  const onSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfiguringEdgeId(isConfiguring ? null : id);
  };

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: selected ? Number(edgeWidth) + 1 : Number(edgeWidth),
          stroke: edgeColor,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }} 
      />
      
      {selected && (
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
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

