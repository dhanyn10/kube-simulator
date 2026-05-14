import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Trash2, Settings } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { QuickConnectArrows } from './QuickConnectArrows';
import { useNodeRename, useNodeResize } from '../../hooks/useNodeEditor';

export const DeploymentNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const edges = useFlowStore((state) => state.edges);
  const nodes = useFlowStore((state) => state.nodes);

  // Check if targeted by HPA
  const isTargetedByHPA = edges.some(e => e.target === props.id && nodes.find(n => n.id === e.source)?.type === 'HPA');
  const hasRequests = data.cpuRequest && data.memoryRequest;
  const showHPAWarning = isTargetedByHPA && !hasRequests;

  const { isEditing, setIsEditing, editValue, setEditValue, inputRef, handleRename, onKeyDown } =
    useNodeRename(props.id, data.label, data.onRename);

  const { handleNodeResize, handleNodeResizeStop } = useNodeResize(props.id, props.type);

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-xl p-6 cursor-grab w-full h-full transition-colors flex flex-col min-h-[140px]",
      colorMode === 'dark' ? "bg-violet-600/5 border-slate-800" : "bg-violet-50/30 border-slate-300",
      props.selected ? (colorMode === 'dark' ? "border-violet-500 ring-4 ring-violet-500/10" : "border-violet-400 ring-4 ring-violet-400/10") : "hover:border-slate-700",
      data.isHovered && "border-solid border-violet-400 bg-violet-500/20 ring-8 ring-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.4)]",
      data.isDetaching && "border-solid border-red-500 bg-red-500/20 ring-8 ring-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
    )}>
      <QuickConnectArrows nodeId={props.id} color="violet" />
      <NodeResizer
        minWidth={218}
        minHeight={152}
        isVisible={props.selected}
        lineClassName="border-violet-500"
        handleClassName="h-2 w-2 bg-white border-2 border-violet-500 rounded"
        onResize={handleNodeResize}
        onResizeEnd={handleNodeResizeStop}
      />

      <div className="absolute -top-3 left-6 flex items-center gap-2">
        <span className={cn(
          "text-[9px] px-2 py-0.5 rounded-sm font-bold tracking-tighter text-white uppercase shadow-sm",
          data.isHovered ? "bg-violet-400" : data.isDetaching ? "bg-red-500" : "bg-violet-600"
        )}>
          DEPLOYMENT
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            onBlur={handleRename}
            onKeyDown={onKeyDown}
            className={cn(
              "relative text-xs font-mono font-bold tracking-tight px-1 py-0.5 rounded border outline-none z-[100]",
              colorMode === 'dark' ? "bg-slate-900 text-violet-300 border-violet-500" : "bg-white text-violet-700 border-violet-400"
            )}
          />
        ) : (
          <span
            className={cn(
              "relative text-xs font-mono font-bold tracking-tight cursor-text z-[100]",
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

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all absolute top-2 right-2" style={{ zIndex: 10 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            useFlowStore.getState().setConfiguringNodeId(props.id);
          }}
          className={cn(
            "p-1 rounded transition-all",
            colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-blue-400" : "hover:bg-slate-100 text-slate-400 hover:text-blue-500"
          )}
        >
          <Settings size={12} />
        </button>
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

      {showHPAWarning && (
        <div className="absolute -top-10 left-0 right-0 animate-pulse flex justify-center z-[100]">
          <div className="bg-amber-500 text-white text-[8px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1">
            <span className="text-xs">⚠️</span> HPA ACTIVE: REQUESTS REQUIRED
          </div>
        </div>
      )}

      <div className={cn(
        "pointer-events-none mt-auto text-[9px] font-mono flex flex-col gap-0.5 opacity-60",
        colorMode === 'dark' ? "text-slate-400" : "text-slate-500"
      )}>
        {data.cpuRequest && <div>cpu: {data.cpuRequest}</div>}
        {data.memoryRequest && <div>mem: {data.memoryRequest}</div>}
      </div>

      <div className={cn(
        "pointer-events-none text-[9px] uppercase tracking-[0.2em] font-black text-center italic opacity-40 pb-2 mt-2",
        colorMode === 'dark' ? "text-slate-700" : "text-slate-400"
      )}>
        Workload Zone
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!bg-violet-600 !w-2 !h-2 z-[50]" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!bg-violet-600 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-violet-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-s" className="!bg-violet-600 !w-2 !h-2" />
    </div>
  );
});
