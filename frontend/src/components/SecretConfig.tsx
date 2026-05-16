import React from 'react';
import { useFlowStore } from '../store';
import { Lock, Shield } from 'lucide-react';
import { KeyValueConfig } from './KeyValueConfig';

interface SecretConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

export const SecretConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: SecretConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;
  const configData = data.configData || [];

  return (
    <KeyValueConfig
      title="Secrets (Key-Value)"
      titleIcon={<Lock size={10} />}
      valueIcon={<Shield size={10} />}
      configData={configData}
      performUpdate={performUpdate}
      colorMode={colorMode}
      addButtonText="Add Item"
      emptyText="Belum ada data secret"
      accentColor="indigo"
      inputType="password"
      valuePlaceholder="Secret Value"
      isVisible={data.displaySettings?.data}
      onToggle={() => toggleVisibility('data')}
      isYamlEnabled={data.yamlSettings?.data}
      onYamlToggle={() => toggleYaml('data')}
    />
  );
};
