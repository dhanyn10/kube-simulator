import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Box, Layers, Network, Trash2, Settings, ExternalLink } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';

export const BaseNode = memo(({ children, data, selected, title, icon: Icon, color, colorHex }: { 
  children?: React.ReactNode; 
  data: K8sNodeData; 
  selected?: boolean;
  title: string;
  icon: any;
  color: string;
  colorHex?: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={cn(
      "group relative min-w-[160px] bg-slate-800 border-2 rounded-lg p-3 transition-all duration-200 cursor-grab",
      selected ? "border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]" : "border-slate-600 hover:border-slate-500",
      "shadow-xl"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[8px] font-bold tracking-widest uppercase", `text-${color}-400`)}>
            {data.type}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={onKeyDown}
            className="w-full bg-slate-900 text-xs font-mono font-bold text-slate-100 px-1 py-0.5 rounded border border-blue-500 outline-none"
          />
        ) : (
          <div 
            className="text-xs font-mono font-bold text-slate-100 truncate cursor-text"
            onDoubleClick={() => setIsEditing(true)}
          >
            {data.label}
          </div>
        )}
        {data.image ? (
          <div className="text-[9px] font-mono text-slate-400 truncate bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50">
            {data.image}
          </div>
        ) : (
          <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
            <div className={cn("h-full w-full", `bg-${color}-500/50`)}></div>
          </div>
        )}
      </div>

      {children}

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-1.5 !h-1.5 !border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-1.5 !h-1.5 !border-none" />
    </div>
  );
});

export const PodNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  return <BaseNode {...props} data={data} title="Pod" icon={Box} color="cyan" />;
});

export const ServiceNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={cn(
      "relative min-w-[180px] p-4 bg-slate-900 border-2 border-amber-500 rounded-lg shadow-2xl transition-all cursor-grab",
      props.selected ? "ring-4 ring-amber-500/20 scale-105" : "hover:border-amber-400"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 bg-amber-500 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]"></div>
        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter">Service</span>
      </div>
      
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={onKeyDown}
          className="w-full bg-slate-950 text-xs font-bold text-slate-100 mb-1 px-1 py-0.5 rounded border border-amber-500 outline-none"
        />
      ) : (
        <div 
          className="text-xs font-bold text-slate-100 mb-1 cursor-text truncate"
          onDoubleClick={() => setIsEditing(true)}
        >
          {data.label}
        </div>
      )}

      <div className="text-[9px] text-slate-400 font-mono">targetPort: {data.targetPort || 8080}</div>
      
      <div className="mt-3 pt-2 border-t border-slate-800">
        <span className="text-[8px] text-slate-500 uppercase font-bold">Selector</span>
        <div className="text-[9px] font-mono mt-0.5 text-amber-300">app: {data.selector || 'web-app'}</div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </div>
  );
});

export const DeploymentNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const isHovered = data.isHovered;
  const isDetaching = data.isDetaching;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={cn(
      "group relative min-w-[320px] min-h-[160px] bg-violet-600/5 border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-grab",
      props.selected ? "border-violet-500 ring-4 ring-violet-500/10" : "border-slate-800 hover:border-slate-700",
      isHovered && "border-solid border-violet-400 bg-violet-500/10 ring-8 ring-violet-500/20 scale-[1.02] shadow-[0_0_20px_rgba(139,92,246,0.3)]",
      isDetaching && "border-solid border-red-500 bg-red-500/10 ring-8 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
    )}>
      <div className="absolute -top-3 left-6 flex items-center gap-2">
        <span className={cn(
          "text-[9px] px-2 py-0.5 rounded-sm font-bold tracking-tighter text-white uppercase transition-colors",
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
            className="bg-slate-900 text-xs font-mono font-bold text-violet-300 tracking-tight px-1 py-0.5 rounded border border-violet-500 outline-none"
          />
        ) : (
          <span 
            className="text-xs font-mono font-bold text-violet-300 tracking-tight cursor-text"
            onDoubleClick={() => setIsEditing(true)}
          >
            {data.label}
          </span>
        )}
      </div>
      
      <div className="absolute top-3 right-4 text-[9px] text-violet-400/60 font-mono">
        replicas: {data.replicas || 0}
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.();
        }}
        className="absolute top-3 right-12 opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-red-400"
      >
        <Trash2 size={12} />
      </button>

      <div className="pointer-events-none mt-4 text-[9px] uppercase tracking-[0.2em] text-slate-700 font-black text-center italic opacity-40">
        Workload Zone
      </div>

      <Handle type="target" position={Position.Left} className="!bg-violet-600" />
      <Handle type="source" position={Position.Right} className="!bg-violet-600" />
    </div>
  );
});
