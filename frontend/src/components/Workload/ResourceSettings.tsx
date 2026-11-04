import { Layers } from 'lucide-react';
import { cn, parseCPU, parseMemory, getPodQoSClass } from '@/lib/utils';
import { ConfigLabel } from '@/components/UI/ConfigUI';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { getResourceSettingItems } from '@/activities/workload';

interface ResourceSettingsProps {
  data: any;
  colorMode: string;
  performUpdate: (updates: any) => void;
}

/**
 * Component for managing Kubernetes resource requests and limits.
 */
export const ResourceSettingsList = ({
  data,
  colorMode,
  performUpdate
}: ResourceSettingsProps) => {
  const items = getResourceSettingItems();
  const qosClass = getPodQoSClass(data);
  const qosBadgeStyles = {
    Guaranteed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Burstable: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    BestEffort: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  }[qosClass];

  const handleSelect = (field: string, val: string) => {
    if (field === 'cpuLimit') {
      if (data.cpuRequest && parseCPU(val) < parseCPU(data.cpuRequest)) {
        performUpdate({ cpuLimit: val, cpuRequest: val });
        return;
      }
    } else if (field === 'memoryLimit') {
      if (data.memoryRequest && parseMemory(val) < parseMemory(data.memoryRequest)) {
        performUpdate({ memoryLimit: val, memoryRequest: val });
        return;
      }
    }
    performUpdate({ [field]: val });
  };

  const getDisabledOption = (field: string) => {
    if (field === 'cpuRequest') {
      return (val: string) => Boolean(data.cpuLimit) && parseCPU(val) > parseCPU(data.cpuLimit);
    }
    if (field === 'memoryRequest') {
      return (val: string) => Boolean(data.memoryLimit) && parseMemory(val) > parseMemory(data.memoryLimit);
    }
    return undefined;
  };

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/40 border border-slate-700/40 mb-2.5 text-xs">
        <span className="text-slate-400 font-medium">QoS Class:</span>
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border',
            qosBadgeStyles
          )}
          title={`Kubernetes QoS Class: ${qosClass}`}
        >
          {qosClass}
        </span>
      </div>
      {items.map((item: any) => {
        if (item.type === 'separator') {
          return <div key={item.field} className="h-px bg-slate-700/30 my-2" />;
        }

        const disabledFn = getDisabledOption(item.field);

        return (
          <div key={item.field} className={cn("space-y-1.5", item.field.includes('Limit') && "opacity-90")}>
            <div className="flex items-center justify-between">
              <ConfigLabel>
                <Layers size={10} className={item.iconColor} /> {item.label}
              </ConfigLabel>
            </div>
            <SelectorGroup
              options={item.options}
              currentValue={data[item.field]}
              onSelect={(val) => handleSelect(item.field, val)}
              colorMode={colorMode}
              activeColorClass={item.activeColor}
              activeShadowClass={item.shadow}
              disabledOption={disabledFn}
            />
          </div>
        );
      })}
    </>
  );
};
