import  { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Anchor } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { useNodeRename, useNodeResize } from '../../hooks/useNodeEditor';
import { useNodeStyles } from '../../hooks/useNodeStyles';
import { NodeActionButtons, NodeRenameInput } from './NodeUI';

export const NamespaceNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const draggingSidebarItem = useFlowStore((state) => state.draggingSidebarItem);
  const { transitionClasses } = useNodeStyles(props.id);
  const isRoleDragging = draggingSidebarItem === 'Role' || draggingSidebarItem === 'ConfigMap';

  const { isEditing, setIsEditing, editValue, setEditValue, inputRef, handleRename, onKeyDown } =
    useNodeRename(data.label, data.onRename);

  const { handleNodeResize, handleNodeResizeStop } = useNodeResize(props.id, props.type);

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-2xl p-8 cursor-grab w-full h-full flex flex-col min-h-[280px]",
      transitionClasses,
      "transition-[border-color,background-color,box-shadow,border-style] duration-200",
      colorMode === 'dark' ? "bg-emerald-600/5 border-emerald-900/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]" : "bg-emerald-50/20 border-emerald-200 shadow-[inset_0_0_20px_rgba(16,185,129,0.02)]",
      props.selected ? "border-emerald-500/50 ring-4 ring-emerald-500/10" : "hover:border-emerald-400/50",
      data.isHovered && "border-solid border-violet-400 bg-violet-500/10 ring-8 ring-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.4)]",
      data.isDetaching && "border-solid border-red-500 bg-red-500/10 ring-8 ring-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.4)]",
      isRoleDragging && data.isHovered && "role-drag-inside-ns"
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
          inputClassName: colorMode === 'dark' ? "text-emerald-300 border-emerald-500" : "text-emerald-700 border-emerald-400",
          buttonClassName: colorMode === 'dark' ? "text-emerald-300" : "text-emerald-700",
          className: "text-sm"
        })}
      </div>

      <NodeActionButtons
        id={props.id}
        onDelete={data.onDelete}
        colorMode={colorMode}
        className="absolute top-3 right-3 z-10"
      />

      <div className={cn(
        "pointer-events-none mt-auto text-[10px] uppercase tracking-[0.3em] font-black text-center italic opacity-20 pb-4 select-none",
        colorMode === 'dark' ? "text-emerald-500" : "text-emerald-400"
      )}>
        Isolated Logic Cluster
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Top} id="top-s" className="!opacity-0 !pointer-events-none" />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!opacity-0 !pointer-events-none" />
      <Handle type="target" position={Position.Left} id="left-t" className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Left} id="left-s" className="!opacity-0 !pointer-events-none" />
      <Handle type="target" position={Position.Right} id="right-t" className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Right} id="right-s" className="!opacity-0 !pointer-events-none" />
    </div>
  );
});
