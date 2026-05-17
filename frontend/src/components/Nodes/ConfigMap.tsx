import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';

export const ConfigMapNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;

  return (
    <BaseNode {...props} data={data} title="ConfigMap" icon={Settings} color="teal" id={props.id} type={props.type}>
      {data.displaySettings?.data !== false && !!data.configData?.length && (
        <div className="mt-2 pt-1 border-t border-slate-700/30">
          <div className="text-[8px] font-bold text-teal-500 uppercase tracking-tighter mb-1">
            Data ({data.configData.length})
          </div>
          <div className="space-y-0.5">
            {data.configData.slice(0, 3).map((item, idx) => (
              <div key={item.key} className="text-[9px] font-mono truncate text-slate-400">
                <span className="text-teal-500/80">{item.key}:</span> {item.value}
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
