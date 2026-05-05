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

export const ServiceNode = memo((props: NodeProps) => {
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
      "group relative p-4 border-2 rounded-lg shadow-2xl cursor-grab w-full h-full transition-colors flex flex-col min-h-[120px]",
      colorMode === 'dark' ? "bg-slate-900 border-amber-500 shadow-amber-900/20" : "bg-white border-amber-500 shadow-amber-100",
      props.selected ? "ring-4 ring-amber-500/20" : "hover:border-amber-400"
    )}>
      <QuickConnectArrows nodeId={props.id} />
      <NodeResizer
        minWidth={150}
        minHeight={120}
        isVisible={props.selected}
        lineClassName="border-amber-500"
        handleClassName="h-2 w-2 bg-white border-2 border-amber-500 rounded"
        onResize={handleNodeResize}
        onResizeEnd={handleNodeResizeStop}
      />

      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="w-3 h-3 bg-amber-500 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]"></div>
        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter">Service</span>
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
              colorMode === 'dark' ? "bg-slate-950 text-slate-100 border-amber-500" : "bg-slate-50 text-slate-900 border-amber-400"
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

        <div className={cn("text-[9px] font-mono", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>targetPort: {data.targetPort || 8080}</div>

        <div className={cn("mt-auto pt-2 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")}>
          <span className={cn("text-[8px] uppercase font-bold", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>Selector</span>
          <div className="text-[9px] font-mono mt-0.5 text-amber-500">app: {data.selector || 'web-app'}</div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!bg-amber-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!bg-amber-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-amber-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-s" className="!bg-amber-500 !w-2 !h-2" />
    </div>
  );
});
