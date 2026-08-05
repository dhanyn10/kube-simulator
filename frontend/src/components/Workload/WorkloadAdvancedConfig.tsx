import { useFlowStore } from '../../store';
import { validateResourceLimits, cn } from '../../lib/utils';
import { Layers, Eye, EyeOff, FileCode, FileX } from 'lucide-react';
import { AdvancedSection } from '../UI/ConfigUI';
import { ResourceSettingsList } from './ResourceSettings';

interface WorkloadAdvancedConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Advanced configuration section for Pods and Deployments,
 * including resources, images, and runtimes.
 */
export const WorkloadAdvancedConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml,
}: WorkloadAdvancedConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const data = selectedNode.data;
  const isTargetedByHPA = edges.some(
    (e) => e.target === selectedNode.id && nodes.find((n) => n.id === e.source)?.type === 'HPA'
  );
  const hasRequests = data.cpuRequest && data.memoryRequest;
  const { isCpuError, isMemError } = validateResourceLimits(data);
  const hasResources = !!(data.cpuRequest || data.memoryRequest || data.cpuLimit || data.memoryLimit);
  const isYamlResources = (data.yamlSettings?.resources ?? true) && hasResources;

  let yamlButtonClass = "text-slate-500 hover:text-emerald-400";
  if (hasResources) {
    if (isYamlResources) {
      yamlButtonClass = "text-emerald-500";
    }
  } else {
    yamlButtonClass = "text-slate-600/40 cursor-not-allowed pointer-events-none";
  }

  let yamlButtonIcon = <FileX size={10} />;
  if (hasResources && isYamlResources) {
    yamlButtonIcon = <FileCode size={10} />;
  }

  return (
    <AdvancedSection colorMode={colorMode}>
      <div className="space-y-4">
        {/* Resource Requests & Limits */}
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
                disabled={hasResources === false}
                className={cn("transition-colors", yamlButtonClass)}
                title={hasResources === false ? "No YAML configuration available for empty resources" : "Include in YAML"}
              >
                {yamlButtonIcon}
              </button>
            </div>
          </div>

          {isTargetedByHPA && hasRequests === false && (
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
