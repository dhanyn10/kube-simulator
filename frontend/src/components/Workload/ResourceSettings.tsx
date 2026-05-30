import { Layers, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CPU_OPTIONS, MEMORY_OPTIONS } from '../../constants/config';
import { ConfigLabel } from '../UI/ConfigUI';
import { SelectorGroup } from '../UI/SelectorGroup';

interface ResourceSettingsProps {
  data: any;
  colorMode: string;
  isCpuError: boolean;
  isMemError: boolean;
  performUpdate: (updates: any) => void;
}

/**
 * Component for managing Kubernetes resource requests and limits.
 */
export const ResourceSettingsList = ({
  data,
  colorMode,
  isCpuError,
  isMemError,
  performUpdate
}: ResourceSettingsProps) => {
  const items = [
    {
      field: 'cpuRequest',
      label: 'CPU Request',
      options: CPU_OPTIONS,
      iconColor: 'text-emerald-500',
      activeColor: isCpuError ? 'bg-red-600 border-red-600' : 'bg-emerald-600 border-emerald-600',
      shadow: isCpuError ? 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'shadow-[0_0_8px_rgba(16,185,129,0.4)]',
      hasError: isCpuError,
    },
    {
      field: 'cpuLimit',
      label: 'CPU Limit',
      options: CPU_OPTIONS,
      iconColor: 'text-violet-500',
      activeColor: 'bg-violet-600 border-violet-600',
    },
    { type: 'separator', field: 'separator-cpu-mem' },
    {
      field: 'memoryRequest',
      label: 'Memory Request',
      options: MEMORY_OPTIONS,
      iconColor: 'text-emerald-500',
      activeColor: isMemError ? 'bg-red-600 border-red-600' : 'bg-emerald-600 border-emerald-600',
      shadow: isMemError ? 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'shadow-[0_0_8px_rgba(16,185,129,0.4)]',
      hasError: isMemError,
    },
    {
      field: 'memoryLimit',
      label: 'Memory Limit',
      options: MEMORY_OPTIONS,
      iconColor: 'text-violet-500',
      activeColor: 'bg-violet-600 border-violet-600',
    }
  ];

  return (
    <>
      {items.map((item: any) => {
        if (item.type === 'separator') {
          return <div key={item.field} className="h-px bg-slate-700/30 my-2" />;
        }
        return (
          <div key={item.field} className={cn("space-y-1.5", item.field.includes('Limit') && "opacity-80")}>
            <div className="flex items-center justify-between">
              <ConfigLabel>
                <Layers size={10} className={item.iconColor} /> {item.label}
              </ConfigLabel>
              {item.hasError && (
                <div className="group relative flex items-center">
                  <AlertCircle size={12} className="text-red-500 cursor-help workload-resource-warning" />
                  <div className={cn(
                    "absolute right-full mr-2 px-2 py-1 rounded text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50",
                    colorMode === 'dark' ? "bg-red-950 text-red-200 border border-red-900" : "bg-red-100 text-red-800 border border-red-200"
                  )}>
                    Limit must be greater than or equal to Request
                  </div>
                </div>
              )}
            </div>
            <SelectorGroup
              options={item.options}
              currentValue={data[item.field]}
              onSelect={(val) => performUpdate({ [item.field]: val })}
              colorMode={colorMode}
              activeColorClass={item.activeColor}
              activeShadowClass={item.shadow}
            />
          </div>
        );
      })}
    </>
  );
};
