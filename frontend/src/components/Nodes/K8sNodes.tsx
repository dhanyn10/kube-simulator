import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Box, Layers, Network, Trash2, Settings, ExternalLink } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

export const BaseNode = memo(({ children, data, selected, title, icon: Icon, color, colorHex, id, type }: { 
  children?: React.ReactNode; 
  data: K8sNodeData; 
  selected?: boolean;
  title: string;
  icon: any;
  color: string;
  colorHex?: string;
  id: string;
  type: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const onNodeResize = useFlowStore((state) => state.onNodeResize);
  const colorMode = useFlowStore((state) => state.colorMode);

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
      id: id,
      type: type,
      width: params.width,
      height: params.height,
    };
    onNodeResize(event, updatedNode as any);
  }, [id, type, onNodeResize]);

  return (
    <div className={cn(
      "group relative border-2 rounded-lg p-3 cursor-grab w-full h-full transition-colors",
      colorMode === 'dark' ? "bg-slate-800 border-slate-600 shadow-xl" : "bg-white border-slate-200 shadow-md",
      selected ? (colorMode === 'dark' ? "border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]" : "border-blue-500 ring-4 ring-blue-500/10 shadow-lg") : "hover:border-slate-500",
    )}>
      <NodeResizer 
        minWidth={100} 
        minHeight={60} 
        isVisible={selected} 
        lineClassName={colorMode === 'dark' ? "border-blue-400" : "border-blue-500"} 
        handleClassName={cn("h-2 w-2 border-2 rounded", colorMode === 'dark' ? "bg-white border-blue-400" : "bg-white border-blue-500")}
        onResize={handleNodeResize}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[8px] font-bold tracking-widest uppercase", 
            colorMode === 'dark' ? 'text-' + color + '-400' : 'text-' + color + '-600'
          )}>
            {data.type}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
          className={cn(
            "opacity-0 group-hover:opacity-100 p-1 rounded transition-all",
            colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-red-400" : "hover:bg-slate-100 text-slate-400 hover:text-red-500"
          )}
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
            className={cn(
                "w-full text-xs font-mono font-bold px-1 py-0.5 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-900 text-slate-100 border-blue-500" : "bg-slate-50 text-slate-900 border-blue-400"
            )}
          />
        ) : (
          <div 
            className={cn(
                "text-xs font-mono font-bold truncate cursor-text",
                colorMode === 'dark' ? "text-slate-100" : "text-slate-900"
            )}
            onDoubleClick={() => setIsEditing(true)}
          >
            {data.label}
          </div>
        )}
        {data.image ? (
          <div className={cn(
            "text-[9px] font-mono truncate px-1.5 py-0.5 rounded border",
            colorMode === 'dark' ? "text-slate-400 bg-slate-900/50 border-slate-700/50" : "text-slate-500 bg-slate-50 border-slate-200"
          )}>
            {data.image}
          </div>
        ) : (
          <div className={cn("w-full h-1 rounded-full overflow-hidden", colorMode === 'dark' ? "bg-slate-700" : "bg-slate-200")}>
            <div className={cn("h-full w-full", colorMode === 'dark' ? 'bg-' + color + '-500/50' : 'bg-' + color + '-500/70')}></div>
          </div>
        )}
      </div>

      {children}

      <Handle type="target" position={Position.Top} className={cn("!w-1.5 !h-1.5 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
      <Handle type="source" position={Position.Bottom} className={cn("!w-1.5 !h-1.5 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
    </div>
  );
});

export const PodNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  return <BaseNode {...props} data={data} title="Pod" icon={Box} color="cyan" id={props.id} type={props.type} />;
});

export const ServiceNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const onNodeResize = useFlowStore((state) => state.onNodeResize);
  const colorMode = useFlowStore((state) => state.colorMode);

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

  return (
    <div className={cn(
      "relative p-4 border-2 rounded-lg shadow-2xl cursor-grab w-full h-full transition-colors",
      colorMode === 'dark' ? "bg-slate-900 border-amber-500 shadow-amber-900/20" : "bg-white border-amber-500 shadow-amber-100",
      props.selected ? "ring-4 ring-amber-500/20" : "hover:border-amber-400"
    )}>
      <NodeResizer 
        minWidth={150} 
        minHeight={100} 
        isVisible={props.selected} 
        lineClassName="border-amber-500" 
        handleClassName="h-2 w-2 bg-white border-2 border-amber-500 rounded" 
        onResize={handleNodeResize}
      />
      
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
      
      <div className={cn("mt-3 pt-2 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")}>
        <span className={cn("text-[8px] uppercase font-bold", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>Selector</span>
        <div className="text-[9px] font-mono mt-0.5 text-amber-500">app: {data.selector || 'web-app'}</div>
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
  const onNodeResize = useFlowStore((state) => state.onNodeResize);
  const colorMode = useFlowStore((state) => state.colorMode);

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

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-xl p-6 cursor-grab w-full h-full transition-colors",
      colorMode === 'dark' ? "bg-violet-600/5 border-slate-800" : "bg-violet-50/30 border-slate-300",
      props.selected ? (colorMode === 'dark' ? "border-violet-500 ring-4 ring-violet-500/10" : "border-violet-400 ring-4 ring-violet-400/10") : "hover:border-slate-700",
      isHovered && "border-solid border-violet-400 bg-violet-500/20 ring-8 ring-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.4)]",
      isDetaching && "border-solid border-red-500 bg-red-500/20 ring-8 ring-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
    )}>
      <NodeResizer 
        minWidth={300} 
        minHeight={150} 
        isVisible={props.selected} 
        lineClassName="border-violet-500" 
        handleClassName="h-2 w-2 bg-white border-2 border-violet-500 rounded" 
        onResize={handleNodeResize}
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
      
      <div className={cn("absolute top-3 right-4 text-[9px] font-mono", colorMode === 'dark' ? "text-violet-400/60" : "text-violet-600/70")}>
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
          "pointer-events-none mt-4 text-[9px] uppercase tracking-[0.2em] font-black text-center italic opacity-40",
          colorMode === 'dark' ? "text-slate-700" : "text-slate-400"
      )}>
        Workload Zone
      </div>

      <Handle type="target" position={Position.Left} className="!bg-violet-600" />
      <Handle type="source" position={Position.Right} className="!bg-violet-600" />
    </div>
  );
});