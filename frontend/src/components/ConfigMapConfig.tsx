import { useFlowStore } from '../store';
import { Settings, Type } from 'lucide-react';
import { KeyValueConfig } from './KeyValueConfig';

interface ConfigMapConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

export const ConfigMapConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: ConfigMapConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;
  const configData = data.configData || [];

  return (
    <KeyValueConfig
      title="Data (Key-Value)"
      titleIcon={<Settings size={10} />}
      valueIcon={<Type size={10} />}
      configData={configData}
      performUpdate={performUpdate}
      colorMode={colorMode}
      addButtonText="Add Item"
      emptyText="Belum ada data konfigurasi"
      accentColor="teal"
      valuePlaceholder="Value"
      isVisible={data.displaySettings?.data}
      onToggle={() => toggleVisibility('data')}
      isYamlEnabled={data.yamlSettings?.data}
      onYamlToggle={() => toggleYaml('data')}
    />
  );
};
