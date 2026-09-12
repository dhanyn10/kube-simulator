import { Layers, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdvancedSection } from '@/components/UI/ConfigUI';
import { ResourceSettingsList } from './ResourceSettings';
import { useWorkloadAdvancedConfig } from '@/activities/workload';

export { getYamlButtonProps } from '@/activities/workload';

interface WorkloadAdvancedConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

export const WorkloadAdvancedConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml,
}: WorkloadAdvancedConfigProps) => {
  const {
    colorMode,
    data,
    isTargetedByHPA,
    hasRequests,
    isCpuError,
    isMemError,
    hasResources,
    yamlProps,
  } = useWorkloadAdvancedConfig(selectedNode);

  return (
    <AdvancedSection colorMode={colorMode}>
      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border border-dashed p-3 border-slate-700/50 bg-slate-500/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Layers size={10} /> Resource Settings
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleVisibility('resources')}
                className={cn(
                  "transition-colors",
                  data.displaySettings?.resources === false ? "text-slate-500 hover:text-blue-400" : "text-blue-500"
                )}
              >
                {data.displaySettings?.resources === false ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
              <button
                type="button"
                onClick={() => toggleYaml('resources')}
                disabled={!hasResources}
                className={cn("transition-colors", yamlProps.className)}
                title={!hasResources ? "No YAML configuration available for empty resources" : "Include in YAML"}
              >
                {yamlProps.icon}
              </button>
            </div>
          </div>

          {isTargetedByHPA && !hasRequests && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] text-amber-500 leading-tight mb-2">
              ⚠️ HPA detected. CPU/Memory <strong>Requests</strong> are required for autoscaling to function.
            </div>
          )}

          <ResourceSettingsList
            data={data}
            colorMode={colorMode}
            isCpuError={isCpuError}
            isMemError={isMemError}
            performUpdate={performUpdate}
          />
        </div>
      </div>
    </AdvancedSection>
  );
};
