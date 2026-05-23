import  { memo, useCallback } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { Activity } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { ProgressBar } from '../ProgressBar';

export const HPANode = memo((props: NodeProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const hasDeployment = nodes.some((n: any) => n.type === 'Deployment');
  
  // Find connected deployment
  const connectedEdge = edges.find(e => e.source === props.id);
  const targetNode = connectedEdge ? nodes.find(n => n.id === connectedEdge.target) : null;
  const targetDeployment = targetNode?.type === 'Deployment' ? targetNode : null;
  
  const hasRequests = targetDeployment 
    ? (targetDeployment.data as K8sNodeData).cpuRequest && (targetDeployment.data as K8sNodeData).memoryRequest
    : false;

  const showWarning = connectedEdge && !hasRequests;

  const isValidConnection = useCallback((connection: any) => {
    const targetNode = nodes.find((n: any) => n.id === connection.target);
    return targetNode?.type === 'Deployment';
  }, [nodes]);

  return (
    <BaseNode {...props} data={data} title="HPA" icon={Activity} color="fuchsia" id={props.id} type={props.type}>
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
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>min:</span>
            <span className="text-fuchsia-500 font-bold">{data.minReplicas || 1}</span>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className={colorMode === 'dark' ? "text-slate-500" : "text-slate-400"}>max:</span>
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
             <span className={cn("text-[9px] font-mono font-bold", (data.currentCPU || 0) > (data.targetCPU || 50) ? "text-red-500" : "text-emerald-500")}>
               {data.currentCPU || 0}%
             </span>
          </div>
          <ProgressBar
            value={data.currentCPU || 0}
            height="h-1.5"
            color={(data.currentCPU || 0) > (data.targetCPU || 50) ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500"}
            colorMode={colorMode as any}
            barClassName="mb-3"
          />

          <ProgressBar
            label="Target CPU Threshold"
            value={data.targetCPU || 50}
            color="bg-fuchsia-500"
            subLabel={`${data.targetCPU || 50}%`}
            colorMode={colorMode as any}
            className="mt-0.5"
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-s"
        className={cn("!bg-fuchsia-500 !w-2 !h-2", !hasDeployment && "opacity-20 pointer-events-none")}
        isValidConnection={isValidConnection}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-s"
        className={cn("!bg-fuchsia-500 !w-2 !h-2", !hasDeployment && "opacity-20 pointer-events-none")}
        isValidConnection={isValidConnection}
      />
    </BaseNode>
  );
});
