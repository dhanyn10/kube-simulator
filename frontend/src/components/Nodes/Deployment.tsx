import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

const QuickConnectArrows = ({ nodeId }: { nodeId: string }) => {
  const onQuickConnect = useFlowStore((state) => state.onQuickConnect);
  const colorMode = useFlowStore((state) => state.colorMode);

  const arrowStyle = cn(
    "absolute flex items-center justify-center w-5 h-5 rounded-full transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-[1000]",
    colorMode === 'dark' ? "bg-blue-500/20 hover:bg-blue-500/40 text-blue-400" : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600"
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

export const DeploymentNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const isHovered = data.isHovered;
  const isDetaching = data.isDetaching;
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

  const handleNodeResize = useCallback((event, params) => {
    const updatedNode = {
      id: props.id,
      type: props.type,
      width: params.width,
      height: params.height,
    };
    onNodeResize(event, updatedNode as any);
  }, [props.id, props.type, onNodeResize]);

  const handleNodeResizeStop = useCallback((event, params) => {
    onNodeResizeStop(event, { id: props.id, ...params } as any);
  }, [props.id, onNodeResizeStop]);

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-xl p-6 cursor-grab w-full h-full transition-colors flex flex-col min-h-[160px]",
      colorMode === 'dark' ? "bg-violet-600/5 border-slate-800" : "bg-violet-50/30 border-slate-300",
      props.selected ? (colorMode === 'dark' ? "border-violet-500 ring-4 ring-violet-500/10" : "border-violet-400 ring-4 ring-violet-400/10") : "hover:border-slate-700",
      isHovered && "border-solid border-violet-400 bg-violet-500/20 ring-8 ring-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.4)]",
      isDetaching && "border-solid border-red-500 bg-red-500/20 ring-8 ring-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
    )}>
      <QuickConnectArrows nodeId={props.id} />
      <NodeResizer
        minWidth={300}
        minHeight={160}
        isVisible={props.selected}
        lineClassName="border-violet-500"
        handleClassName="h-2 w-2 bg-white border-2 border-violet-500 rounded"
        onResize={handleNodeResize}
        onResizeEnd={handleNodeResizeStop}
      />

      <div className="absolute -top-3 left-6 flex items-center gap-2">
        <span className={cn(
          "text-[9px] px-2 py-0.5 rounded-sm font-bold tracking-tighter text-white uppercase shadow-sm",
          isHovered ? "bg-violet-400" : isDetaching ? "bg-red-500" : "bg-violet-600"
        )}>
          DEPLOYMENT
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={onKeyDown}
            className={cn(
              "text-xs font-mono font-bold tracking-tight px-1 py-0.5 rounded border outline-none",
              colorMode === 'dark' ? "bg-slate-900 text-violet-300 border-violet-500" : "bg-white text-violet-700 border-violet-400"
            )}
          />
        ) : (
          <span
            className={cn(
              "text-xs font-mono font-bold tracking-tight cursor-text",
              colorMode === 'dark' ? "text-violet-300" : "text-violet-700"
            )}
            onDoubleClick={() => setIsEditing(true)}
          >
            {data.label}
          </span>
        )}
      </div>

      <div className={cn("absolute top-3 left-6 text-[9px] font-mono", colorMode === 'dark' ? "text-violet-400/60" : "text-violet-600/70")}>
        replicas: {data.replicas || 0}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.();
        }}
        className={cn(
          "opacity-0 group-hover:opacity-100 p-1 rounded transition-all absolute top-2 right-2",
          colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-red-400" : "hover:bg-slate-100 text-slate-400 hover:text-red-500"
        )}
        style={{ zIndex: 10 }}
      >
        <Trash2 size={12} />
      </button>

      <div className={cn(
        "pointer-events-none mt-auto text-[9px] uppercase tracking-[0.2em] font-black text-center italic opacity-40 pb-2",
        colorMode === 'dark' ? "text-slate-700" : "text-slate-400"
      )}>
        Workload Zone
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!opacity-0" />
      <Handle type="source" position={Position.Top} id="top-s" className="!opacity-0" />

      <Handle type="target" position={Position.Bottom} id="bottom-t" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!opacity-0" />

      <Handle type="target" position={Position.Left} id="left-t" className="!bg-violet-600" />
      <Handle type="source" position={Position.Left} id="left-s" className="!opacity-0" />

      <Handle type="target" position={Position.Right} id="right-t" className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="right-s" className="!bg-violet-600" />
    </div>
  );
});
