import { useFlowStore } from '../store';
import { Settings, Type, Lock, Shield } from 'lucide-react';
import { KeyValueConfig } from './KeyValueConfig';

interface ResourceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Consolidated component for configuring data-centric resources like ConfigMaps and Secrets.
 */
export const ResourceConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: ResourceConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;
  const configData = data.configData || [];
  const isSecret = selectedNode.type === 'Secret';

  return (
    <KeyValueConfig
      title={isSecret ? "Secrets (Key-Value)" : "Data (Key-Value)"}
      titleIcon={isSecret ? <Lock size={10} /> : <Settings size={10} />}
      valueIcon={isSecret ? <Shield size={10} /> : <Type size={10} />}
      configData={configData}
      performUpdate={performUpdate}
      colorMode={colorMode}
      addButtonText="Add Item"
      emptyText={isSecret ? "Belum ada data secret" : "Belum ada data konfigurasi"}
      accentColor={isSecret ? "indigo" : "teal"}
      inputType={isSecret ? "password" : "text"}
      valuePlaceholder={isSecret ? "Secret Value" : "Value"}
      isVisible={data.displaySettings?.data}
      onToggle={() => toggleVisibility('data')}
      isYamlEnabled={data.yamlSettings?.data}
      onYamlToggle={() => toggleYaml('data')}
    />
  );
};
