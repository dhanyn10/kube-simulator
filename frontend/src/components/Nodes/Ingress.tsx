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
  const hasMultiplePaths = Array.isArray(data.ingressPaths) && data.ingressPaths.length > 1;

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
                  {p.path}
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
    </SimpleResourceNode>
  );
});
