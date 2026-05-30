
import { useFlowStore } from '../../store';
import { Globe, Code } from 'lucide-react';
import { ConfigInput, ConfigSection, AdvancedSection } from '../UI/ConfigUI';

interface IngressConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Configuration component for Kubernetes Ingress resources.
 *
 * @param props - Component properties for handling updates and UI toggles.
 */
export const IngressConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: IngressConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <div className="space-y-4">
      <ConfigSection
        title="Host"
        icon={Globe}
        isVisible={data.displaySettings?.host}
        onToggle={() => toggleVisibility('host')}
      >
        <ConfigInput
          value={data.ingressHost || ''}
          onChange={(e: any) => performUpdate({ ingressHost: e.target.value })}
          placeholder="example.com"
          colorMode={colorMode}
        />
      </ConfigSection>

      <AdvancedSection colorMode={colorMode}>
        <ConfigSection
          title="Path"
          icon={Code}
          isVisible={data.displaySettings?.path}
          onToggle={() => toggleVisibility('path')}
          isYamlEnabled={data.yamlSettings?.path}
          onYamlToggle={() => toggleYaml('path')}
          disableYamlToggle={!data.ingressPath}
        >
          <ConfigInput
            value={data.ingressPath || ''}
            onChange={(e: any) => performUpdate({ ingressPath: e.target.value })}
            placeholder="/"
            colorMode={colorMode}
          />
        </ConfigSection>
      </AdvancedSection>
    </div>
  );
};
