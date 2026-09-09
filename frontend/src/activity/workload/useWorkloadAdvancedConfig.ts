import React from 'react';
import { FileCode, FileX } from 'lucide-react';
import { useFlowStore } from '@/store';
import { validateResourceLimits } from '@/lib/utils';

export const getYamlButtonProps = (hasResources: boolean, isYamlResources: boolean) => {
  if (!hasResources) {
    return {
      className: 'text-slate-600/40 cursor-not-allowed pointer-events-none',
      icon: React.createElement(FileX, { size: 10 }),
    };
  }
  return {
    className: isYamlResources ? 'text-emerald-500' : 'text-slate-500 hover:text-emerald-400',
    icon: isYamlResources ? React.createElement(FileCode, { size: 10 }) : React.createElement(FileX, { size: 10 }),
  };
};

export const useWorkloadAdvancedConfig = (selectedNode: any) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const data = selectedNode.data;
  const isTargetedByHPA = edges.some(
    (e) => e.target === selectedNode.id && nodes.find((n) => n.id === e.source)?.type === 'HPA'
  );
  const hasRequests = Boolean(data.cpuRequest && data.memoryRequest);
  const { isCpuError, isMemError } = validateResourceLimits(data);
  const hasResources = Boolean(data.cpuRequest || data.memoryRequest || data.cpuLimit || data.memoryLimit);
  const isYamlResources = (data.yamlSettings?.resources ?? true) && hasResources;

  const yamlProps = getYamlButtonProps(hasResources, isYamlResources);

  return {
    colorMode,
    data,
    isTargetedByHPA,
    hasRequests,
    isCpuError,
    isMemError,
    hasResources,
    isYamlResources,
    yamlProps,
  };
};
