import React from 'react';
import { useFlowStore } from '../store';
import { cn, parseCPU, parseMemory, validateResourceLimits } from '../lib/utils';
import { Box, Code, Layers, Server, Eye, EyeOff, AlertCircle, FileCode, FileX } from 'lucide-react';
import { RUNTIMES, WEBSERVERS, CPU_OPTIONS, MEMORY_OPTIONS } from '../constants/config';
import { SelectorGroup } from './SelectorGroup';
import { ConfigInput, ConfigSection, ConfigLabel, NumberStepper, AdvancedSection } from './ConfigUI';

interface WorkloadConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

const getReplicaValue = (selectedNode: any, nodes: any[]): number => {
  const { data, type, parentId } = selectedNode;
  if (type === 'Pod' && parentId) {
    const podReplicaGroup = nodes.filter(
      (n) => n.type === 'Pod' && n.parentId === parentId && n.data.label === data.label
    );
    if (podReplicaGroup.length > 0) {
      return podReplicaGroup.reduce((acc: number, pod: any) => acc + (Number(pod.data.replicas) || 1), 0);
    }
  }
  return data.replicas || (type === 'Pod' ? 1 : 0);
};

const getUpdateReplicasTargetId = (selectedNode: any, nodes: any[]): string => {
  if (selectedNode.type !== 'Pod' || !selectedNode.parentId) {
    return selectedNode.id;
  }
  const parent = nodes.find((n) => n.id === selectedNode.parentId);
  const isController = parent?.type === 'Deployment' || parent?.type === 'PodGroup';
  return isController ? selectedNode.parentId! : selectedNode.id;
};

interface ResourceSettingsProps {
  data: any;
  colorMode: string;
  isCpuError: boolean;
  isMemError: boolean;
  performUpdate: (updates: any) => void;
}

const ResourceSettingsList = ({ data, colorMode, isCpuError, isMemError, performUpdate }: ResourceSettingsProps) => {
  const items = [
    {
      field: 'cpuRequest',
      label: 'CPU Request',
      options: CPU_OPTIONS,
      iconColor: 'text-emerald-500',
      activeColor: 'bg-emerald-600 border-emerald-600',
      shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    },
    {
      field: 'cpuLimit',
      label: 'CPU Limit',
      options: CPU_OPTIONS,
      iconColor: 'text-violet-500',
      activeColor: isCpuError ? 'bg-red-600 border-red-600' : 'bg-violet-600 border-violet-600',
      hasError: isCpuError,
      validate: (val: string) => parseCPU(val) < parseCPU(data.cpuRequest)
    },
    { type: 'separator' },
    {
      field: 'memoryRequest',
      label: 'Memory Request',
      options: MEMORY_OPTIONS,
      iconColor: 'text-emerald-500',
      activeColor: 'bg-emerald-600 border-emerald-600',
      shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    },
    {
      field: 'memoryLimit',
      label: 'Memory Limit',
      options: MEMORY_OPTIONS,
      iconColor: 'text-violet-500',
      activeColor: isMemError ? 'bg-red-600 border-red-600' : 'bg-violet-600 border-violet-600',
      hasError: isMemError,
      validate: (val: string) => parseMemory(val) < parseMemory(data.memoryRequest)
    }
  ];

  return (
    <>
      {items.map((item: any, idx) => {
        if (item.type === 'separator') {
          return <div key={`sep-${idx}`} className="h-px bg-slate-700/30 my-2" />;
        }
        return (
          <div key={item.field} className={cn("space-y-1.5", item.field.includes('Limit') && "opacity-80")}>
            <div className="flex items-center justify-between">
              <ConfigLabel>
                <Layers size={10} className={item.iconColor} /> {item.label}
              </ConfigLabel>
              {item.hasError && (
                <div className="group relative flex items-center">
                  <AlertCircle size={12} className="text-red-500 cursor-help workload-resource-warning" />
                  <div className={cn(
                    "absolute right-full mr-2 px-2 py-1 rounded text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50",
                    colorMode === 'dark' ? "bg-red-950 text-red-200 border border-red-900" : "bg-red-100 text-red-800 border border-red-200"
                  )}>
                    Limit must be greater than or equal to Request
                  </div>
                </div>
              )}
            </div>
            <SelectorGroup
              options={item.options}
              currentValue={data[item.field]}
              onSelect={(val) => performUpdate({ [item.field]: val })}
              colorMode={colorMode}
              activeColorClass={item.activeColor}
              activeShadowClass={item.shadow}
              validateOption={item.validate}
            />
          </div>
        );
      })}
    </>
  );
};

interface FrameworkSelectorProps {
  runtime: string;
  framework: string | undefined;
  colorMode: string;
  performUpdate: (updates: any) => void;
}

const FrameworkSelector = ({ runtime, framework, colorMode, performUpdate }: FrameworkSelectorProps) => {
  if (!runtime || runtime === 'none') return null;

  const frameworks = RUNTIMES[runtime as keyof typeof RUNTIMES]?.frameworks;
  if (!frameworks) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-1">
      <ConfigSection title="Framework" icon={Box}>
        <div className="flex flex-wrap gap-1">
          {frameworks.map((fw) => {
            const isActive = framework === fw;
            let btnClass = "bg-white border-slate-200 hover:border-slate-300";
            if (isActive) {
              btnClass = "bg-emerald-600 border-emerald-600 text-white";
            } else if (colorMode === 'dark') {
              btnClass = "bg-slate-950 border-slate-800 hover:border-slate-700";
            }

            return (
              <button
                key={fw}
                onClick={() => performUpdate({ framework: fw })}
                className={cn(
                  "text-[8px] px-2 py-1 rounded-full border transition-all",
                  btnClass
                )}
              >
                {fw}
              </button>
            );
          })}
        </div>
      </ConfigSection>
    </div>
  );
};

export const WorkloadConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: WorkloadConfigProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const data = selectedNode.data;
  const replicaValue = getReplicaValue(selectedNode, nodes);

  const updateReplicas = (replicas: number) => {
    const targetId = getUpdateReplicasTargetId(selectedNode, nodes);
    updateNodeData(targetId, { replicas });
  };

  const edges = useFlowStore((state) => state.edges);
  const isTargetedByHPA = edges.some(e => e.target === selectedNode.id && nodes.find(n => n.id === e.source)?.type === 'HPA');
  const hasRequests = data.cpuRequest && data.memoryRequest;
  const { isCpuError, isMemError } = validateResourceLimits(data);
  const hasResources = !!(data.cpuRequest || data.memoryRequest || data.cpuLimit || data.memoryLimit);
  const isYamlResources = data.yamlSettings?.resources !== false && hasResources;

  let yamlButtonClass = "text-slate-500 hover:text-emerald-400";
  if (!hasResources) {
    yamlButtonClass = "text-slate-600/40 cursor-not-allowed pointer-events-none";
  } else if (isYamlResources) {
    yamlButtonClass = "text-emerald-500";
  }

  let yamlButtonIcon = <FileX size={10} />;
  if (hasResources && isYamlResources) {
    yamlButtonIcon = <FileCode size={10} />;
  }

  return (
    <div className="space-y-4">
      {/* Replicas */}
      <ConfigSection title="Replicas" icon={Layers}>
        <NumberStepper
          value={replicaValue}
          onChange={updateReplicas}
          colorMode={colorMode}
        />
      </ConfigSection>

      <AdvancedSection colorMode={colorMode}>
        {/* Resource Requests & Limits */}
        <div className="space-y-3 rounded-lg border border-dashed p-3 border-slate-700/50 bg-slate-500/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Layers size={10} /> Resource Settings
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleVisibility('resources')} className={cn("transition-colors", data.displaySettings?.resources !== false ? "text-blue-500" : "text-slate-500 hover:text-blue-400")}>
                {(data.displaySettings?.resources !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
              <button
                onClick={() => toggleYaml('resources')}
                disabled={!hasResources}
                className={cn("transition-colors", yamlButtonClass)}
                title={!hasResources ? "No YAML configuration available for empty resources" : "Include in YAML"}
              >
                {yamlButtonIcon}
              </button>
            </div>
          </div>

          {isTargetedByHPA && !hasRequests && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] text-amber-500 leading-tight mb-2">
              ⚠️ HPA detected. CPU/Memory <strong>Requests</strong> are required for autoscaling to function.
            </div>
          )}

          <ResourceSettingsList
            data={data}
            colorMode={colorMode}
            isCpuError={isCpuError}
            isMemError={isMemError}
            performUpdate={performUpdate}
          />
        </div>

        {/* Container Image */}
        <ConfigSection
          title="Container Image"
          icon={Box}
          isVisible={data.displaySettings?.image}
          onToggle={() => toggleVisibility('image')}
          isYamlEnabled={data.yamlSettings?.image}
          onYamlToggle={() => toggleYaml('image')}
          disableYamlToggle={!data.image}
        >
          <ConfigInput
            placeholder="e.g. nginx:latest"
            value={data.image || ''}
            onChange={(e: any) => performUpdate({ image: e.target.value })}
            colorMode={colorMode}
          />
        </ConfigSection>

        {/* Web Server */}
        <ConfigSection
          title="Web Server"
          icon={Server}
          isVisible={data.displaySettings?.webserver}
          onToggle={() => toggleVisibility('webserver')}
          isYamlEnabled={data.yamlSettings?.webserver}
          onYamlToggle={() => toggleYaml('webserver')}
          disableYamlToggle={!data.webserver || data.webserver === 'none'}
        >
          <SelectorGroup
            options={WEBSERVERS}
            currentValue={data.webserver}
            onSelect={(val) => performUpdate({ webserver: val })}
            colorMode={colorMode}
          />
        </ConfigSection>

        {/* Runtime */}
        <ConfigSection
          title="App Runtime"
          icon={Code}
          isVisible={data.displaySettings?.runtime}
          onToggle={() => toggleVisibility('runtime')}
          isYamlEnabled={data.yamlSettings?.runtime}
          onYamlToggle={() => toggleYaml('runtime')}
          disableYamlToggle={!data.runtime || data.runtime === 'none'}
        >
          <select
            value={data.runtime || 'none'}
            onChange={(e) => performUpdate({ runtime: e.target.value, framework: '' })}
            className={cn(
              "w-full text-[10px] p-2 rounded border outline-none",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
            )}
          >
            {Object.entries(RUNTIMES).map(([id, rt]) => (
              <option key={id} value={id}>{rt.label}</option>
            ))}
          </select>
        </ConfigSection>

        <FrameworkSelector
          runtime={data.runtime}
          framework={data.framework}
          colorMode={colorMode}
          performUpdate={performUpdate}
        />
      </AdvancedSection>
    </div>
  );
};
