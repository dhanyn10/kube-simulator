import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';
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
import { HPASettingsSection } from './HPASettingsSection';
import { getVisibilityUpdates, getWorkloadUpdates, isPeerPod } from '../../store/slices/node-handlers/configUtils';

interface NodeConfigProps {
  selectedNode: any;
}

const syncPeersAndParent = (
  selectedNode: any,
  additionalUpdates: any,
  nextSettings: any,
  settingKey: 'displaySettings' | 'yamlSettings',
  data: any
) => {
  const state = useFlowStore.getState();
  const updateNodeData = state.updateNodeData;

  state.nodes.forEach((n: any) => {
    if (isPeerPod(n, selectedNode, data.label)) {
      updateNodeData(n.id, {
        ...(settingKey === 'yamlSettings' ? data : {}),
        ...additionalUpdates,
        [settingKey]: nextSettings,
      });
    }
  });

  if (selectedNode.parentId) {
    const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
    if (parent) {
      updateNodeData(parent.id, {
        ...(settingKey === 'yamlSettings' ? data : {}),
        ...additionalUpdates,
        [settingKey]: nextSettings,
      });
    }
  }
};

const syncParentPodUpdates = (selectedNode: any, updates: any) => {
  if (selectedNode.type !== 'Pod' || !selectedNode.parentId) return;
  const state = useFlowStore.getState();
  const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
  if (!parent) return;

  const syncData: any = {};
  const syncKeys = ['cpuLimit', 'memoryLimit', 'label', 'image', 'status', 'webserver', 'runtime'];
  syncKeys.forEach((key) => {
    if (key in updates) syncData[key] = updates[key];
  });
  if (Object.keys(syncData).length > 0) {
    state.updateNodeData(parent.id, syncData);
  }
};

export const NodeConfig = ({ selectedNode }: NodeConfigProps) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const colorMode = useFlowStore((state) => state.colorMode);

  const data = selectedNode.data;

  const toggleVisibility = (field: string) => {
    const currentSettings = data.displaySettings || {};
    const nextVisibility = currentSettings[field] === false;
    const additionalUpdates = getVisibilityUpdates(field, nextVisibility, data);
    const nextSettings = { ...currentSettings, [field]: nextVisibility };

    updateNodeData(selectedNode.id, { ...data, ...additionalUpdates, displaySettings: nextSettings });
    syncPeersAndParent(selectedNode, additionalUpdates, nextSettings, 'displaySettings', data);
  };

  const toggleYaml = (field: string) => {
    const currentSettings = data.yamlSettings || {};
    const nextYaml = currentSettings[field] === false;
    const nextSettings = { ...currentSettings, [field]: nextYaml };

    updateNodeData(selectedNode.id, { ...data, yamlSettings: nextSettings });
    syncPeersAndParent(selectedNode, {}, nextSettings, 'yamlSettings', data);
  };

  const performUpdate = (updates: any) => {
    let nextData = { ...data, ...updates };

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
      nextData = getWorkloadUpdates(selectedNode.type, data, updates);
    }

    updateNodeData(selectedNode.id, nextData);
    syncParentPodUpdates(selectedNode, updates);
  };

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

      {((data.roles && data.roles.length > 0) || (data.configMaps && data.configMaps.length > 0) || (data.hpas && data.hpas.length > 0)) && (
        <div className="pt-2 border-t border-slate-700/30 flex flex-wrap items-center gap-2">
          {selectedNode.type !== 'Role' && (
            <RoleSettingsSection data={data} nodeId={selectedNode.id} />
          )}

          {selectedNode.type !== 'ConfigMap' && selectedNode.type !== 'Role' && (
            <ConfigMapSettingsSection data={data} nodeId={selectedNode.id} />
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
