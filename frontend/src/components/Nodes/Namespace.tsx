import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Trash2, Settings, Anchor } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

export const NamespaceNode = memo((props: NodeProps) => {
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
    onNodeResize(event, { id: props.id, ...params } as any);
  }, [props.id, onNodeResize]);

  const handleNodeResizeStop = useCallback((event, params) => {
    onNodeResizeStop(event, { id: props.id, ...params } as any);
  }, [props.id, onNodeResizeStop]);

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-2xl p-8 cursor-grab w-full h-full transition-all duration-300 flex flex-col min-h-[280px]",
      colorMode === 'dark' ? "bg-emerald-600/5 border-emerald-900/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]" : "bg-emerald-50/20 border-emerald-200 shadow-[inset_0_0_20px_rgba(16,185,129,0.02)]",
      props.selected ? "border-emerald-500/50 ring-4 ring-emerald-500/10" : "hover:border-emerald-400/50",
      data.isHovered && "border-solid border-violet-400 bg-violet-500/10 ring-8 ring-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.4)]",
      data.isDetaching && "border-solid border-red-500 bg-red-500/10 ring-8 ring-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
    )}>
      <NodeResizer
        minWidth={400}
        minHeight={280}
        isVisible={props.selected}
        lineClassName="border-emerald-500"
        handleClassName="h-3 w-3 bg-white border-2 border-emerald-500 rounded-sm"
        onResize={handleNodeResize}
        onResizeEnd={handleNodeResizeStop}
      />

      <div className="absolute -top-3 left-8 flex items-center gap-2">
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[10px] text-white uppercase shadow-lg transition-transform group-hover:scale-105",
          "bg-emerald-600"
        )}>
          <Anchor size={12} className="text-emerald-100" />
          NAMESPACE
        </div>

        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            onBlur={handleRename}
            onKeyDown={onKeyDown}
            className={cn(
              "text-sm font-mono font-bold tracking-tight px-2 py-0.5 rounded border-2 outline-none shadow-sm",
              colorMode === 'dark' ? "bg-slate-900 text-emerald-300 border-emerald-500" : "bg-white text-emerald-700 border-emerald-400"
            )}
          />
        ) : (
          <span
            className={cn(
              "text-sm font-mono font-bold tracking-tight cursor-text drop-shadow-sm",
              colorMode === 'dark' ? "text-emerald-300" : "text-emerald-700"
            )}
            onDoubleClick={() => setIsEditing(true)}
          >
            {data.label}
          </span>
        )}
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all absolute top-3 right-3" style={{ zIndex: 10 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            useFlowStore.getState().setConfiguringNodeId(props.id);
          }}
          className={cn(
            "p-1.5 rounded-lg transition-all shadow-sm",
            colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400" : "bg-white hover:bg-slate-50 text-slate-400 hover:text-blue-500"
          )}
        >
          <Settings size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
          className={cn(
            "p-1.5 rounded-lg transition-all shadow-sm",
            colorMode === 'dark' ? "bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400" : "bg-white hover:bg-red-50 text-slate-400 hover:text-red-500"
          )}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className={cn(
        "pointer-events-none mt-auto text-[10px] uppercase tracking-[0.3em] font-black text-center italic opacity-20 pb-4 select-none",
        colorMode === 'dark' ? "text-emerald-500" : "text-emerald-400"
      )}>
        Isolated Logic Cluster
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!opacity-0" />
      <Handle type="source" position={Position.Top} id="top-s" className="!opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!opacity-0" />
      <Handle type="target" position={Position.Left} id="left-t" className="!opacity-0" />
      <Handle type="source" position={Position.Left} id="left-s" className="!opacity-0" />
      <Handle type="target" position={Position.Right} id="right-t" className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="right-s" className="!opacity-0" />
    </div>
  );
});
