import  { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';
import { useFlowStore } from '../../store';

export const PodNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);

  return (
    <BaseNode {...props} data={data} title="Pod" icon={Box} color="cyan" id={props.id} type={props.type}>
      {data.displaySettings?.resources !== false && (!!data.cpuLimit || !!data.memoryLimit) && (
        <div className="space-y-1 mt-1 pt-1 border-t border-slate-700/30">
          {data.cpuLimit && (
            <div className="flex justify-between items-center text-[9px] font-mono">
              <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>cpu:</span>
              <span className="text-cyan-500 font-bold">{data.cpuLimit}</span>
            </div>
          )}
          {data.memoryLimit && (
            <div className="flex justify-between items-center text-[9px] font-mono">
              <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>mem:</span>
              <span className="text-cyan-500 font-bold">{data.memoryLimit}</span>
            </div>
          )}
        </div>
      )}
    </BaseNode>
  );
});
