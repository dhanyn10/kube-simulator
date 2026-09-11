import { useFlowStore } from '@/store';
import { Box, Code, Layers, Server } from 'lucide-react';
import { ConfigSection, NumberStepper } from '../UI/ConfigUI';
import { WorkloadAdvancedConfig } from '../Workload/WorkloadAdvancedConfig';
import { ImageDropdown } from '../UI/ImageDropdown';
import { SelectorGroup } from '../UI/SelectorGroup';
import { RUNTIMES, WEBSERVERS } from '@/constants/config';
import { cn } from '@/lib/utils';
import { FrameworkSelector } from '../Workload/FrameworkSelector';
import { useWorkloadConfigHandler } from '@/activities/config';

interface WorkloadConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Main configuration component for Workload resources (Pods and Deployments).
 *
 * @param props - Component properties
 */
export const WorkloadConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml
}: WorkloadConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const { replicaValue, updateReplicas } = useWorkloadConfigHandler(selectedNode);

  const data = selectedNode.data;

  return (
    <div className="space-y-4">
      {/* Replicas Configuration */}
      <ConfigSection title="Replicas" icon={Layers}>
        <NumberStepper
          value={replicaValue}
          onChange={updateReplicas}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Pod Specific Main Settings */}
      {selectedNode.type === 'Pod' && (
        <>
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

          {/* Advanced Settings for Pods (Resources) */}
          <WorkloadAdvancedConfig
            selectedNode={selectedNode}
            performUpdate={performUpdate}
            toggleVisibility={toggleVisibility}
            toggleYaml={toggleYaml}
          />
        </>
      )}
    </div>
  );
};
