import { memo } from 'react';
import { NodeProps, NodeResizer, Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { useReplicaSetNodeHandler } from '@/activities/nodes';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { AttachedResourcesFooter } from './AttachedResourcesFooter';
import { ForbiddenOverlay } from './ForbiddenOverlay';
import { QuickConnectArrows } from './QuickConnectArrows';
import { NodeHandles } from './NodeHandles';

export const ReplicaSetNode = memo(({ selected, data, id }: NodeProps<Node<K8sNodeData>>) => {
  const { containerClass, badgeClass } = useReplicaSetNodeHandler(selected);
  const isQuickConnectTarget = useFlowStore((state) => state.quickConnectTargetNodeId === id);

  return (
    <div className={cn(
      containerClass,
      isQuickConnectTarget && "ring-4 ring-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.6)] animate-pulse"
    )}>
      <ForbiddenOverlay nodeType="ReplicaSet" data={data} />
      <QuickConnectArrows nodeId={id} color="emerald" />
      <NodeResizer
        minWidth={180}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-emerald-500/40"
        handleClassName="w-2 h-2 bg-white border-2 border-emerald-500 rounded"
      />

      <div className="absolute -top-6 left-2 flex items-center gap-2">
        <span className={badgeClass}>
          ReplicaSet: {data.label}
        </span>
        {data.replicas > 1 && (
          <span className="text-[10px] font-bold text-emerald-500">
            x{data.replicas}
          </span>
        )}
      </div>

      <div className="flex-1" />

      <AttachedResourcesFooter data={data} nodeId={id} />
      <NodeHandles color="emerald" />
    </div>
  );
});
