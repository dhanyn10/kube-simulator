import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { SimpleResourceNode } from './SimpleResourceNode';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

export const SecretNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  const colorMode = useFlowStore((state) => state.colorMode);
  const secretItems = ((data as any).secretData && (data as any).secretData.length > 0)
    ? (data as any).secretData
    : (data.configData || []);

  return (
    <SimpleResourceNode {...props} title="Secret" icon={Lock} color="rose">
      {data.displaySettings?.data !== false && secretItems.length > 0 && (
        <div className={cn("mt-2 pt-1 border-t", colorMode === 'dark' ? "border-slate-700/40" : "border-slate-200")}>
          <div className={cn("text-[8px] font-bold uppercase tracking-tighter mb-1", colorMode === 'dark' ? "text-rose-400" : "text-rose-600")}>
            Secrets ({secretItems.length})
          </div>
          <div className="space-y-0.5">
            {secretItems.slice(0, 3).map((item: { key: string; value: string }) => (
              <div
                key={`secret-item-${item.key}`}
                className={cn("text-[9px] font-mono truncate", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}
              >
                <span className={cn(colorMode === 'dark' ? "text-rose-400/90" : "text-rose-600/90")}>{item.key}:</span> {item.value}
              </div>
            ))}
            {secretItems.length > 3 && (
              <div className={cn("text-[8px] italic", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
                + {secretItems.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}
    </SimpleResourceNode>
  );
});
