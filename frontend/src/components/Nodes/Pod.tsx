import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';
import { PodConfigMapVars } from './PodConfigMapVars';

export const PodNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);

  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  const showRestart = Boolean(data.displaySettings?.restartPolicy !== false);
  const restartPolicy = data.restartPolicy || 'Always';
  const showResources = Boolean(data.displaySettings?.resources !== false && (data.cpuLimit || data.memoryLimit));

  return (
    <BaseNode {...props} data={data} title="Pod" icon={Box} color="cyan" id={props.id} type={props.type}>
      <div className="space-y-1 mt-1">
        {showImage && (
          <div className="flex justify-between items-center text-[9px] font-mono gap-1">
            <span className={colorMode === 'dark' ? "text-slate-500 shrink-0" : "text-slate-400 shrink-0"}>image:</span>
            <span className="font-bold truncate text-right min-w-0" style={{ color: 'var(--color-mat-cyan)' }} title={data.image}>
              {data.image}
            </span>
          </div>
        )}
        {showRestart && (
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>restart:</span>
            <span className="font-bold" style={{ color: 'var(--color-mat-cyan)' }}>{restartPolicy}</span>
          </div>
        )}
        {showResources && (
          <>
            {data.cpuLimit && (
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>cpu:</span>
                <span className="font-bold" style={{ color: 'var(--color-mat-cyan)' }}>{data.cpuLimit}</span>
              </div>
            )}
            {data.memoryLimit && (
              <div className="flex justify-between items-center text-[9px] font-mono">
                <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>mem:</span>
                <span className="font-bold" style={{ color: 'var(--color-mat-cyan)' }}>{data.memoryLimit}</span>
              </div>
            )}
          </>
        )}
        <PodConfigMapVars data={data} nodeId={props.id} />
      </div>
    </BaseNode>
  );
});
