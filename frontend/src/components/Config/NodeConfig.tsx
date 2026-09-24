import { useFlowStore } from '@/store';
import { cn, sanitizeSlug } from '@/lib/utils';
import { Type, Terminal, Shuffle } from 'lucide-react';
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
import { useNodeConfigHandler } from '@/activities/config';

interface NodeConfigProps {
  selectedNode: any;
}

export const NodeConfig = ({ selectedNode }: NodeConfigProps) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const colorMode = useFlowStore((state) => state.colorMode);

  const { data, toggleVisibility, toggleYaml, performUpdate, randomizePodHash } = useNodeConfigHandler(selectedNode);

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

  const isWorkload = selectedNode.type === 'Pod' || selectedNode.type === 'Deployment' || selectedNode.type === 'ReplicaSet';
  const isConfiguredWorkload = isWorkload
    ? data.status === 'ready' &&
      ((!!data.webserver && data.webserver !== 'none') || (!!data.runtime && data.runtime !== 'none'))
    : true;

  const isReady = isConfiguredWorkload && (
    data.status === 'ready' ||
    ['Deployment', 'Service', 'Ingress', 'HPA', 'Internet', 'Namespace', 'PVC', 'ConfigMap', 'Secret', 'Role'].includes(selectedNode.type)
  );

  return (
    <div className="space-y-4">
      {/* Basic Node Configuration */}
      <div className="space-y-1.5">
        <ConfigLabel>
          <Type size={10} /> Name
        </ConfigLabel>
        <div className="flex items-center gap-1.5">
          <ConfigInput
            value={data.label || ''}
            onChange={(e: any) => updateNodeData(selectedNode.id, {
              label: sanitizeSlug(e.target.value)
            })}
            placeholder="node-name"
            colorMode={colorMode}
            className="font-mono flex-1 min-w-0"
          />
          {selectedNode.type === 'Pod' && (
            <button
              type="button"
              title="Randomize Pod Hash"
              onClick={randomizePodHash}
              className={cn(
                "p-2 rounded border transition-colors flex items-center justify-center shrink-0",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300"
                  : "bg-slate-100 border-slate-200 text-cyan-600 hover:bg-slate-200 hover:text-cyan-700"
              )}
            >
              <Shuffle size={13} />
            </button>
          )}
        </div>
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
