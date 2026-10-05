import { useFlowStore } from '@/store';
import { Network, Box, Server } from 'lucide-react';
import { ConfigInput, ConfigSection } from '@/components/UI/ConfigUI';
import { cn } from '@/lib/utils';

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
  const currentServiceType = data.serviceType || 'ClusterIP';
  const showNodePort = currentServiceType === 'NodePort' || currentServiceType === 'LoadBalancer';

  return (
    <div className="space-y-4">
      {/* Service Type Selection */}
      <ConfigSection
        title="Service Type"
        icon={Server}
        isVisible={data.displaySettings?.serviceType}
        onToggle={() => toggleVisibility('serviceType')}
        isYamlEnabled={data.yamlSettings?.serviceType}
        onYamlToggle={() => toggleYaml('serviceType')}
      >
        <select
          value={currentServiceType}
          onChange={(e: any) => performUpdate({ serviceType: e.target.value })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none font-mono",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        >
          <option value="ClusterIP">ClusterIP</option>
          <option value="NodePort">NodePort</option>
          <option value="LoadBalancer">LoadBalancer</option>
        </select>
      </ConfigSection>

      {/* NodePort Configuration (Only for NodePort or LoadBalancer) */}
      {showNodePort && (
        <ConfigSection
          title="NodePort"
          icon={Network}
          isVisible={data.displaySettings?.nodePort}
          onToggle={() => toggleVisibility('nodePort')}
          isYamlEnabled={data.yamlSettings?.nodePort}
          onYamlToggle={() => toggleYaml('nodePort')}
          disableYamlToggle={Boolean(data.nodePort) === false}
        >
          <ConfigInput
            type="number"
            min={30000}
            max={32767}
            value={data.nodePort ?? ''}
            onChange={(e: any) => performUpdate({ nodePort: e.target.value ? Number.parseInt(e.target.value, 10) : undefined })}
            placeholder="30000-32767 (Optional)"
            colorMode={colorMode}
          />
        </ConfigSection>
      )}

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

      {/* Target Port Configuration */}
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

      {/* Selector Configuration */}
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
    </div>
  );
};
