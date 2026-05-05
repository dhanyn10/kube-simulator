import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Settings, Trash2, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { getPodMinimumSize } from '../../store/helpers';

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
  const onNodeResizeStop = useFlowStore((state) => state.onNodeResizeStop);
  const colorMode = useFlowStore((state) => state.colorMode);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(data.label);
    }
  }, [data.label, isEditing]);

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

  const handleNodeResizeStop = useCallback((event, params) => {
    onNodeResizeStop(event, { id, ...params } as any);
  }, [id, onNodeResizeStop]);

  const replicas = data.replicas || 1;
  const totalDeploymentReplicas = data.parentReplicas || 0;
  const showDashedProgress = data.type === 'Pod' && totalDeploymentReplicas > 3;
  const minSize = getPodMinimumSize(data);

  return (
    <div className={cn(
      "group relative border-2 rounded-lg p-3 cursor-grab w-full min-h-full h-auto transition-all flex flex-col min-w-0",
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
        minWidth={minSize.width}
        minHeight={minSize.height}
        isVisible={selected}
        lineClassName={colorMode === 'dark' ? "border-blue-400" : "border-blue-500"}
        handleClassName={cn("h-2 w-2 border-2 rounded", colorMode === 'dark' ? "bg-white border-blue-400" : "bg-white border-blue-500")}
        onResize={handleNodeResize}
        onResizeEnd={handleNodeResizeStop}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={cn(
            "text-[8px] font-bold tracking-widest uppercase shrink-0",
            isPending ? "text-red-500" : isReady ? "text-emerald-500" : (colorMode === 'dark' ? 'text-' + color + '-400' : 'text-' + color + '-600')
          )}>
            {data.type}
          </span>
          {data.type !== 'Internet' && (
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isPending ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
            )}></div>
          )}
          {replicas > 1 && (
            <span className={cn(
              "text-[8px] font-bold px-1 rounded-full shrink min-w-0 max-w-[56px] truncate",
              colorMode === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-500 text-white"
            )}>
              x{replicas}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPending && <AlertCircle size={10} className="text-red-500" />}
          {isReady && <CheckCircle2 size={10} className="text-emerald-500" />}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
            {(data.type === 'Pod' || data.type === 'Internet') && (
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
        <div className="flex flex-col gap-1.5 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={onKeyDown}
              className={cn(
                "w-full min-w-0 max-w-full text-xs font-mono font-bold px-1 py-0.5 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-900 text-slate-100 border-blue-500" : "bg-slate-50 text-slate-900 border-blue-400"
              )}
            />
          ) : (
            <div
              className={cn(
                "w-full min-w-0 max-w-full text-xs font-mono font-bold truncate cursor-text",
                colorMode === 'dark' ? "text-slate-100" : "text-slate-900"
              )}
              onDoubleClick={() => setIsEditing(true)}
              title={data.label}
            >
              {data.label}
            </div>
          )}

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
            <div className="flex flex-wrap items-center gap-1 min-w-0 max-w-full overflow-hidden">
              {data.runtime && data.runtime !== 'none' && (
                <span className="min-w-0 max-w-full truncate text-[7px] px-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase font-bold whitespace-nowrap">
                  {data.runtime}
                </span>
              )}
              {data.webserver && data.webserver !== 'none' && (
                <span className="min-w-0 max-w-full truncate text-[7px] px-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 uppercase font-bold whitespace-nowrap">
                  {data.webserver}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0 min-w-0">
          {data.image ? (
            <div className={cn(
              "w-full min-w-0 max-w-full text-[9px] font-mono whitespace-normal break-all leading-tight px-1.5 py-0.5 rounded border",
              isPending ? "text-red-400 bg-red-500/5 border-red-500/20 italic" : (colorMode === 'dark' ? "text-slate-400 bg-slate-900/50 border-slate-700/50" : "text-slate-500 bg-slate-50 border-slate-200")
            )}
              title={isPending ? 'image: not configured' : data.image}
            >
              {isPending ? 'image: not configured' : data.image}
            </div>
          ) : (
            (data.type !== 'Pod' && data.type !== 'Internet') && (
              <div className={cn("w-full h-1 rounded-full overflow-hidden", colorMode === 'dark' ? "bg-slate-700" : "bg-slate-200")}>
                <div className={cn("h-full w-full", colorMode === 'dark' ? 'bg-' + color + '-500/50' : 'bg-' + color + '-500/70')}></div>
              </div>
            )
          )}
        </div>
      </div>

      {children}

      <Handle type="target" position={Position.Top} id="top-t" className={cn("!w-2 !h-2 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className={cn("!w-2 !h-2 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
      <Handle type="target" position={Position.Left} id="left-t" className={cn("!w-2 !h-2 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
      <Handle type="source" position={Position.Right} id="right-s" className={cn("!w-2 !h-2 !border-none", colorMode === 'dark' ? "!bg-slate-600" : "!bg-slate-300")} />
    </div>
  );
});
