import  { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Network } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';
import { useFlowStore } from '../../store';

export const ServiceNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);

  return (
    <BaseNode {...props} data={data} title="Service" icon={Network} color="amber" id={props.id} type={props.type}>
      <div className="space-y-1.5 mt-1">
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
      </div>

      {data.displaySettings?.selector !== false && (
        <div className="mt-auto pt-2 border-t border-slate-700/30">
          <span className="text-[8px] uppercase font-bold text-slate-500">Selector</span>
          <div className="text-[9px] font-mono mt-0.5 break-all" style={{ color: 'var(--color-mat-amber)' }}>app: {data.selector || 'app-label'}</div>
        </div>
      )}
    </BaseNode>
  );
});
