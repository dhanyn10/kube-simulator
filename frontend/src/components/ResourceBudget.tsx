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
      if (!['Deployment', 'Pod', 'PodGroup'].includes(node.type || '')) return acc;
      
      const data = node.data as K8sNodeData;
      const replicas = data.replicas || 1;
      
      if (node.parentId && ['Deployment', 'PodGroup'].includes(nodes.find(n => n.id === node.parentId)?.type ?? '')) {
          return acc;
      }

      const cpuReq = parseCPU(data.cpuRequest || '0');
      const memReq = parseMemory(data.memoryRequest || '0');
      
      // If limit is missing, we treat it as a potential risk (showing it can grow)
      // For calculation, let's assume it could go up to request * 2 if not specified, 
      // or just show the actual limit if specified.
      const cpuLim = data.cpuLimit ? parseCPU(data.cpuLimit) : cpuReq;
      const memLim = data.memoryLimit ? parseMemory(data.memoryLimit) : memReq;
      
      return {
        cpuReq: acc.cpuReq + (cpuReq * replicas),
        memReq: acc.memReq + (memReq * replicas),
        cpuLim: acc.cpuLim + (cpuLim * replicas),
        memLim: acc.memLim + (memLim * replicas),
        hasMissingLimits: acc.hasMissingLimits || (!data.cpuLimit || !data.memoryLimit)
      };
    }, { cpuReq: 0, memReq: 0, cpuLim: 0, memLim: 0, hasMissingLimits: false });
  }, [nodes]);

  if (!systemResources) return null;

  const cpuLimit = systemResources.cpuCores * 1000;
  const memLimit = systemResources.totalMemoryGB * 1024;
  
  const usedMemMiB = (systemResources.totalMemoryGB - systemResources.freeMemoryGB) * 1024;
  
  // Percentages for bars
  const k8sCpuReqPercent = (totals.cpuReq / cpuLimit) * 100;
  const k8sCpuLimPercent = (totals.cpuLim / cpuLimit) * 100;
  const k8sMemReqPercent = (totals.memReq / memLimit) * 100;
  const k8sMemLimPercent = (totals.memLim / memLimit) * 100;
  
  const totalCpuPercent = systemResources.cpuUsage;
  const totalMemPercent = (usedMemMiB / memLimit) * 100;

  const isOverCpu = k8sCpuLimPercent > 90 || totalCpuPercent > 95;
  const isOverMem = k8sMemLimPercent > 90 || totalMemPercent > 95;

  return (
    <div className={cn(
      "flex flex-col gap-2 p-3 rounded-lg border shadow-2xl min-w-[260px]",
      colorMode === 'dark' ? "bg-slate-900/90 border-slate-700/50" : "bg-white/90 border-slate-200"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Live Hardware Budget</span>
          <span className="text-[7px] text-slate-600 uppercase">Requests vs Potential Limits</span>
        </div>
        {(isOverCpu || isOverMem) && <AlertCircle size={12} className="text-red-500 animate-pulse" />}
      </div>

      <div className="space-y-4">
        {/* CPU */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cpu size={10} /> CPU Usage
            </span>
            <span className={cn(totalCpuPercent + k8sCpuReqPercent > 90 ? "text-red-500 font-bold" : "text-slate-400")}>
              {Math.round(totalCpuPercent + k8sCpuReqPercent)}% Total
            </span>
          </div>
          <div className={cn("h-2.5 rounded-full overflow-hidden flex relative", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
            {/* 1. Current System Usage (External) */}
            <div 
              className="h-full bg-slate-500/40 transition-all duration-500"
              style={{ width: `${totalCpuPercent}%` }}
              title="Current System Load"
            />
            {/* 2. K8s Predicted Usage (Requests) */}
            <div 
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500"
              style={{ width: `${k8sCpuReqPercent}%` }}
              title={`Predicted K8s: ${formatCPU(totals.cpuReq)}`}
            />
            {/* 3. K8s Risk (Limits) */}
            <div 
              className="h-full bg-red-500/30 border-l border-red-500/20 transition-all duration-500"
              style={{ width: `${Math.max(0, k8sCpuLimPercent - k8sCpuReqPercent)}%` }}
              title="Potential Overhead (Limits)"
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 font-mono pt-0.5">
            <span>System: {totalCpuPercent}%</span>
            <span>+ K8s: {formatCPU(totals.cpuReq)}</span>
            <span>Free: {Math.max(0, 100 - totalCpuPercent - k8sCpuLimPercent).toFixed(0)}%</span>
          </div>
        </div>

        {/* Memory */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database size={10} /> RAM Usage
            </span>
            <span className={cn(totalMemPercent + k8sMemReqPercent > 90 ? "text-red-500 font-bold" : "text-slate-400")}>
              {systemResources.freeMemoryGB.toFixed(1)} GB Free
            </span>
          </div>
          <div className={cn("h-2.5 rounded-full overflow-hidden flex relative", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
            {/* 1. Current System Usage (External) */}
            <div 
              className="h-full bg-slate-500/40 transition-all duration-500"
              style={{ width: `${totalMemPercent}%` }}
              title="Current RAM Used by OS"
            />
            {/* 2. K8s Predicted Usage (Requests) */}
            <div 
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-500"
              style={{ width: `${k8sMemReqPercent}%` }}
              title={`Predicted K8s: ${formatMemory(totals.memReq)}`}
            />
            {/* 3. K8s Risk (Limits) */}
            <div 
              className="h-full bg-red-500/30 border-l border-red-500/20 transition-all duration-500"
              style={{ width: `${Math.max(0, k8sMemLimPercent - k8sMemReqPercent)}%` }}
              title="Potential Overhead (Limits)"
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 font-mono pt-0.5">
            <span>System: {Math.round(totalMemPercent)}%</span>
            <span>+ K8s: {formatMemory(totals.memReq)}</span>
            <span>Free: {systemResources.freeMemoryGB.toFixed(1)} GB</span>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {totals.hasMissingLimits && (
          <div className="text-[8px] text-amber-500/80 flex items-center gap-1 bg-amber-500/5 p-1 rounded">
            <AlertCircle size={8} /> 
            Some nodes have no limits. Potential for "Noisy Neighbor" effect.
          </div>
        )}
        {(isOverCpu || isOverMem) && (
          <div className="text-[8px] text-red-500 font-bold leading-tight flex items-center gap-1 bg-red-500/10 p-1 rounded">
            <AlertCircle size={8} /> 
            CRITICAL: Potential usage exceeds host capacity!
          </div>
        )}
      </div>
    </div>
  );
};
