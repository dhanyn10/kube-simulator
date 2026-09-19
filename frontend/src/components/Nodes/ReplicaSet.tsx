import { memo } from 'react';
import { NodeProps, NodeResizer, Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { useReplicaSetNodeHandler } from '@/activities/nodes';
import { AttachedResourcesFooter } from './AttachedResourcesFooter';
import { ForbiddenOverlay } from './ForbiddenOverlay';

export const ReplicaSetNode = memo(({ selected, data }: NodeProps<Node<K8sNodeData>>) => {
  const { containerClass, badgeClass } = useReplicaSetNodeHandler(selected);

  return (
    <div className={containerClass}>
      <ForbiddenOverlay nodeType="ReplicaSet" data={data} />
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

      <AttachedResourcesFooter data={data} />
    </div>
  );
});
