import { Layers, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfigLabel } from '@/components/UI/ConfigUI';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { getResourceSettingItems } from '@/activity/workload';

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
  const items = getResourceSettingItems(isCpuError, isMemError);

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
