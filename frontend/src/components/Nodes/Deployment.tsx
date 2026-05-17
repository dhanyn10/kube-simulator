import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { QuickConnectArrows } from './QuickConnectArrows';
import { useNodeRename, useNodeResize } from '../../hooks/useNodeEditor';
import { useNodeStyles } from '../../hooks/useNodeStyles';
import { NodeActionButtons, NodeRenameInput } from './NodeUI';

export const DeploymentNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const edges = useFlowStore((state) => state.edges);
  const nodes = useFlowStore((state) => state.nodes);
  const { transitionClasses } = useNodeStyles(props.id);

  // Check if targeted by HPA
  const isTargetedByHPA = edges.some(e => e.target === props.id && nodes.find(n => n.id === e.source)?.type === 'HPA');
  const hasRequests = !!(data.cpuRequest && data.memoryRequest);
  const showHPAWarning = isTargetedByHPA && !hasRequests;

  const { isEditing, setIsEditing, editValue, setEditValue, inputRef, handleRename, onKeyDown } =
    useNodeRename(props.id, data.label, data.onRename);

  const { handleNodeResize, handleNodeResizeStop } = useNodeResize(props.id, props.type);

  const getBadgeColor = () => {
    if (data.isHovered) return "bg-violet-400";
    if (data.isDetaching) return "bg-red-500";
    return "bg-violet-600";
  };

  let borderClass = "hover:border-slate-700";
  if (props.selected) {
    borderClass = colorMode === 'dark'
      ? "border-violet-500 ring-4 ring-violet-500/10"
      : "border-violet-400 ring-4 ring-violet-400/10";
  }

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-xl p-6 cursor-grab w-full h-full flex flex-col min-h-[140px]",
      transitionClasses,
      "transition-colors duration-200",
      colorMode === 'dark' ? "bg-violet-600/5 border-slate-800" : "bg-violet-50/30 border-slate-300",
      borderClass,
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
          getBadgeColor()
        )}>
          DEPLOYMENT
        </span>

        {NodeRenameInput({
          isEditing,
          setIsEditing,
          editValue,
          setEditValue,
          inputRef,
          handleRename,
          onKeyDown,
          colorMode,
          label: data.label,
          inputClassName: colorMode === 'dark' ? "text-violet-300 border-violet-500" : "text-violet-700 border-violet-400",
          buttonClassName: colorMode === 'dark' ? "text-violet-300" : "text-violet-700"
        })}
      </div>

      <div className={cn("absolute top-3 left-6 text-[9px] font-mono", colorMode === 'dark' ? "text-violet-400/60" : "text-violet-600/70")}>
        replicas: {data.replicas || 0}
      </div>

      <NodeActionButtons
        id={props.id}
        onDelete={data.onDelete}
        colorMode={colorMode}
        className="absolute top-2 right-2 z-10"
      />

      {showHPAWarning && (
        <div className="absolute -top-10 left-0 right-0 animate-pulse flex justify-center z-[100]">
          <div className="bg-amber-500 text-white text-[8px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1">
            <span className="text-xs">⚠️</span> HPA ACTIVE: REQUESTS REQUIRED
          </div>
        </div>
      )}



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
