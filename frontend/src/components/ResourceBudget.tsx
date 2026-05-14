import React, { useMemo } from 'react';
import { useFlowStore } from '../store';
import { K8sNodeData } from '../types';
import { parseCPU, parseMemory, formatCPU, formatMemory } from '../lib/utils';
import { cn } from '../lib/utils';
import { Cpu, Database, AlertCircle } from 'lucide-react';

export const ResourceBudget = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const systemResources = useFlowStore((state) => state.systemResources);
  const colorMode = useFlowStore((state) => state.colorMode);

  const totals = useMemo(() => {
    return nodes.reduce((acc, node) => {
      // Only count nodes that have replicas (workloads)
      if (!['Deployment', 'Pod', 'PodGroup'].includes(node.type || '')) return acc;
      
      const data = node.data as K8sNodeData;
      const replicas = data.replicas || 1;
      
      // If it's a child pod of a deployment/group, don't double count
      if (node.parentId && nodes.find(n => n.id === node.parentId && ['Deployment', 'PodGroup'].includes(n.type || ''))) {
          return acc;
      }

      const cpu = parseCPU(data.cpuRequest || '0');
      const mem = parseMemory(data.memoryRequest || '0');
      
      return {
        cpu: acc.cpu + (cpu * replicas),
        mem: acc.mem + (mem * replicas)
      };
    }, { cpu: 0, mem: 0 });
  }, [nodes]);

  if (!systemResources) return null;

  const cpuLimit = systemResources.cpuCores * 1000;
  const memLimit = systemResources.totalMemoryGB * 1024;
  
  const externalCpuMilli = (systemResources.cpuUsage / 100) * cpuLimit;
  const usedMemMiB = (systemResources.totalMemoryGB - systemResources.freeMemoryGB) * 1024;
  const externalMemMiB = Math.max(0, usedMemMiB - totals.mem);

  const k8sCpuPercent = (totals.cpu / cpuLimit) * 100;
  const k8sMemPercent = (totals.mem / memLimit) * 100;
  
  const totalCpuPercent = systemResources.cpuUsage;
  const totalMemPercent = (usedMemMiB / memLimit) * 100;

  const isOverCpu = totalCpuPercent > 90;
  const isOverMem = totalMemPercent > 90;

  return (
    <div className={cn(
      "flex flex-col gap-2 p-3 rounded-lg border shadow-2xl min-w-[240px]",
      colorMode === 'dark' ? "bg-slate-900/90 border-slate-700/50" : "bg-white/90 border-slate-200"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Live Hardware Budget</span>
        {(isOverCpu || isOverMem) && <AlertCircle size={12} className="text-red-500 animate-pulse" />}
      </div>

      <div className="space-y-3">
        {/* CPU */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5">
              <Cpu size={10} className="text-blue-500" /> CPU
            </span>
            <span className={cn(isOverCpu ? "text-red-500 font-bold" : "text-slate-400")}>
              {totalCpuPercent}% Used
            </span>
          </div>
          <div className={cn("h-1.5 rounded-full overflow-hidden flex", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
            {/* K8s Usage */}
            <div 
              className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] transition-all duration-500"
              style={{ width: `${k8sCpuPercent}%` }}
              title={`K8s Request: ${formatCPU(totals.cpu)}`}
            />
            {/* External Usage (Estimated) */}
            <div 
              className="h-full bg-slate-500/30 transition-all duration-500"
              style={{ width: `${Math.max(0, totalCpuPercent - k8sCpuPercent)}%` }}
              title="Other Applications"
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 font-mono">
            <span>K8s: {formatCPU(totals.cpu)}</span>
            <span>Total: {systemResources.cpuCores} Core</span>
          </div>
        </div>

        {/* Memory */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5">
              <Database size={10} className="text-emerald-500" /> RAM
            </span>
            <span className={cn(isOverMem ? "text-red-500 font-bold" : "text-slate-400")}>
              {systemResources.freeMemoryGB.toFixed(1)} GB Free
            </span>
          </div>
          <div className={cn("h-1.5 rounded-full overflow-hidden flex", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
            {/* K8s Usage */}
            <div 
              className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-500"
              style={{ width: `${k8sMemPercent}%` }}
              title={`K8s Request: ${formatMemory(totals.mem)}`}
            />
            {/* External Usage */}
            <div 
              className="h-full bg-slate-500/30 transition-all duration-500"
              style={{ width: `${(externalMemMiB / memLimit) * 100}%` }}
              title="Other Applications"
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 font-mono">
            <span>K8s: {formatMemory(totals.mem)}</span>
            <span>Total: {systemResources.totalMemoryGB} GB</span>
          </div>
        </div>
      </div>

      {(isOverCpu || isOverMem) && (
        <div className="text-[8px] text-red-500 font-bold leading-tight mt-1 flex items-center gap-1 bg-red-500/10 p-1 rounded">
          <AlertCircle size={8} /> 
          Critical: Local hardware overloaded!
        </div>
      )}
    </div>
  );
};
