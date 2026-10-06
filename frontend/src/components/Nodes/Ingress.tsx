import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

export const IngressNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);

  // Filter for ClusterIP services on the canvas
  const clusterIpServices = nodes.filter(
    (n) => n.type === 'Service' && (n.data?.serviceType || 'ClusterIP') === 'ClusterIP'
  );

  const targetService = clusterIpServices.find(
    (s) => s.data?.label === data.backendServiceName || s.id === data.backendServiceName
  );

  const backendName = targetService ? targetService.data.label : (data.backendServiceName || '');
  const isBackendValid = Boolean(backendName && clusterIpServices.some((s) => s.data?.label === backendName));

  return (
    <SimpleResourceNode {...props} title="Ingress" icon={Globe} color="rose">
      {data.displaySettings?.host !== false && (
        <div className={cn("text-[9px] font-mono", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
          host: {data.ingressHost || 'example.local'}
        </div>
      )}

      {data.displaySettings?.path !== false && (
        <div className="mt-1">
          <span className="text-[8px] uppercase font-bold text-slate-500">Path</span>
          <div className="text-[9px] font-mono mt-0.5 text-rose-500">{data.ingressPath || '/'}</div>
        </div>
      )}

      {data.displaySettings?.backendService !== false && (
        <div className="mt-auto pt-2 border-t border-slate-700/30">
          <span className="text-[8px] uppercase font-bold text-slate-500">Backend Service</span>
          <div
            className={cn(
              "text-[9px] font-mono mt-0.5 break-all font-bold",
              isBackendValid ? "text-rose-500" : "text-rose-400"
            )}
          >
            {isBackendValid ? backendName : '---'}
          </div>
        </div>
      )}
    </SimpleResourceNode>
  );
});
