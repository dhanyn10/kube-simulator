import { useFlowStore } from '@/store';
import { cn, sanitizeSlug } from '@/lib/utils';
import { Type, Terminal } from 'lucide-react';
import { ConfigInput, ConfigLabel } from '../UI/ConfigUI';
import {
  WorkloadConfig,
  ServiceConfig,
  IngressConfig,
  HPAConfig,
  InternetConfig,
  PVCConfig,
  DataResourceConfig,
  RoleConfig
} from './';
import { RoleSettingsSection } from './RoleSettingsSection';
import { ConfigMapSettingsSection } from './ConfigMapSettingsSection';
import { SecretSettingsSection } from './SecretSettingsSection';
import { HPASettingsSection } from './HPASettingsSection';
import { useNodeConfigHandler } from '@/activity/config';

interface NodeConfigProps {
  selectedNode: any;
}

export const NodeConfig = ({ selectedNode }: NodeConfigProps) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const colorMode = useFlowStore((state) => state.colorMode);

  const { data, toggleVisibility, toggleYaml, performUpdate } = useNodeConfigHandler(selectedNode);

  const renderConfig = () => {
    const props = { selectedNode, performUpdate, toggleVisibility, toggleYaml };

    switch (selectedNode.type) {
      case 'Pod':
      case 'Deployment':
        return <WorkloadConfig {...props} />;
      case 'Service':
        return <ServiceConfig {...props} />;
      case 'Ingress':
        return <IngressConfig {...props} />;
      case 'HPA':
        return <HPAConfig {...props} />;
      case 'Internet':
        return <InternetConfig {...props} />;
      case 'PVC':
        return <PVCConfig {...props} />;
      case 'ConfigMap':
      case 'Secret':
        return <DataResourceConfig {...props} />;
      case 'Role':
        return <RoleConfig data={data} nodeId={selectedNode.id} />;
      default:
        return null;
    }
  };

  const isReady = data.status === 'ready' ||
    ['Deployment', 'Service', 'Ingress', 'HPA', 'Internet', 'Namespace', 'PVC', 'ConfigMap', 'Secret', 'Role'].includes(selectedNode.type);

  return (
    <div className="space-y-4">
      {/* Basic Node Configuration */}
      <div className="space-y-1.5">
        <ConfigLabel>
          <Type size={10} /> Name
        </ConfigLabel>
        <ConfigInput
          value={data.label || ''}
          onChange={(e: any) => updateNodeData(selectedNode.id, {
            label: sanitizeSlug(e.target.value)
          })}
          placeholder="node-name"
          colorMode={colorMode}
          className="font-mono"
        />
      </div>

      {renderConfig()}

      {((data.roles && data.roles.length > 0) || (data.configMaps && data.configMaps.length > 0) || (data.secrets && data.secrets.length > 0) || (data.hpas && data.hpas.length > 0)) && (
        <div className="pt-2 border-t border-slate-700/30 flex flex-wrap items-center gap-2">
          {selectedNode.type !== 'Role' && (
            <RoleSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          {selectedNode.type !== 'ConfigMap' && selectedNode.type !== 'Role' && (
            <ConfigMapSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          {selectedNode.type !== 'Secret' && selectedNode.type !== 'Role' && (
            <SecretSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          <HPASettingsSection data={data} nodeId={selectedNode.id} />
        </div>
      )}

      {['Pod', 'Deployment', 'ReplicaSet'].includes(selectedNode.type) && (
        <button
          type="button"
          onClick={() => {
            const setTerminalOpen = useFlowStore.getState().setTerminalOpen;
            const setTerminalActiveTab = useFlowStore.getState().setTerminalActiveTab;
            const setTerminalSelectedResourceId = useFlowStore.getState().setTerminalSelectedResourceId;

            setTerminalSelectedResourceId(selectedNode.id);
            setTerminalActiveTab('logs');
            setTerminalOpen(true);
          }}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 px-4 rounded text-xs font-bold transition-all border shadow-sm mt-4",
            colorMode === 'dark'
              ? "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300"
              : "bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200 hover:text-emerald-700"
          )}
        >
          <Terminal size={13} />
          View Logs (kubectl logs)
        </button>
      )}

      <div className={cn(
        "mt-6 pt-4 border-t text-center",
        isReady ? "text-emerald-500" : "text-red-500"
      )}>
        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
          Status: {isReady ? 'Ready to Deploy' : 'Configuration Required'}
        </span>
      </div>
    </div>
  );
};
