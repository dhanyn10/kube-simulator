import { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { Shield } from 'lucide-react';
import { K8sNodeData } from '../../types';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { QuickConnectArrows } from './QuickConnectArrows';
import { useNodeRename, useNodeResize } from '../../hooks/useNodeEditor';
import { useNodeStyles } from '../../hooks/useNodeStyles';
import { NodeActionButtons, NodeRenameInput } from './NodeUI';

const checkIsInsideNamespace = (nodeId: string, nodes: any[]): boolean => {
  const currentNode = nodes.find((n) => n.id === nodeId);
  if (!currentNode?.parentId) return false;
  const parentNode = nodes.find((n) => n.id === currentNode.parentId);
  return parentNode?.type === 'Namespace';
};

const checkShowHPAWarning = (nodeId: string, data: K8sNodeData, edges: any[], nodes: any[]): boolean => {
  const hasRequests = Boolean(data.cpuRequest && data.memoryRequest);
  if (hasRequests) return false;
  return edges.some((e) => e.target === nodeId && nodes.find((n) => n.id === e.source)?.type === 'HPA');
};

const getRoleDragClass = (isRoleDragging: boolean, isInsideNamespace: boolean, isHovered?: boolean): string => {
  if (!isRoleDragging) return '';
  if (!isInsideNamespace) return 'role-drag-outside-ns';
  return isHovered ? 'role-drag-inside-ns' : '';
};

const getDeploymentBorderClass = (selected: boolean | undefined, colorMode: 'dark' | 'light'): string => {
  if (!selected) return 'hover:border-slate-700';
  return colorMode === 'dark'
    ? 'border-violet-500 ring-4 ring-violet-500/10'
    : 'border-violet-400 ring-4 ring-violet-400/10';
};

const getBadgeColor = (data: K8sNodeData): string => {
  if (data.isHovered) return 'bg-violet-400';
  if (data.isDetaching) return 'bg-red-500';
  return 'bg-violet-600';
};

export const DeploymentNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const draggingSidebarItem = useFlowStore((state) => state.draggingSidebarItem);
  const edges = useFlowStore((state) => state.edges);
  const nodes = useFlowStore((state) => state.nodes);
  const { transitionClasses } = useNodeStyles(props.id);

  const isInsideNamespace = checkIsInsideNamespace(props.id, nodes);
  const showHPAWarning = checkShowHPAWarning(props.id, data, edges, nodes);
  const roleDragClass = getRoleDragClass(draggingSidebarItem === 'Role' || draggingSidebarItem === 'ConfigMap', isInsideNamespace, data.isHovered);

  const { isEditing, setIsEditing, editValue, setEditValue, inputRef, handleRename, onKeyDown } =
    useNodeRename(data.label, data.onRename);

  const { handleNodeResize, handleNodeResizeStop } = useNodeResize(props.id, props.type);

  const borderClass = getDeploymentBorderClass(props.selected, colorMode);
  const badgeColor = getBadgeColor(data);
  const isDarkMode = colorMode === 'dark';

  return (
    <div className={cn(
      "group relative border-2 border-dashed rounded-xl p-6 cursor-grab w-full h-full flex flex-col min-h-[140px]",
      transitionClasses,
      "transition-colors duration-200",
      isDarkMode ? "bg-violet-600/5 border-slate-800" : "bg-violet-50/30 border-slate-300",
      borderClass,
      data.isHovered && "border-solid border-violet-400 bg-violet-500/20 ring-8 ring-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.4)]",
      data.isDetaching && "border-solid border-red-500 bg-red-500/20 ring-8 ring-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.4)]",
      roleDragClass
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
          badgeColor
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
          inputClassName: isDarkMode ? "text-violet-300 border-violet-500" : "text-violet-700 border-violet-400",
          buttonClassName: isDarkMode ? "text-violet-300" : "text-violet-700"
        })}
      </div>

      <div className={cn("absolute top-3 left-6 text-[9px] font-mono", isDarkMode ? "text-violet-400/60" : "text-violet-600/70")}>
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



      <div className="flex flex-col items-center justify-end flex-1 pb-1 mt-auto pointer-events-auto">
        {data.roles && data.roles.length > 0 && (
          <div className="flex items-center gap-1 mb-1 px-2 py-1 rounded-md bg-indigo-950/40 border border-indigo-500/30 shadow-sm">
            {data.roles.map((role: any) => (
              <span
                key={role.id || role.name}
                className="p-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                title={`Role: ${role.name}`}
              >
                <Shield size={12} />
              </span>
            ))}
          </div>
        )}
        <div className={cn(
          "pointer-events-none text-[9px] uppercase tracking-[0.2em] font-black text-center italic opacity-40",
          colorMode === 'dark' ? "text-slate-700" : "text-slate-400"
        )}>
          Workload Zone
        </div>
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className="!bg-violet-600 !w-2 !h-2 z-[50]" />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="!bg-violet-600 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-violet-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-s" className="!bg-violet-600 !w-2 !h-2" />
    </div>
  );
});
