import { useFlowStore } from '../../store';
import { cn, validateResourceLimits } from '../../lib/utils';
import { Box, Code, Layers, Server, Eye, EyeOff, FileCode, FileX } from 'lucide-react';
import { RUNTIMES, WEBSERVERS } from '../../constants/config';
import { SelectorGroup } from '../UI/SelectorGroup';
import { ConfigSection, AdvancedSection } from '../UI/ConfigUI';
import { ImageDropdown } from '../UI/ImageDropdown';
import { ResourceSettingsList } from './ResourceSettings';
import { FrameworkSelector } from './FrameworkSelector';

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
                onClick={() => toggleVisibility('resources')}
                className={cn(
                  "transition-colors",
                  data.displaySettings?.resources === false ? "text-slate-500 hover:text-blue-400" : "text-blue-500"
                )}
              >
                {data.displaySettings?.resources === false ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
              <button
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

        {/* Container Image */}
        <ConfigSection
          title="Container Image"
          icon={Box}
          isVisible={data.displaySettings?.image}
          onToggle={() => toggleVisibility('image')}
          isYamlEnabled={data.yamlSettings?.image}
          onYamlToggle={() => toggleYaml('image')}
          disableYamlToggle={Boolean(data.image) === false}
        >
          <ImageDropdown
            value={data.image || ''}
            onChange={(val) => performUpdate({ image: val })}
            colorMode={colorMode}
          />
        </ConfigSection>

        {/* Web Server */}
        <ConfigSection
          title="Web Server"
          icon={Server}
          isVisible={data.displaySettings?.webserver}
          onToggle={() => toggleVisibility('webserver')}
          isYamlEnabled={data.yamlSettings?.webserver}
          onYamlToggle={() => toggleYaml('webserver')}
          disableYamlToggle={Boolean(data.webserver) === false || data.webserver === 'none'}
        >
          <SelectorGroup
            options={WEBSERVERS}
            currentValue={data.webserver}
            onSelect={(val) => performUpdate({ webserver: val })}
            colorMode={colorMode}
          />
        </ConfigSection>

        {/* Runtime */}
        <ConfigSection
          title="App Runtime"
          icon={Code}
          isVisible={data.displaySettings?.runtime}
          onToggle={() => toggleVisibility('runtime')}
          isYamlEnabled={data.yamlSettings?.runtime}
          onYamlToggle={() => toggleYaml('runtime')}
          disableYamlToggle={Boolean(data.runtime) === false || data.runtime === 'none'}
        >
          <select
            value={data.runtime || 'none'}
            onChange={(e) => performUpdate({ runtime: e.target.value, framework: '' })}
            className={cn(
              "w-full text-[10px] p-2 rounded border outline-none",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
            )}
          >
            {Object.entries(RUNTIMES).map(([id, rt]) => (
              <option key={id} value={id}>
                {rt.label}
              </option>
            ))}
          </select>
        </ConfigSection>

        <FrameworkSelector
          runtime={data.runtime}
          framework={data.framework}
          colorMode={colorMode}
          performUpdate={performUpdate}
        />
      </div>
    </AdvancedSection>
  );
};
