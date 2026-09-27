import { memo } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { cn } from '@/lib/utils';
import { useResourceLimitNode } from '@/activities/nodes';

export const ResourceLimitNode = memo((props: NodeProps) => {
  const { data, colorMode, hasWorkload, isValidConnection } = useResourceLimitNode(props);

  return (
    <SimpleResourceNode {...props} title="Resource Limit" icon={Layers} color="purple">
      <div className="space-y-1 mt-1 text-[9px] font-mono">
        <div className="flex justify-between items-center">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>CPU Req:</span>
          <span className="text-purple-400 font-bold">{data.cpuRequest || '500m'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>CPU Limit:</span>
          <span className="text-purple-400 font-bold">{data.cpuLimit || '1000m'}</span>
        </div>
        <div className="flex justify-between items-center border-t border-slate-700/30 pt-1">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Mem Req:</span>
          <span className="text-purple-400 font-bold">{data.memoryRequest || '256Mi'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Mem Limit:</span>
          <span className="text-purple-400 font-bold">{data.memoryLimit || '512Mi'}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-s"
        className={cn('!bg-purple-500 !w-2 !h-2', !hasWorkload && 'opacity-20 pointer-events-none')}
        isValidConnection={isValidConnection}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-s"
        className={cn('!bg-purple-500 !w-2 !h-2', !hasWorkload && 'opacity-20 pointer-events-none')}
        isValidConnection={isValidConnection}
      />
    </SimpleResourceNode>
  );
});
