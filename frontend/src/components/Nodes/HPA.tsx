import { memo, useCallback } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { Activity } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { K8sNodeData } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { ProgressBar } from '../Monitoring/ProgressBar';

export const HPANode = memo((props: NodeProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const hasDeployment = nodes.some((n: any) => n.type === 'Deployment');

  const connectedEdge = edges.find((e) => e.source === props.id);
  const targetNode = connectedEdge ? nodes.find((n) => n.id === connectedEdge.target) : null;
  const targetDeployment = targetNode?.type === 'Deployment' ? targetNode : null;

  const targetData = targetDeployment?.data as K8sNodeData | undefined;
  const hasRequests = Boolean(targetData?.cpuRequest && targetData?.memoryRequest);
  const showWarning = Boolean(connectedEdge && !hasRequests);

  const isValidConnection = useCallback(
    (connection: any) => {
      const target = nodes.find((n: any) => n.id === connection.target);
      return target?.type === 'Deployment';
    },
    [nodes]
  );

  const currentCPU = data.currentCPU || 0;
  const targetCPU = data.targetCPU || 50;
  const isOverThreshold = currentCPU > targetCPU;
  const loadColor = isOverThreshold ? 'text-red-500' : 'text-emerald-500';
  const barColor = isOverThreshold
    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
    : 'bg-emerald-500';

  return (
    <SimpleResourceNode {...props} title="HPA" icon={Activity} color="fuchsia">
      {showWarning && (
        <div className="absolute -top-10 left-0 right-0 animate-bounce flex justify-center z-[100]">
          <div className="bg-amber-500 text-white text-[8px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1 whitespace-nowrap">
            <span className="text-xs">⚠️</span> Missing Resource Requests on Target
          </div>
        </div>
      )}

      {data.displaySettings?.replicas !== false && (
        <div className="space-y-1 mt-1">
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>min:</span>
            <span className="text-fuchsia-500 font-bold">{data.minReplicas || 1}</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? 'text-slate-500' : 'text-slate-400'}>max:</span>
            <span className="text-fuchsia-500 font-bold">{data.maxReplicas || 10}</span>
          </div>
        </div>
      )}

      {data.displaySettings?.targetMemory !== false && (
        <ProgressBar
          label="Target Mem"
          value={data.targetMemory || 50}
          color="bg-purple-500"
          subLabel={`${data.targetMemory || 50}%`}
          colorMode={colorMode as any}
          className="mt-1 pt-1"
        />
      )}

      {data.displaySettings?.targetCPU !== false && (
        <div className="mt-auto pt-2 border-t border-slate-700/30">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] uppercase font-bold text-slate-500">Current Load</span>
            <span className={cn('text-[9px] font-mono font-bold', loadColor)}>{currentCPU}%</span>
          </div>
          <ProgressBar
            value={currentCPU}
            height="h-1.5"
            color={barColor}
            colorMode={colorMode as any}
            barClassName="mb-3"
          />

          <ProgressBar
            label="Target CPU Threshold"
            value={targetCPU}
            color="bg-fuchsia-500"
            subLabel={`${targetCPU}%`}
            colorMode={colorMode as any}
            className="mt-0.5"
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-s"
        className={cn('!bg-fuchsia-500 !w-2 !h-2', !hasDeployment && 'opacity-20 pointer-events-none')}
        isValidConnection={isValidConnection}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-s"
        className={cn('!bg-fuchsia-500 !w-2 !h-2', !hasDeployment && 'opacity-20 pointer-events-none')}
        isValidConnection={isValidConnection}
      />
    </SimpleResourceNode>
  );
});
