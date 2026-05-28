import { useFlowStore } from '../store';
import { Settings, Type, Lock, Shield } from 'lucide-react';
import { KeyValueConfig } from './KeyValueConfig';

interface DataResourceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * A unified component for configuring data-centric Kubernetes resources
 * like ConfigMaps and Secrets.
 *
 * @param props - Component properties including selected node and update handlers
 */
export const DataResourceConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml
}: DataResourceConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;
  const configData = data.configData || [];
  const isSecret = selectedNode.type === 'Secret';

  // Resource-specific configuration
  const config = {
    title: isSecret ? "Secrets (Key-Value)" : "Data (Key-Value)",
    titleIcon: isSecret ? <Lock size={10} /> : <Settings size={10} />,
    valueIcon: isSecret ? <Shield size={10} /> : <Type size={10} />,
    accentColor: (isSecret ? "indigo" : "teal") as "indigo" | "teal",
    emptyText: isSecret ? "Belum ada data secret" : "Belum ada data konfigurasi",
    inputType: (isSecret ? "password" : "text") as 'text' | 'password',
    valuePlaceholder: isSecret ? "Secret Value" : "Value"
  };

  return (
    <KeyValueConfig
      title={config.title}
      titleIcon={config.titleIcon}
      valueIcon={config.valueIcon}
      configData={configData}
      performUpdate={performUpdate}
      colorMode={colorMode}
      addButtonText="Add Item"
      emptyText={config.emptyText}
      accentColor={config.accentColor}
      inputType={config.inputType}
      valuePlaceholder={config.valuePlaceholder}
      isVisible={data.displaySettings?.data}
      onToggle={() => toggleVisibility('data')}
      isYamlEnabled={data.yamlSettings?.data}
      onYamlToggle={() => toggleYaml('data')}
    />
  );
};
