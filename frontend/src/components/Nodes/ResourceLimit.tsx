import { memo } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { Layers, AlertTriangle } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { cn, parseCPU, parseMemory } from '@/lib/utils';
import { useResourceLimitNode } from '@/activities/nodes';

export const ResourceLimitNode = memo((props: NodeProps) => {
  const {
    data,
    colorMode,
    hasWorkload,
    isValidConnection,
    isCpuInvalid,
    isMemoryInvalid,
    hasResourceError,
  } = useResourceLimitNode(props);

  const cpuReqVal = parseCPU(data.cpuRequest || '500m');
  const cpuLimVal = parseCPU(data.cpuLimit || '1000m');
  const maxCpu = Math.max(2000, cpuReqVal, cpuLimVal);
  const cpuReqPercent = Math.min(100, (cpuReqVal / maxCpu) * 100);
  const cpuBurstPercent = Math.max(0, Math.min(100, (cpuLimVal / maxCpu) * 100) - cpuReqPercent);

  const memReqVal = parseMemory(data.memoryRequest || '256Mi');
  const memLimVal = parseMemory(data.memoryLimit || '512Mi');
  const maxMem = Math.max(2048, memReqVal, memLimVal);
  const memReqPercent = Math.min(100, (memReqVal / maxMem) * 100);
  const memBurstPercent = Math.max(0, Math.min(100, (memLimVal / maxMem) * 100) - memReqPercent);

  return (
    <SimpleResourceNode {...props} title="Resource Limit" icon={Layers} color="purple">
      {hasResourceError && (
        <div
          data-testid="resource-node-warning"
          className="flex items-center gap-1 text-[8px] text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30 font-medium mb-1"
          title="QoS Error: Resource requests must be <= limits"
        >
          <AlertTriangle size={10} className="shrink-0 text-rose-400" />
          <span>QoS Error: Req &gt; Limit</span>
        </div>
      )}

      <div className="space-y-1 mt-1 text-[9px] font-mono">
        <div className="flex justify-between items-center">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>CPU Req:</span>
          <span className={cn('font-bold', isCpuInvalid ? 'text-rose-400' : 'text-purple-400')}>
            {data.cpuRequest || '500m'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>CPU Limit:</span>
          <span className={cn('font-bold', isCpuInvalid ? 'text-rose-400' : 'text-purple-400')}>
            {data.cpuLimit || '1000m'}
          </span>
        </div>

        {/* Mini CPU Range Indicator */}
        <div
          className={cn(
            'relative h-1 w-full rounded-full overflow-hidden my-0.5',
            colorMode === 'dark' ? 'bg-slate-800' : 'bg-slate-200'
          )}
          title={`CPU Range: ${data.cpuRequest || '500m'} - ${data.cpuLimit || '1000m'}`}
        >
          {isCpuInvalid ? (
            <div className="h-full bg-rose-500 w-full" />
          ) : (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 bg-purple-500"
                style={{ width: `${cpuReqPercent}%` }}
              />
              {cpuBurstPercent > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-purple-400/50"
                  style={{ left: `${cpuReqPercent}%`, width: `${cpuBurstPercent}%` }}
                />
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-slate-700/30 pt-1">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Mem Req:</span>
          <span className={cn('font-bold', isMemoryInvalid ? 'text-rose-400' : 'text-purple-400')}>
            {data.memoryRequest || '256Mi'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Mem Limit:</span>
          <span className={cn('font-bold', isMemoryInvalid ? 'text-rose-400' : 'text-purple-400')}>
            {data.memoryLimit || '512Mi'}
          </span>
        </div>

        {/* Mini Memory Range Indicator */}
        <div
          className={cn(
            'relative h-1 w-full rounded-full overflow-hidden my-0.5',
            colorMode === 'dark' ? 'bg-slate-800' : 'bg-slate-200'
          )}
          title={`Memory Range: ${data.memoryRequest || '256Mi'} - ${data.memoryLimit || '512Mi'}`}
        >
          {isMemoryInvalid ? (
            <div className="h-full bg-rose-500 w-full" />
          ) : (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 bg-purple-500"
                style={{ width: `${memReqPercent}%` }}
              />
              {memBurstPercent > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-purple-400/50"
                  style={{ left: `${memReqPercent}%`, width: `${memBurstPercent}%` }}
                />
              )}
            </>
          )}
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
