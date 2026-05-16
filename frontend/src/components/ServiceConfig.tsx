import React from 'react';
import { useFlowStore } from '../store';
import { Box, Network } from 'lucide-react';
import { ConfigInput, ConfigSection } from './ConfigUI';

interface ServiceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const ServiceConfig = ({ selectedNode, performUpdate, toggleVisibility }: ServiceConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <div className="space-y-4">
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

      <ConfigSection
        title="Target Port"
        icon={Network}
        isVisible={data.displaySettings?.targetPort}
        onToggle={() => toggleVisibility('targetPort')}
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
