import  { memo } from 'react';
import { NodeProps, NodeResizer, Node } from '@xyflow/react';
import { Shield, Settings, Lock, Activity } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { K8sNodeData } from '../../types';

export const ReplicaSetNode = memo(({ selected, data }: NodeProps<Node<K8sNodeData>>) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  
  return (
    <div className={cn(
      "w-full h-full rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col justify-between p-2 min-h-[100px]",
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

      <div className="flex-1" />

      {((data.roles && data.roles.length > 0) || (data.configMaps && data.configMaps.length > 0) || (data.secrets && data.secrets.length > 0) || (data.hpas && data.hpas.length > 0)) && (
        <div className="mt-auto pt-1.5 pb-0.5 border-t border-slate-500/20 flex items-center justify-center gap-1 z-20 pointer-events-auto">
          {data.roles?.map((role: any) => {
            const usersText = role.assignedUsers && role.assignedUsers.length > 0
              ? ` (Users: ${role.assignedUsers.join(', ')})`
              : '';
            return (
              <span
                key={role.id || role.name}
                className="p-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer shadow-sm"
                title={`Role: ${role.name}${usersText}`}
              >
                <Shield size={11} />
              </span>
            );
          })}
          {data.configMaps?.map((cm: any) => (
            <span
              key={cm.id || cm.name}
              className="p-1 rounded-full bg-teal-600 text-white hover:bg-teal-500 transition-colors cursor-pointer shadow-sm"
              title={`ConfigMap: ${cm.name}`}
            >
              <Settings size={11} />
            </span>
          ))}
          {data.secrets?.map((sec: any) => (
            <span
              key={sec.id || sec.name}
              className="p-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer shadow-sm"
              title={`Secret: ${sec.name}`}
            >
              <Lock size={11} />
            </span>
          ))}
          {data.hpas?.map((hpa: any) => (
            <span
              key={hpa.id || hpa.name}
              className="p-1 rounded-full bg-fuchsia-600 text-white hover:bg-fuchsia-500 transition-colors cursor-pointer shadow-sm"
              title={`HPA: ${hpa.name}`}
            >
              <Activity size={11} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
