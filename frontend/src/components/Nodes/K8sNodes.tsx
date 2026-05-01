import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Box, Layers, Network, Trash2, Settings, ExternalLink, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
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

  const isPending = data.type === 'Pod' && data.status === 'pending';
  const isReady = data.type === 'Pod' && data.status === 'ready';

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

  const replicas = data.replicas || 1;
  const totalDeploymentReplicas = data.parentReplicas || 0;
  const showDashedProgress = data.type === 'Pod' && totalDeploymentReplicas > 3;

  return (
    <div className={cn(
      "group relative border-2 rounded-lg p-3 cursor-grab w-full h-full transition-all flex flex-col",
      data.type === 'Pod' ? "min-h-[130px]" : "min-h-[100px]",
      colorMode === 'dark' ? "bg-slate-800 border-slate-600 shadow-xl" : "bg-white border-slate-200 shadow-md",
      selected ? (colorMode === 'dark' ? "border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]" : "border-blue-500 ring-4 ring-blue-500/10 shadow-lg") : "hover:border-slate-500",
      isPending && "border-red-500/50 ring-4 ring-red-500/10 animate-pulse-slow shadow-[0_0_20px_rgba(239,68,68,0.2)]",
      isReady && (colorMode === 'dark' ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "border-emerald-500/30")
    )}>
      {/* Visual Stacking for Replicas */}
      {replicas > 1 && (
        <div className={cn(
          "absolute -right-1.5 -top-1.5 w-full h-full border-2 rounded-lg -z-10",
          colorMode === 'dark' ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-300"
        )} />
      )}

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; border-color: rgba(239, 68, 68, 0.5); }
          50% { opacity: 0.8; border-color: rgba(239, 68, 68, 1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
      <QuickConnectArrows nodeId={id} />
      <NodeResizer 
        minWidth={100} 
        minHeight={data.type === 'Pod' ? 130 : 60}
        isVisible={selected} 
        lineClassName={colorMode === 'dark' ? "border-blue-400" : "border-blue-500"} 
        handleClassName={cn("h-2 w-2 border-2 rounded", colorMode === 'dark' ? "bg-white border-blue-400" : "bg-white border-blue-500")}
        onResize={handleNodeResize}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[8px] font-bold tracking-widest uppercase", 
            isPending ? "text-red-500" : isReady ? "text-emerald-500" : (colorMode === 'dark' ? 'text-' + color + '-400' : 'text-' + color + '-600')
          )}>
            {data.type}
          </span>
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            isPending ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
          )}></div>
          {replicas > 1 && (
            <span className={cn(
                "text-[8px] font-bold px-1 rounded-full",
                colorMode === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-500 text-white"
            )}>
                x{replicas}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
            {isPending && <AlertCircle size={10} className="text-red-500" />}
            {isReady && <CheckCircle2 size={10} className="text-emerald-500" />}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                {data.type === 'Pod' && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            useFlowStore.getState().setConfiguringNodeId(id);
                        }}
                        className={cn(
                            "p-1 rounded transition-all",
                            colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-blue-400" : "hover:bg-slate-100 text-slate-400 hover:text-blue-500"
                        )}
                    >
                        <Settings size={12} />
                    </button>
                )}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        data.onDelete?.();
                    }}
                    className={cn(
                        "p-1 rounded transition-all",
                        colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-red-400" : "hover:bg-slate-100 text-slate-400 hover:text-red-500"
                    )}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
      </div>

      {/* Content Area - now a simple flex-col to stack elements */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-0"> {/* Adjusted gap */}
        {/* Top section: Label, Dashed Progress, Badges */}
        <div className="flex flex-col gap-1.5">
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
                  "text-xs font-mono font-bold break-all cursor-text",
                  colorMode === 'dark' ? "text-slate-100" : "text-slate-900"
              )}
              onDoubleClick={() => setIsEditing(true)}
            >
              {data.label}
            </div>
          )}

          {/* Dashed Progress Bar for Replicas (moved here) */}
          {showDashedProgress && (
              <div className="flex gap-0.5 h-1 w-full items-center pb-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                      <div
                          key={i}
                          className={cn(
                              "flex-1 h-1 rounded-sm transition-all",
                              i < (data.replicas || 0)
                                  ? "bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]"
                                  : (colorMode === 'dark' ? "bg-slate-700" : "bg-slate-200")
                          )}
                      />
                  ))}
              </div>
          )}

          {data.type === 'Pod' && (
              <div className="flex flex-wrap items-center gap-1">
                  {data.runtime && data.runtime !== 'none' && (
                      <span className="text-[7px] px-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase font-bold whitespace-nowrap">
                          {data.runtime}
                      </span>
                  )}
                  {data.webserver && data.webserver !== 'none' && (
                      <span className="text-[7px] px-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 uppercase font-bold whitespace-nowrap">
                          {data.webserver}
                      </span>
                  )}
              </div>
          )}
        </div>

        {/* Bottom section: Image / Generic Progress */}
        <div className="flex flex-col gap-1.5 mt-auto shrink-0"> {/* Added mt-auto to push image to bottom */}
          {data.image ? (
            <div className={cn(
              "text-[9px] font-mono break-all px-1.5 py-0.5 rounded border",
              isPending ? "text-red-400 bg-red-500/5 border-red-500/20 italic" : (colorMode === 'dark' ? "text-slate-400 bg-slate-900/50 border-slate-700/50" : "text-slate-500 bg-slate-50 border-slate-200")
            )}>
              {isPending ? 'image: not configured' : data.image}
            </div>
          ) : (
            data.type !== 'Pod' && (
              <div className={cn("w-full h-1 rounded-full overflow-hidden", colorMode === 'dark' ? "bg-slate-700" : "bg-slate-200")}>
                  <div className={cn("h-full w-full", colorMode === 'dark' ? 'bg-' + color + '-500/50' : 'bg-' + color + '-500/70')}></div>
              </div>
            )
          )}
        </div>
      </div>

      {children}

      <Handle type="target" position={Position.Top} id="top-t" className={cn("!w-1.5 !h-1.5 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
      <Handle type="source" position={Position.Top} id="top-s" className="!opacity-0" />
      
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className={cn("!w-1.5 !h-1.5 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
      
      <Handle type="target" position={Position.Left} id="left-t" className="!opacity-0" />
      <Handle type="source" position={Position.Left} id="left-s" className="!opacity-0" />
      
      <Handle type="target" position={Position.Right} id="right-t" className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="right-s" className="!opacity-0" />
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

      <Handle type="target" position={Position.Top} id="top-t" className="!bg-amber-500" />
      <Handle type="source" position={Position.Top} id="top-s" className="!opacity-0" />
      
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!bg-amber-500" />
      
      <Handle type="target" position={Position.Left} id="left-t" className="!opacity-0" />
      <Handle type="source" position={Position.Left} id="left-s" className="!opacity-0" />
      
      <Handle type="target" position={Position.Right} id="right-t" className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="right-s" className="!opacity-0" />
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