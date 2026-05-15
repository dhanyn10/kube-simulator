import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { QuickConnectArrows } from './QuickConnectArrows';
import { useNodeStyles } from '../../hooks/useNodeStyles';
import { useNodeRename } from '../../hooks/useNodeEditor';

export const BaseNode = memo(({ children, data, selected, title, icon: Icon, color, colorHex, id, type, hideSettings, statusOverride }: {
  children?: React.ReactNode;
  data: K8sNodeData;
  selected?: boolean;
  title: string;
  icon: any;
  color: string;
  colorHex?: string;
  id: string;
  type: string;
  hideSettings?: boolean;
  statusOverride?: 'pending' | 'ready' | 'crashing';
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const { transitionClasses } = useNodeStyles(id);

  const { isEditing, setIsEditing, editValue, setEditValue, inputRef, handleRename, onKeyDown } =
    useNodeRename(id, data.label, data.onRename);

  const effectiveStatus = statusOverride || data.status;
  const isPending = (data.type === 'Pod' || data.type === 'Deployment') && effectiveStatus === 'pending';
  const isReady = (data.type === 'Pod' || data.type === 'Deployment') && effectiveStatus === 'ready';
  const isCrashing = effectiveStatus === 'crashing';

  const replicas = data.replicas || 1;
  const totalDeploymentReplicas = data.parentReplicas || 0;
  // Show dashed progress if in a deployment with > 3 replicas OR if it's a standalone pod with > 1 replica
  const showDashedProgress = data.type === 'Pod' && (totalDeploymentReplicas > 3 || (replicas > 1 && !data.parentId));

  const isInternet = data.type === 'Internet';

  // Extract status-based colors into independent statements
  const getStatusColor = (mode: 'icon' | 'text') => {
    if (isCrashing) return "text-red-600";
    if (isPending) return "text-red-500";
    if (isReady) return "text-emerald-500";
    
    if (colorMode === 'dark') return `text-${color}-400`;
    
    if (mode === 'icon') {
      return `text-${color}-500`;
    }
    return `text-${color}-600`;
  };

  const statusIconColor = getStatusColor('icon');
  const statusTextColor = getStatusColor('text');

  let statusDotColor = "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]";
  if (isCrashing) {
    statusDotColor = "bg-red-600 animate-ping";
  } else if (isPending) {
    statusDotColor = "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]";
  }

  // Container styles extraction
  let containerBaseClasses = "bg-white border-slate-200 shadow-md";
  if (colorMode === 'dark') {
    containerBaseClasses = "bg-slate-800 border-slate-600 shadow-xl";
  }

  let selectionClasses = `hover:border-${color}-500/50`;
  if (selected) {
    if (colorMode === 'dark') {
      selectionClasses = "border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]";
    } else {
      selectionClasses = "border-blue-500 ring-4 ring-blue-500/10 shadow-lg";
    }
  }

  let readyClasses = "";
  if (isReady) {
    if (colorMode === 'dark') {
      readyClasses = "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
    } else {
      readyClasses = "border-emerald-500/30";
    }
  }

  let progressEmptyBgClass = "bg-slate-200";
  if (colorMode === 'dark') {
    progressEmptyBgClass = "bg-slate-700";
  }

  return (
    <div className={cn(
      "group relative border-2 rounded-lg p-3 cursor-grab w-auto min-w-[140px] h-auto flex flex-col min-w-0",
      transitionClasses,
      "transition-[border-color,background-color,box-shadow] duration-200",
      containerBaseClasses,
      selectionClasses,
      isPending && "border-red-500/50 ring-4 ring-red-500/10 animate-pulse-slow shadow-[0_0_20px_rgba(239,68,68,0.2)]",
      readyClasses,
      isCrashing && "border-red-600 ring-8 ring-red-600/30 animate-crash-blink shadow-[0_0_30px_rgba(220,38,38,0.6)]"
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
        @keyframes crash-blink {
          0%, 100% { opacity: 1; transform: scale(1); background-color: rgba(220, 38, 38, 0.1); }
          50% { opacity: 0.5; transform: scale(0.98); background-color: rgba(220, 38, 38, 0.4); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-crash-blink {
          animation: crash-blink 0.4s ease-in-out infinite;
        }
      `}</style>
      <QuickConnectArrows nodeId={id} color={color} />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {Icon && <Icon size={12} className={cn(statusIconColor)} />}
          <span className={cn(
            "text-[8px] font-bold tracking-widest uppercase shrink-0",
            statusTextColor
          )}>
            {isCrashing ? 'Crashing' : title || data.type}
          </span>
          {data.type !== 'Internet' && data.type !== 'PVC' && (
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              statusDotColor
            )}></div>
          )}
          {replicas > 1 && (
            <span className={cn(
              "text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0",
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
            {!hideSettings && (
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
              onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              onBlur={handleRename}
              onKeyDown={onKeyDown}
              className={cn(
                "w-full min-w-0 max-w-full text-xs font-mono font-bold px-1 py-0.5 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-900 text-slate-100 border-blue-500" : "bg-slate-50 text-slate-900 border-blue-400"
              )}
            />
          ) : (
            <button
              type="button"
              className={cn(
                "w-full min-w-0 max-w-full text-xs font-mono font-bold truncate cursor-text text-left border-none bg-transparent p-0 outline-none focus:ring-1 focus:ring-blue-500/50 rounded",
                colorMode === 'dark' ? "text-slate-100" : "text-slate-900"
              )}
              onDoubleClick={() => setIsEditing(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsEditing(true);
                }
              }}
              title={`Double click to rename: ${data.label}`}
              aria-label={`Rename ${data.label}`}
            >
              {data.label}
            </button>
          )}

          {showDashedProgress && (
            <div className={cn(
              "flex gap-0.5 w-full items-center pb-1",
              data.replicas === 100 ? "h-auto" : "h-1"
            )}>
              {data.replicas === 100 ? (
                <div className="grid grid-cols-5 gap-x-2 gap-y-4 w-full py-4 px-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={`${id}-mega-progress-${i}`} className="flex flex-col items-center gap-1">
                      <div className="relative flex items-center justify-center w-10 h-10">
                        <svg className="w-full h-full transform -rotate-90">
                          {/* Background segments */}
                          <circle
                            cx="20"
                            cy="20"
                            r="16"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            fill="transparent"
                            strokeDasharray={`${(2 * Math.PI * 16) / 10 * 0.7} ${(2 * Math.PI * 16) / 10 * 0.3}`}
                            className={colorMode === 'dark' ? "text-slate-700/50" : "text-slate-200"}
                          />
                          {/* Active segments (showing 10 units each) */}
                          <circle
                            cx="20"
                            cy="20"
                            r="16"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            fill="transparent"
                            strokeDasharray={`${(2 * Math.PI * 16) / 10 * 0.7} ${(2 * Math.PI * 16) / 10 * 0.3}`}
                            strokeDashoffset={0}
                            strokeLinecap="round"
                            className="text-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                          />
                        </svg>
                        <span className="absolute text-[8px] font-black text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]">10</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={`${id}-progress-${i}`}
                    className={cn(
                      "flex-1 h-1 rounded-sm transition-all",
                      i < (data.replicas || 0)
                        ? "bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]"
                        : progressEmptyBgClass
                    )}
                  />
                ))
              )}
            </div>
          )}

          {data.type === 'Pod' && (
            <div className="flex flex-wrap items-center gap-1 min-w-0 max-w-full overflow-hidden">
              {data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none' && (
                <span className="min-w-0 max-w-full truncate text-[7px] px-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase font-bold whitespace-nowrap">
                  {data.runtime}
                </span>
              )}
              {data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none' && (
                <span className="min-w-0 max-w-full truncate text-[7px] px-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 uppercase font-bold whitespace-nowrap">
                  {data.webserver}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1.5 shrink-0 min-w-0">
          {children}
        </div>
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
      <Handle type="target" position={Position.Left} id="left-t" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
      <Handle type="source" position={Position.Right} id="right-s" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
    </div>
  );
});
