import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Type } from 'lucide-react';
import { syncWorkloadMetadata } from '../store/slices/node-handlers/nodeUtils';
import { WorkloadConfig } from './WorkloadConfig';
import { ServiceConfig } from './ServiceConfig';
import { IngressConfig } from './IngressConfig';
import { HPAConfig } from './HPAConfig';
import { InternetConfig } from './InternetConfig';
import { PVCConfig } from './PVCConfig';
import { ConfigMapConfig } from './ConfigMapConfig';
import { SecretConfig } from './SecretConfig';

interface NodeConfigProps {
  selectedNode: any;
}

export const NodeConfig = ({ selectedNode }: NodeConfigProps) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const colorMode = useFlowStore((state) => state.colorMode);

  const data = selectedNode.data;

  const toggleVisibility = (field: string) => {
    const currentSettings = data.displaySettings || {};
    const isCurrentlyVisible = currentSettings[field] !== false;
    const nextVisibility = !isCurrentlyVisible;
    
    let nextSettings = {
      ...currentSettings,
      [field]: nextVisibility
    };

    let additionalUpdates: any = {};
    
    // If enabling a feature that is currently empty, set default values
    if (nextVisibility) {
      if (field === 'resources' && !data.cpuLimit && !data.memoryLimit) {
        additionalUpdates.cpuRequest = '100m';
        additionalUpdates.cpuLimit = '250m';
        additionalUpdates.memoryRequest = '128Mi';
        additionalUpdates.memoryLimit = '256Mi';
      }
      if (field === 'webserver' && (!data.webserver || data.webserver === 'none')) {
        additionalUpdates.webserver = 'nginx';
      }
      if (field === 'runtime' && (!data.runtime || data.runtime === 'none')) {
        additionalUpdates.runtime = 'nodejs';
      }
    }

    const finalData = {
      ...data,
      ...additionalUpdates,
      displaySettings: nextSettings
    };

    updateNodeData(selectedNode.id, finalData);

    // Identify which pods should be synced
    const state = useFlowStore.getState();
    const podsToSync = state.nodes.filter((n: any) => {
      if (n.type !== 'Pod' || n.id === selectedNode.id) return false;
      
      // Case 1: Same parent and same label (Deployment/PodGroup member)
      if (selectedNode.parentId && n.parentId === selectedNode.parentId) {
        return n.data.label === data.label;
      }
      
      // Case 2: No parent but same label (Standalone pods)
      if (!selectedNode.parentId && !n.parentId) {
        return n.data.label === data.label;
      }
      
      return false;
    });

    // Update the other pods in the group
    podsToSync.forEach((p: any) => {
      updateNodeData(p.id, {
        ...additionalUpdates,
        displaySettings: nextSettings
      });
    });

    // Also update parent if applicable
    if (selectedNode.parentId) {
      const parentDeployment = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parentDeployment) {
        updateNodeData(parentDeployment.id, {
          ...additionalUpdates,
          displaySettings: nextSettings
        });
      }
    }
  };

  const performUpdate = (updates: any) => {
    let nextData = { ...data, ...updates };

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
        nextData = { ...nextData, ...syncWorkloadMetadata(selectedNode.type, nextData) };

        if (nextData.status === 'ready' && nextData.isAutoNamed) {
            let newLabel = '';
            if (nextData.webserver !== 'none' && nextData.runtime !== 'none') {
                newLabel = `${nextData.webserver}-${nextData.runtime}`;
            } else {
                newLabel = nextData.webserver !== 'none' ? nextData.webserver : nextData.runtime;
            }
            nextData.label = newLabel.toLowerCase().replace(/\s+/g, '-');
        } else if (nextData.status === 'pending') {
            nextData.image = undefined;
        }
    }

    if (selectedNode.type === 'Pod' && selectedNode.parentId && !('replicas' in updates)) {
      delete nextData.replicas;
      delete nextData.parentReplicas;
    }

    updateNodeData(selectedNode.id, nextData);

    // Sync to parent deployment if it's a pod in one
    if (selectedNode.type === 'Pod' && selectedNode.parentId) {
        const state = useFlowStore.getState();
        const parentDeployment = state.nodes.find((n: any) => n.id === selectedNode.parentId);
        if (parentDeployment) {
            // Pick only the data that should be synced to deployment template
            const syncData: any = {};
            if ('cpuLimit' in updates) syncData.cpuLimit = updates.cpuLimit;
            if ('memoryLimit' in updates) syncData.memoryLimit = updates.memoryLimit;
            if ('label' in updates) syncData.label = updates.label;
            if ('image' in updates) syncData.image = updates.image;
            if ('status' in updates) syncData.status = updates.status;
            if ('webserver' in updates) syncData.webserver = updates.webserver;
            if ('runtime' in updates) syncData.runtime = updates.runtime;

            if (Object.keys(syncData).length > 0) {
                updateNodeData(parentDeployment.id, syncData);
            }
        }
    }
  };

  const renderConfig = () => {
    const props = { selectedNode, performUpdate, toggleVisibility };

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
        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Type size={10} /> Name
        </label>
        <input
          type="text"
          value={data.label || ''}
          onChange={(e) => updateNodeData(selectedNode.id, {
            label: e.target.value.toLowerCase().replace(/\s+/g, '-')
          })}
          placeholder="node-name"
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none font-mono",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
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
