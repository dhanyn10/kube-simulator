import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Server, Code, Box, Layers, Network, Plus, Minus, Globe, Activity, Type, Eye, EyeOff } from 'lucide-react';

const RUNTIMES = {
  none: { label: 'None', frameworks: [] },
  php: { label: 'PHP', frameworks: ['Laravel', 'Symfony', 'WordPress', 'Slim'] },
  nodejs: { label: 'Node.js', frameworks: ['Express', 'NestJS', 'Next.js', 'Fastify'] },
  java: { label: 'Java', frameworks: ['Spring Boot', 'Quarkus', 'Micronaut'] },
  go: { label: 'Golang', frameworks: ['Gin', 'Echo', 'Fiber'] },
  python: { label: 'Python', frameworks: ['Django', 'FastAPI', 'Flask'] },
};

const WEBSERVERS = [
  { id: 'none', label: 'None' },
  { id: 'nginx', label: 'Nginx' },
  { id: 'apache', label: 'Apache' },
];

const CPU_OPTIONS = [
  { label: '100m', value: '100m' },
  { label: '250m', value: '250m' },
  { label: '500m', value: '500m' },
  { label: '1 Core', value: '1' },
  { label: '2 Cores', value: '2' },
];
const MEMORY_OPTIONS = [
  { label: '128 Mi', value: '128Mi' },
  { label: '256 Mi', value: '256Mi' },
  { label: '512 Mi', value: '512Mi' },
  { label: '1 Gi', value: '1Gi' },
  { label: '2 Gi', value: '2Gi' },
];

interface NodeConfigProps {
  selectedNode: any;
}

export const NodeConfig = ({ selectedNode }: NodeConfigProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const colorMode = useFlowStore((state) => state.colorMode);

  const data = selectedNode.data;
  const selectedPodLabel = selectedNode.data.label;
  const podReplicaGroup = selectedNode.type === 'Pod' && selectedNode.parentId
    ? nodes.filter(n =>
        n.type === 'Pod' &&
        n.parentId === selectedNode.parentId &&
        n.data.label === selectedPodLabel
      )
    : [];
  const replicaValue = podReplicaGroup.length > 0
    ? podReplicaGroup.reduce((acc, pod) => acc + (pod.data.replicas || 1), 0)
    : data.replicas || (selectedNode.type === 'Pod' ? 1 : 0);

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
        additionalUpdates.cpuLimit = '100m';
        additionalUpdates.memoryLimit = '128Mi';
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

    // If this is a Pod in a Deployment, we MUST also update the parent deployment's data
    if (selectedNode.type === 'Pod' && selectedNode.parentId) {
      const state = useFlowStore.getState();
      const parentDeployment = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      
      if (parentDeployment) {
        updateNodeData(parentDeployment.id, {
          ...additionalUpdates,
          displaySettings: nextSettings
        });
      }

      // Sync all other pods for immediate visual feedback
      const podsInGroup = state.nodes.filter((n: any) => 
        n.parentId === selectedNode.parentId && 
        n.data.label === data.label
      );
      podsInGroup.forEach((p: any) => {
        if (p.id !== selectedNode.id) {
          updateNodeData(p.id, {
            ...additionalUpdates,
            displaySettings: nextSettings 
          });
        }
      });
    }
  };

  const performUpdate = (updates: any) => {
    const nextData = { ...data, ...updates };

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
        const hasRuntime = nextData.runtime && nextData.runtime !== 'none';
        const hasWebserver = nextData.webserver && nextData.webserver !== 'none';

        if (hasRuntime || hasWebserver) {
            nextData.status = 'ready';
            const runtimePart = nextData.runtime !== 'none' ? nextData.runtime : '';
            const serverPart = nextData.webserver !== 'none' ? nextData.webserver : '';
            nextData.image = `k8s-app-${runtimePart}${serverPart ? '-' + serverPart : ''}:latest`.replace('--', '-').toLowerCase();

            if (nextData.isAutoNamed) {
                let newLabel = '';
                if (nextData.webserver !== 'none' && nextData.runtime !== 'none') {
                    newLabel = `${nextData.webserver}-${nextData.runtime}`;
                } else {
                    newLabel = nextData.webserver !== 'none' ? nextData.webserver : nextData.runtime;
                }
                nextData.label = newLabel.toLowerCase().replace(/\s+/g, '-');
            }
        } else {
            nextData.status = 'pending';
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

  const updateReplicas = (replicas: number) => {
    if (selectedNode.type === 'Pod' && selectedNode.parentId) {
      const state = useFlowStore.getState();
      const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parent?.type === 'Deployment' || parent?.type === 'PodGroup') {
        updateNodeData(selectedNode.parentId, { replicas });
      } else {
        updateNodeData(selectedNode.id, { replicas });
      }
    } else {
      updateNodeData(selectedNode.id, { replicas });
    }
  };

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

      {/* Internet Specific Configuration */}
      {selectedNode.type === 'Internet' && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Network size={10} /> Data Traffic
              </label>
              <button onClick={() => toggleVisibility('traffic')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.traffic !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={data.traffic || 0}
                onChange={(e) => performUpdate({ traffic: parseInt(e.target.value) || 0 })}
                className={cn(
                  "flex-1 text-[10px] p-2 rounded border outline-none",
                  colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                )}
              />
              <span className="text-[10px] font-mono text-slate-400">Visits</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Layers size={10} /> Data Duration
              </label>
              <button onClick={() => toggleVisibility('duration')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.duration !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(['second', 'minute', 'hour'] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => performUpdate({ durationUnit: unit })}
                  className={cn(
                    "text-[9px] py-1 rounded border transition-all capitalize",
                    (data.durationUnit || 'minute') === unit
                      ? "bg-blue-600 border-blue-600 text-white"
                      : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Replicas */}
      {(selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') && (
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Layers size={10} /> Replicas
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                updateReplicas(Math.max(1, replicaValue - 1));
              }}
              className={cn(
                "p-2 rounded border outline-none transition-colors hover:bg-opacity-80",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-300 hover:bg-slate-200"
              )}
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              min="1"
              value={replicaValue}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d+$/.test(value)) {
                  updateReplicas(parseInt(value) || 1);
                }
              }}
              className={cn(
                "flex-1 text-[10px] p-2 rounded border outline-none text-center",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
              )}
            />
            <button
              onClick={() => {
                updateReplicas(replicaValue + 1);
              }}
              className={cn(
                "p-2 rounded border outline-none transition-colors hover:bg-opacity-80",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                  : "bg-slate-100 border-slate-300 hover:bg-slate-200"
              )}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Ingress Configuration */}
      {selectedNode.type === 'Ingress' && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Globe size={10} /> Host
              </label>
              <button onClick={() => toggleVisibility('host')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.host !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <input
              type="text"
              value={data.ingressHost || ''}
              onChange={(e) => performUpdate({ ingressHost: e.target.value })}
              placeholder="example.com"
              className={cn(
                "w-full text-[10px] p-2 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
              )}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Code size={10} /> Path
              </label>
              <button onClick={() => toggleVisibility('path')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.path !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <input
              type="text"
              value={data.ingressPath || ''}
              onChange={(e) => performUpdate({ ingressPath: e.target.value })}
              placeholder="/"
              className={cn(
                "w-full text-[10px] p-2 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
              )}
            />
          </div>
        </>
      )}

      {/* HPA Configuration */}
      {selectedNode.type === 'HPA' && (
        <>
          <div className="space-y-3 p-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-500/5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Layers size={10} /> Replicas Range
                </label>
                <button onClick={() => toggleVisibility('replicas')} className="text-slate-500 hover:text-blue-500 transition-colors">
                  {(data.displaySettings?.replicas !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
              </div>
              <label className="text-[8px] text-slate-500 uppercase">Min Replicas</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => performUpdate({ minReplicas: Math.max(1, (data.minReplicas || 1) - 1) })}
                  className={cn(
                    "p-1.5 rounded border transition-colors",
                    colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
                  )}
                >
                  <Minus size={10} />
                </button>
                <span className="flex-1 text-center font-mono text-[10px]">{data.minReplicas || 1}</span>
                <button
                  onClick={() => performUpdate({ minReplicas: (data.minReplicas || 1) + 1 })}
                  className={cn(
                    "p-1.5 rounded border transition-colors",
                    colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
                  )}
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8px] text-slate-500 uppercase">Max Replicas</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => performUpdate({ maxReplicas: Math.max(1, (data.maxReplicas || 1) - 1) })}
                  className={cn(
                    "p-1.5 rounded border transition-colors",
                    colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
                  )}
                >
                  <Minus size={10} />
                </button>
                <span className="flex-1 text-center font-mono text-[10px]">{data.maxReplicas || 1}</span>
                <button
                  onClick={() => performUpdate({ maxReplicas: (data.maxReplicas || 1) + 1 })}
                  className={cn(
                    "p-1.5 rounded border transition-colors",
                    colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
                  )}
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Activity size={10} /> Target CPU (%)
                </label>
                <button onClick={() => toggleVisibility('targetCPU')} className="text-slate-500 hover:text-blue-500 transition-colors">
                  {(data.displaySettings?.targetCPU !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={data.targetCPU || 50}
                onChange={(e) => performUpdate({ targetCPU: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                <span>10%</span>
                <span className="text-blue-500 font-bold">{data.targetCPU || 50}%</span>
                <span>90%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Workload Specific Configuration */}
      {(selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') && (
        <>
          {/* Resource Limits */}
          <div className="space-y-3 p-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-500/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Resource Settings</span>
              <button onClick={() => toggleVisibility('resources')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.resources !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Layers size={10} /> CPU Limit
              </label>
              <div className="flex flex-wrap gap-1">
                {CPU_OPTIONS.map((cpu) => (
                  <button
                    key={cpu.value}
                    onClick={() => performUpdate({ cpuLimit: cpu.value })}
                    className={cn(
                      "text-[9px] px-2 py-1 rounded border transition-all",
                      data.cpuLimit === cpu.value
                        ? "bg-violet-600 border-violet-600 text-white"
                        : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
                    )}
                  >
                    {cpu.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Layers size={10} /> Memory Limit
              </label>
              <div className="flex flex-wrap gap-1">
                {MEMORY_OPTIONS.map((mem) => (
                  <button
                    key={mem.value}
                    onClick={() => performUpdate({ memoryLimit: mem.value })}
                    className={cn(
                      "text-[9px] px-2 py-1 rounded border transition-all",
                      data.memoryLimit === mem.value
                        ? "bg-violet-600 border-violet-600 text-white"
                        : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
                    )}
                  >
                    {mem.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image Visibility Toggle */}
          <div className="flex items-center justify-between py-1 border-t border-dashed border-slate-700/30">
            <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Box size={10} /> Show Image
            </span>
            <button onClick={() => toggleVisibility('image')} className="text-slate-500 hover:text-blue-500 transition-colors">
              {(data.displaySettings?.image !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
            </button>
          </div>

          {/* Web Server */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Server size={10} /> Web Server
              </label>
              <button onClick={() => toggleVisibility('webserver')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.webserver !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {WEBSERVERS.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => performUpdate({ webserver: ws.id })}
                  className={cn(
                    "text-[9px] py-1 rounded border transition-all",
                    data.webserver === ws.id
                      ? "bg-blue-600 border-blue-600 text-white"
                      : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
                  )}
                >
                  {ws.label}
                </button>
              ))}
            </div>
          </div>

          {/* Runtime */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Code size={10} /> App Runtime
              </label>
              <button onClick={() => toggleVisibility('runtime')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.runtime !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <select
              value={data.runtime || 'none'}
              onChange={(e) => performUpdate({ runtime: e.target.value, framework: '' })}
              className={cn(
                "w-full text-[10px] p-2 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
              )}
            >
              {Object.entries(RUNTIMES).map(([id, rt]) => (
                <option key={id} value={id}>{rt.label}</option>
              ))}
            </select>
          </div>

          {/* Framework */}
          {data.runtime && data.runtime !== 'none' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Box size={10} /> Framework
              </label>
              <div className="flex flex-wrap gap-1">
                {RUNTIMES[data.runtime as keyof typeof RUNTIMES]?.frameworks.map((fw) => (
                  <button
                    key={fw}
                    onClick={() => performUpdate({ framework: fw })}
                    className={cn(
                      "text-[8px] px-2 py-1 rounded-full border transition-all",
                      data.framework === fw
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : (colorMode === 'dark' ? "bg-slate-950 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300")
                    )}
                  >
                    {fw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Service Configuration */}
      {selectedNode.type === 'Service' && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Network size={10} /> Port
              </label>
              <button onClick={() => toggleVisibility('port')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.port !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <input
              type="number"
              value={data.port || 80}
              onChange={(e) => performUpdate({ port: parseInt(e.target.value) || 80 })}
              className={cn(
                "w-full text-[10px] p-2 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
              )}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Network size={10} /> Target Port
              </label>
              <button onClick={() => toggleVisibility('targetPort')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.targetPort !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <input
              type="number"
              value={data.targetPort || 80}
              onChange={(e) => performUpdate({ targetPort: parseInt(e.target.value) || 80 })}
              className={cn(
                "w-full text-[10px] p-2 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
              )}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Box size={10} /> Selector (app)
              </label>
              <button onClick={() => toggleVisibility('selector')} className="text-slate-500 hover:text-blue-500 transition-colors">
                {(data.displaySettings?.selector !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
            <input
              type="text"
              value={data.selector || ''}
              onChange={(e) => performUpdate({ selector: e.target.value })}
              placeholder="app-label"
              className={cn(
                "w-full text-[10px] p-2 rounded border outline-none",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
              )}
            />
          </div>
        </>
      )}

      <div className={cn(
        "mt-6 pt-4 border-t text-center",
        data.status === 'ready' || (selectedNode.type === 'Service' || selectedNode.type === 'Ingress' || selectedNode.type === 'HPA' || selectedNode.type === 'Internet') ? "text-emerald-500" : "text-red-500"
      )}>
        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
          Status: {data.status === 'ready' || (selectedNode.type === 'Service' || selectedNode.type === 'Ingress' || selectedNode.type === 'HPA' || selectedNode.type === 'Internet') ? 'Ready to Deploy' : 'Configuration Required'}
        </span>
      </div>
    </div>
  );
};
