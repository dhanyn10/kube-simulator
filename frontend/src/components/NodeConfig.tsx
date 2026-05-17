import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Type } from 'lucide-react';
import { ConfigInput, ConfigLabel } from './ConfigUI';
import { WorkloadConfig } from './WorkloadConfig';
import { ServiceConfig } from './ServiceConfig';
import { IngressConfig } from './IngressConfig';
import { HPAConfig } from './HPAConfig';
import { InternetConfig } from './InternetConfig';
import { PVCConfig } from './PVCConfig';
import { ConfigMapConfig } from './ConfigMapConfig';
import { SecretConfig } from './SecretConfig';
import { getVisibilityUpdates, getWorkloadUpdates, isPeerPod } from '../store/slices/node-handlers/configUtils';

interface NodeConfigProps {
  selectedNode: any;
}

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

    const state = useFlowStore.getState();
    state.nodes.forEach((n: any) => {
      if (isPeerPod(n, selectedNode, data.label)) {
        updateNodeData(n.id, { ...additionalUpdates, displaySettings: nextSettings });
      }
    });

    if (selectedNode.parentId) {
      const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parent) updateNodeData(parent.id, { ...additionalUpdates, displaySettings: nextSettings });
    }
  };

  const toggleYaml = (field: string) => {
    const currentSettings = data.yamlSettings || {};
    const nextYaml = currentSettings[field] === false;
    const nextSettings = { ...currentSettings, [field]: nextYaml };

    updateNodeData(selectedNode.id, { ...data, yamlSettings: nextSettings });

    const state = useFlowStore.getState();
    state.nodes.forEach((n: any) => {
      if (isPeerPod(n, selectedNode, data.label)) {
        updateNodeData(n.id, { ...data, yamlSettings: nextSettings });
      }
    });

    if (selectedNode.parentId) {
      const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parent) updateNodeData(parent.id, { ...data, yamlSettings: nextSettings });
    }
  };

  const performUpdate = (updates: any) => {
    let nextData = { ...data, ...updates };

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
      nextData = getWorkloadUpdates(selectedNode.type, data, updates);
    }

    updateNodeData(selectedNode.id, nextData);

    if (selectedNode.type === 'Pod' && selectedNode.parentId) {
      const state = useFlowStore.getState();
      const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parent) {
        const syncData: any = {};
        ['cpuLimit', 'memoryLimit', 'label', 'image', 'status', 'webserver', 'runtime'].forEach(key => {
          if (key in updates) syncData[key] = updates[key];
        });
        if (Object.keys(syncData).length > 0) updateNodeData(parent.id, syncData);
      }
    }
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
        return <ConfigMapConfig {...props} />;
      case 'Secret':
        return <SecretConfig {...props} />;
      default:
        return null;
    }
  };

  const isReady = data.status === 'ready' ||
    ['Service', 'Ingress', 'HPA', 'Internet', 'Namespace', 'PVC', 'ConfigMap', 'Secret'].includes(selectedNode.type);

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
            label: e.target.value.toLowerCase().replace(/\s+/g, '-')
          })}
          placeholder="node-name"
          colorMode={colorMode}
          className="font-mono"
        />
      </div>

      {renderConfig()}

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
