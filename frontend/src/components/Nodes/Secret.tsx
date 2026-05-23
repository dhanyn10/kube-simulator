import  { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';

export const SecretNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;

  return (
    <BaseNode {...props} data={data} title="Secret" icon={Lock} color="indigo" id={props.id} type={props.type}>
      {data.displaySettings?.data !== false && !!data.configData?.length && (
        <div className="mt-2 pt-1 border-t border-slate-700/30">
          <div className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter mb-1">
            Secrets ({data.configData.length})
          </div>
          <div className="space-y-0.5">
            {data.configData.slice(0, 3).map((item) => (
              <div key={item.key} className="text-[9px] font-mono truncate text-slate-400">
                <span className="text-indigo-500/80">{item.key}:</span> ********
              </div>
            ))}
            {data.configData.length > 3 && (
              <div className="text-[8px] italic text-slate-500">
                + {data.configData.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}
    </BaseNode>
  );
});
