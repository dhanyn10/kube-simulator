import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

const resolveIngressBackendDisplay = (
  data: K8sNodeData,
  clusterIpServices: any[]
): { backendDisplay: string; isBackendValid: boolean } => {
  const hasMultiplePaths = Array.isArray(data.ingressPaths) && data.ingressPaths.length > 1;

  if (hasMultiplePaths) {
    const validNames = Array.from(
      new Set(
        data.ingressPaths!
          .map((p) => {
            const matched = clusterIpServices.find(
              (s) => s.data?.label === p.serviceName || s.id === p.serviceName
            );
            return matched ? (matched.data?.label as string) : '';
          })
          .filter(Boolean)
      )
    );
    const isBackendValid = validNames.length > 0;
    return {
      backendDisplay: isBackendValid ? validNames.join(', ') : '---',
      isBackendValid,
    };
  }

  const targetService = clusterIpServices.find(
    (s) => s.data?.label === data.backendServiceName || s.id === data.backendServiceName
  );
  const backendName = targetService ? (targetService.data.label as string) : (data.backendServiceName || '');
  const isBackendValid = Boolean(backendName && clusterIpServices.some((s) => s.data?.label === backendName));

  return {
    backendDisplay: isBackendValid ? backendName : '---',
    isBackendValid,
  };
};

export const IngressNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);

  // Filter for ClusterIP services on the canvas
  const clusterIpServices = nodes.filter(
    (n) => n.type === 'Service' && (n.data?.serviceType || 'ClusterIP') === 'ClusterIP'
  );

  const hasMultiplePaths = Array.isArray(data.ingressPaths) && data.ingressPaths.length > 1;
  const { backendDisplay, isBackendValid } = resolveIngressBackendDisplay(data, clusterIpServices);

  return (
    <SimpleResourceNode {...props} title="Ingress" icon={Globe} color="rose">
      {data.displaySettings?.host !== false && (
        <div className={cn("text-[9px] font-mono", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
          host: {data.ingressHost || 'example.local'}
        </div>
      )}

      {data.displaySettings?.ingressClassName !== false && (
        <div className={cn("text-[9px] font-mono", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
          class: <span className="font-semibold text-rose-400">{data.ingressClassName || 'nginx'}</span>
        </div>
      )}

      {data.displaySettings?.path !== false && (
        <div className="mt-1">
          <span className="text-[8px] uppercase font-bold text-slate-500">
            {hasMultiplePaths ? `Paths (${data.ingressPaths!.length})` : 'Path'}
          </span>
          {hasMultiplePaths ? (
            <div className="mt-0.5 space-y-0.5">
              {data.ingressPaths!.map((p: any) => (
                <div
                  key={`ingress-node-path-${p.id || p.path}`}
                  className="text-[9px] font-mono text-rose-500 block truncate"
                >
                  {p.path}{p.serviceName ? ` → ${p.serviceName}` : ''}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] font-mono mt-0.5 text-rose-500 block">
              {data.ingressPath || '/'}
            </div>
          )}
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
            {backendDisplay}
          </div>
        </div>
      )}
    </SimpleResourceNode>
  );
});
