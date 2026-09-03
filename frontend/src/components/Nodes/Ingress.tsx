import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { K8sNodeData } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

export const IngressNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);

  return (
    <SimpleResourceNode {...props} title="Ingress" icon={Globe} color="rose">
      {data.displaySettings?.host !== false && (
        <div className={cn("text-[9px] font-mono", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>host: {data.ingressHost || 'example.local'}</div>
      )}

      {data.displaySettings?.path !== false && (
        <div className="mt-auto pt-2 border-t border-slate-700/30">
          <span className="text-[8px] uppercase font-bold text-slate-500">Path</span>
          <div className="text-[9px] font-mono mt-0.5 text-rose-500">{data.ingressPath || '/'}</div>
        </div>
      )}
    </SimpleResourceNode>
  );
});
