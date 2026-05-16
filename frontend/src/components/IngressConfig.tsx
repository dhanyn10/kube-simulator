import React from 'react';
import { useFlowStore } from '../store';
import { Globe, Code } from 'lucide-react';
import { ConfigInput, ConfigSection } from './ConfigUI';

interface IngressConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const IngressConfig = ({ selectedNode, performUpdate, toggleVisibility }: IngressConfigProps) => {
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

      <ConfigSection
        title="Path"
        icon={Code}
        isVisible={data.displaySettings?.path}
        onToggle={() => toggleVisibility('path')}
      >
        <ConfigInput
          value={data.ingressPath || ''}
          onChange={(e: any) => performUpdate({ ingressPath: e.target.value })}
          placeholder="/"
          colorMode={colorMode}
        />
      </ConfigSection>
    </div>
  );
};
