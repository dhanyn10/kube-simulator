import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Database } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { K8sNodeData } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

export const PVCNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const isBound = data.pvcStatus === 'Bound';

  let accessText = 'RWO';
  if (data.accessMode === 'ReadOnlyMany') {
    accessText = 'ROX';
  } else if (data.accessMode === 'ReadWriteMany') {
    accessText = 'RWX';
  }

  return (
    <SimpleResourceNode {...props} title="PVC" icon={Database} color="orange">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={cn(
          "px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider",
          isBound
            ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
            : "bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse"
        )}>
          {data.pvcStatus || 'Pending'}
        </div>
      </div>
      <div className="space-y-1.5 mt-1">
        <div className="flex justify-between items-center text-[9px] font-mono">
          <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>capacity:</span>
          <span className="text-orange-500 font-bold">{data.storageCapacity || '1Gi'}</span>
        </div>
        <div className="flex justify-between items-center text-[9px] font-mono">
          <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>access:</span>
          <span className="text-orange-500 font-bold" title={data.accessMode || 'ReadWriteOnce'}>
            {accessText}
          </span>
        </div>
      </div>

      {data.displaySettings?.storageClass !== false && data.storageClass && (
        <div className={cn("mt-auto pt-2 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")}>
          <span className={cn("text-[8px] uppercase font-bold", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>Storage Class</span>
          <div className="text-[9px] font-mono mt-0.5 text-orange-500 break-all">{data.storageClass}</div>
        </div>
      )}
    </SimpleResourceNode>
  );
});
