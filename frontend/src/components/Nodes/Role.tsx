import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { ShieldCheck } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';

export const RoleNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const rules = data.rules || [];

  return (
    <BaseNode {...props} data={data} title="Role" icon={ShieldCheck} color="indigo" id={props.id} type={props.type}>
      {data.displaySettings?.rules !== false && rules.length > 0 && (
        <div className="mt-2 pt-1 border-t border-slate-700/30">
          <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter mb-1">
            Rules ({rules.length})
          </div>
          <div className="space-y-1">
            {rules.slice(0, 2).map((rule, idx) => (
              <div key={`rule-${idx}`} className="text-[9px] font-mono bg-indigo-950/40 p-1 rounded border border-indigo-900/40">
                <div className="text-indigo-300 font-semibold truncate">
                  Res: {rule.resources.join(', ')}
                </div>
                <div className="text-indigo-400/80 text-[8px] truncate">
                  Verbs: {rule.verbs.join(', ')}
                </div>
              </div>
            ))}
            {rules.length > 2 && (
              <div className="text-[8px] italic text-slate-500">
                + {rules.length - 2} more rule(s)...
              </div>
            )}
          </div>
        </div>
      )}
    </BaseNode>
  );
});
