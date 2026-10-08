import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Network } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

export const ServiceNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);

  const serviceType = data.serviceType || 'ClusterIP';
  const showNodePort = (serviceType === 'NodePort' || serviceType === 'LoadBalancer') && Boolean(data.nodePort);

  // Check if current selector matches an active workload or Ingress on canvas
  const isSelectorValid = Boolean(
    data.selector &&
    nodes.some((n) => {
      if (serviceType === 'LoadBalancer' && n.type === 'Ingress') {
        const label = (n.data?.label as string) || n.id;
        return label === data.selector;
      }
      if (n.type === 'Deployment' || n.type === 'ReplicaSet') {
        const label = (n.data?.label as string) || (n.data?.baseName as string) || n.id;
        return label === data.selector;
      }
      if (n.type === 'Pod' && !n.parentId && !n.data?.parentId) {
        const label = (n.data?.label as string) || (n.data?.baseName as string) || n.id;
        return label === data.selector;
      }
      return false;
    })
  );

  return (
    <BaseNode {...props} data={data} title="Service" icon={Network} color="amber" id={props.id} type={props.type}>
      <div className="space-y-1.5 mt-1">
        {data.displaySettings?.serviceType !== false && (
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>type:</span>
            <span className="font-bold" style={{ color: 'var(--color-mat-amber)' }}>{serviceType}</span>
          </div>
        )}
        {data.displaySettings?.port !== false && (
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>port:</span>
            <span className="font-bold" style={{ color: 'var(--color-mat-amber)' }}>{data.port || 80}</span>
          </div>
        )}
        {data.displaySettings?.targetPort !== false && (
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>targetPort:</span>
            <span className="font-bold" style={{ color: 'var(--color-mat-amber)' }}>{data.targetPort || 80}</span>
          </div>
        )}
        {showNodePort && data.displaySettings?.nodePort !== false && (
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>nodePort:</span>
            <span className="font-bold" style={{ color: 'var(--color-mat-amber)' }}>{data.nodePort}</span>
          </div>
        )}
      </div>

      {data.displaySettings?.selector !== false && (
        <div className="mt-auto pt-2 border-t border-slate-700/30">
          <span className="text-[8px] uppercase font-bold text-slate-500">Selector</span>
          <div
            className={cn(
              "text-[9px] font-mono mt-0.5 break-all font-bold",
              isSelectorValid ? "" : "text-rose-400"
            )}
            style={isSelectorValid ? { color: 'var(--color-mat-amber)' } : undefined}
          >
            app: {isSelectorValid ? data.selector : '---'}
          </div>
        </div>
      )}
    </BaseNode>
  );
});
