import  { memo } from 'react';
import { NodeProps, NodeResizer, Node } from '@xyflow/react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { K8sNodeData } from '../../types';

export const ReplicaSetNode = memo(({ selected, data }: NodeProps<Node<K8sNodeData>>) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  
  return (
    <div className={cn(
      "w-full h-full rounded-xl border-2 border-dashed transition-all duration-300",
      colorMode === 'dark' 
        ? "bg-emerald-500/5 border-emerald-500/20" 
        : "bg-emerald-500/[0.02] border-emerald-500/10",
      selected && (colorMode === 'dark' ? "border-emerald-400/60 bg-emerald-500/10" : "border-emerald-500/40 bg-emerald-500/[0.05]")
    )}>
      <NodeResizer 
        minWidth={180} 
        minHeight={100} 
        isVisible={selected} 
        lineClassName="border-emerald-500/40"
        handleClassName="w-2 h-2 bg-white border-2 border-emerald-500 rounded"
      />
      
      <div className="absolute -top-6 left-2 flex items-center gap-2">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
          colorMode === 'dark' 
            ? "bg-slate-900/80 text-emerald-400 border-emerald-500/30" 
            : "bg-white/80 text-emerald-600 border-emerald-500/20"
        )}>
          ReplicaSet: {data.label}
        </span>
        {data.replicas > 1 && (
          <span className="text-[10px] font-bold text-emerald-500">
            x{data.replicas}
          </span>
        )}
      </div>
    </div>
  );
});
