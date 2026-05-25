import { useFlowStore } from '../store';
import { Network, Box } from 'lucide-react';
import { ConfigInput, ConfigSection, AdvancedSection } from './ConfigUI';

interface ServiceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Configuration component for Kubernetes Service resources.
 *
 * @param props - Component properties including update and toggle handlers.
 */
export const ServiceConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml
}: ServiceConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <div className="space-y-4">
      {/* Primary Port Configuration */}
      <ConfigSection
        title="Port"
        icon={Network}
        isVisible={data.displaySettings?.port}
        onToggle={() => toggleVisibility('port')}
      >
        <ConfigInput
          type="number"
          value={data.port || 80}
          onChange={(e: any) => performUpdate({ port: Number.parseInt(e.target.value, 10) || 80 })}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Advanced Service Settings */}
      <AdvancedSection colorMode={colorMode}>
        <ConfigSection
          title="Target Port"
          icon={Network}
          isVisible={data.displaySettings?.targetPort}
          onToggle={() => toggleVisibility('targetPort')}
          isYamlEnabled={data.yamlSettings?.targetPort}
          onYamlToggle={() => toggleYaml('targetPort')}
          disableYamlToggle={Boolean(data.targetPort) === false}
        >
          <ConfigInput
            type="number"
            value={data.targetPort || 80}
            onChange={(e: any) => performUpdate({ targetPort: Number.parseInt(e.target.value, 10) || 80 })}
            colorMode={colorMode}
          />
        </ConfigSection>

        <ConfigSection
          title="Selector (app)"
          icon={Box}
          isVisible={data.displaySettings?.selector}
          onToggle={() => toggleVisibility('selector')}
          isYamlEnabled={data.yamlSettings?.selector}
          onYamlToggle={() => toggleYaml('selector')}
          disableYamlToggle={Boolean(data.selector) === false}
        >
          <ConfigInput
            value={data.selector || ''}
            onChange={(e: any) => performUpdate({ selector: e.target.value })}
            placeholder="app-label"
            colorMode={colorMode}
          />
        </ConfigSection>
      </AdvancedSection>
    </div>
  );
};
