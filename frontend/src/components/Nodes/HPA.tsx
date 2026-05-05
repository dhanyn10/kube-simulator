import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

const QuickConnectArrows = ({ nodeId }: { nodeId: string }) => {
  const onQuickConnect = useFlowStore((state) => state.onQuickConnect);
  const colorMode = useFlowStore((state) => state.colorMode);

  const arrowStyle = cn(
    "absolute flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-[1000]",
    colorMode === 'dark' ? "bg-fuchsia-500/20 hover:bg-fuchsia-500/40 text-fuchsia-400" : "bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-600"
  );

  return (
    <>
      <div
        className={cn(arrowStyle, "-top-6 left-1/2 -translate-x-1/2")}
        onClick={(e) => { e.stopPropagation(); onQuickConnect(nodeId, 'top'); }}
      >
        <ChevronUp size={14} />
      </div>
      <div
        className={cn(arrowStyle, "-right-6 top-1/2 -translate-y-1/2")}
        onClick={(e) => { e.stopPropagation(); onQuickConnect(nodeId, 'right'); }}
      >
        <ChevronRight size={14} />
      </div>
      <div
        className={cn(arrowStyle, "-bottom-6 left-1/2 -translate-x-1/2")}
        onClick={(e) => { e.stopPropagation(); onQuickConnect(nodeId, 'bottom'); }}
      >
        <ChevronDown size={14} />
      </div>
      <div
        className={cn(arrowStyle, "-left-6 top-1/2 -translate-y-1/2")}
        onClick={(e) => { e.stopPropagation(); onQuickConnect(nodeId, 'left'); }}
      >
        <ChevronLeft size={14} />
      </div>
    </>
  );
};

export const HPANode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const onNodeResize = useFlowStore((state) => state.onNodeResize);
  const onNodeResizeStop = useFlowStore((state) => state.onNodeResizeStop);
  const colorMode = useFlowStore((state) => state.colorMode);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(data.label);
    }
  }, [data.label, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== data.label) {
      data.onRename?.(editValue.trim());
    } else {
      setEditValue(data.label);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.label);
    }
  };

  const handleNodeResize = useCallback((event: any, params: any) => {
    const updatedNode = {
      id: props.id,
      type: props.type,
      width: params.width,
      height: params.height,
    };
    onNodeResize(event, updatedNode as any);
  }, [props.id, props.type, onNodeResize]);

  const handleNodeResizeStop = useCallback((event: any, params: any) => {
    onNodeResizeStop(event, { id: props.id, ...params } as any);
  }, [props.id, onNodeResizeStop]);

  return (
    <div className={cn(
      "group relative p-4 border-2 rounded-lg shadow-2xl cursor-grab w-full h-full transition-colors flex flex-col min-h-[140px]",
      colorMode === 'dark' ? "bg-slate-900 border-fuchsia-500 shadow-fuchsia-900/20" : "bg-white border-fuchsia-500 shadow-fuchsia-100",
      props.selected ? "ring-4 ring-fuchsia-500/20" : "hover:border-fuchsia-400"
    )}>
      <QuickConnectArrows nodeId={props.id} />
      <NodeResizer
        minWidth={160}
        minHeight={140}
        isVisible={props.selected}
        lineClassName="border-fuchsia-500"
        handleClassName="h-2 w-2 bg-white border-2 border-fuchsia-500 rounded"
        onResize={handleNodeResize}
        onResizeEnd={handleNodeResizeStop}
      />

      <div className="flex items-center gap-2 mb-2 shrink-0">
        <Activity size={12} className="text-fuchsia-500" />
        <span className="text-[9px] font-bold text-fuchsia-500 uppercase tracking-tighter">HPA</span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={onKeyDown}
            className={cn(
              "w-full text-xs font-bold mb-1 px-1 py-0.5 rounded border outline-none",
              colorMode === 'dark' ? "bg-slate-950 text-slate-100 border-fuchsia-500" : "bg-slate-50 text-slate-900 border-fuchsia-400"
            )}
          />
        ) : (
          <div
            className={cn(
              "text-xs font-bold mb-1 cursor-text truncate",
              colorMode === 'dark' ? "text-slate-100" : "text-slate-900"
            )}
            onDoubleClick={() => setIsEditing(true)}
          >
            {data.label}
          </div>
        )}

        <div className="space-y-1 mt-1">
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>min:</span>
            <span className="text-fuchsia-500 font-bold">{data.minReplicas || 1}</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>max:</span>
            <span className="text-fuchsia-500 font-bold">{data.maxReplicas || 10}</span>
          </div>
        </div>

        <div className={cn("mt-auto pt-2 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")}>
          <span className={cn("text-[8px] uppercase font-bold", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>Target CPU</span>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={cn("flex-1 h-1 rounded-full overflow-hidden", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
                <div
                    className="h-full bg-fuchsia-500 transition-all duration-500"
                    style={{ width: `${data.targetCPU || 50}%` }}
                />
            </div>
            <span className="text-[9px] font-mono text-fuchsia-500 font-bold">{data.targetCPU || 50}%</span>
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!bg-fuchsia-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!bg-fuchsia-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-fuchsia-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-s" className="!bg-fuchsia-500 !w-2 !h-2" />
    </div>
  );
});
