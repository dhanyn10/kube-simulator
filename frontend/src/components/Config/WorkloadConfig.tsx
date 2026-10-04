import { useFlowStore } from '@/store';
import { Box, Layers, RotateCcw } from 'lucide-react';
import { ConfigSection, NumberStepper } from '@/components/UI/ConfigUI';
import { ImageDropdown } from '@/components/UI/ImageDropdown';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
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

  const RESTART_POLICIES = [
    { id: 'Always', label: 'Always' },
    { id: 'OnFailure', label: 'On Failure' },
    { id: 'Never', label: 'Never' }
  ] as const;

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
              onChange={(val) => performUpdate({ image: val, status: val ? 'ready' : 'pending' })}
              colorMode={colorMode}
            />
          </ConfigSection>

          {/* Restart Policy */}
          <ConfigSection
            title="Restart Policy"
            icon={RotateCcw}
            isVisible={data.displaySettings?.restartPolicy}
            onToggle={() => toggleVisibility('restartPolicy')}
            isYamlEnabled={data.yamlSettings?.restartPolicy}
            onYamlToggle={() => toggleYaml('restartPolicy')}
            disableYamlToggle={Boolean(data.restartPolicy) === false}
          >
            <SelectorGroup
              options={RESTART_POLICIES}
              currentValue={data.restartPolicy || 'Always'}
              onSelect={(val) => performUpdate({ restartPolicy: val })}
              colorMode={colorMode}
            />
          </ConfigSection>
        </>
      )}
    </div>
  );
};
