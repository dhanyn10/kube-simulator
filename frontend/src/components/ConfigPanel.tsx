import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Settings, Server, Code, Box, X, Layers, Plus, Minus, Network } from 'lucide-react';

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

export const ConfigPanel = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const setEdges = useFlowStore((state) => state.setEdges);
  const colorMode = useFlowStore((state) => state.colorMode);
  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const setConfiguringNodeId = useFlowStore((state) => state.setConfiguringNodeId);
  const configuringEdgeId = useFlowStore((state) => state.configuringEdgeId);
  const setConfiguringEdgeId = useFlowStore((state) => state.setConfiguringEdgeId);
  
  // Find the element being configured
  const selectedNode = nodes.find(n => n.id === configuringNodeId);
  const selectedEdge = edges.find(e => e.id === configuringEdgeId);
  
  if (!selectedNode && !selectedEdge) return null;

  const handleClose = () => {
    setConfiguringNodeId(null);
    setConfiguringEdgeId(null);
  };

  if (selectedEdge) {
    const data = selectedEdge.data || {};
    const edgeColor = data.color || '#1d4ed8';
    const edgeWidth = data.width || 2;

    const updateEdgeData = (newData: any) => {
      setEdges(edges.map(e => e.id === selectedEdge.id ? {
        ...e,
        data: { ...(e.data || {}), ...newData }
      } : e));
    };

    return (
      <div className={cn(
        "fixed right-4 top-24 w-64 rounded-xl border shadow-2xl z-[50] p-4 animate-in slide-in-from-right",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between mb-4 border-b pb-2">
          <div className="flex items-center gap-2">
              <Settings size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">
                  Edge Configuration
              </h3>
          </div>
          <button 
              onClick={handleClose}
              className="p-1 hover:bg-slate-500/10 rounded-full transition-colors"
          >
              <X size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Thickness */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Layers size={10} /> Thickness
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={edgeWidth}
                onChange={(e) => updateEdgeData({ width: parseInt(e.target.value) })}
                className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {edgeWidth}px
              </span>
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Code size={10} /> Color Palette
            </label>
            <div className="grid grid-cols-5 gap-2">
              {['#1d4ed8', '#ef4444', '#10b981', '#f59e0b', '#6366f1'].map((c) => (
                <button
                  key={c}
                  onClick={() => updateEdgeData({ color: c })}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                    edgeColor === c ? "border-slate-400 dark:border-slate-300 scale-110 shadow-md" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform">
                <input
                  type="color"
                  value={edgeColor}
                  onChange={(e) => updateEdgeData({ color: e.target.value })}
                  className="absolute -top-1 -left-1 w-10 h-10 cursor-pointer bg-transparent border-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t text-center text-emerald-500">
          <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
            Connection Styled
          </span>
        </div>
      </div>
    );
  }

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

  const performUpdate = (updates: any) => {
    const nextData = { ...data, ...updates };

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
        if (nextData.runtime !== 'none' || nextData.webserver !== 'none') {
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
  };

  const updateReplicas = (replicas: number) => {
    updateNodeData(selectedNode.id, { replicas });
  };

  return (
    <div className={cn(
      "fixed right-4 top-24 w-64 rounded-xl border shadow-2xl z-[50] p-4 animate-in slide-in-from-right",
      colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <div className="flex items-center gap-2">
            <Settings size={14} className={cn(selectedNode.type === 'Deployment' ? "text-violet-500" : "text-blue-500")} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">
                {selectedNode.type} Configuration
            </h3>
        </div>
        <button 
            onClick={handleClose}
            className="p-1 hover:bg-slate-500/10 rounded-full transition-colors"
        >
            <X size={14} className="text-slate-500" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Internet Specific Configuration */}
        {selectedNode.type === 'Internet' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Network size={10} /> Data Traffic
              </label>
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
                <span className="text-[10px] font-mono text-slate-400">MB</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Layers size={10} /> Data Duration
              </label>
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

        {/* Workload Specific Configuration */}
        {(selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') && (
          <>
            {/* Web Server */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Server size={10} /> Web Server
              </label>
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
              <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Code size={10} /> App Runtime
              </label>
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
      </div>

      <div className={cn(
        "mt-6 pt-4 border-t text-center",
        data.status === 'ready' ? "text-emerald-500" : "text-red-500"
      )}>
        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
          Status: {data.status === 'ready' ? 'Ready to Deploy' : 'Configuration Required'}
        </span>
      </div>
    </div>
  );
};
