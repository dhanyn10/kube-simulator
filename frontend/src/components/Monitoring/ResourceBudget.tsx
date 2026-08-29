import { useMemo } from 'react';
import { useFlowStore } from '../../store';
import { K8sNodeData } from '../../types';
import { parseCPU, parseMemory, formatCPU, formatMemory, cn } from '../../lib/utils';
import { MultiProgressBar } from './MultiProgressBar';
import { Cpu, Database, AlertCircle } from 'lucide-react';

const calculateResourceTotals = (nodes: any[]) => {
  return nodes.reduce((acc, node) => {
    if (!['Deployment', 'Pod', 'ReplicaSet'].includes(node.type || '')) return acc;

    const data = node.data as K8sNodeData;
    const replicas = data.replicas || 1;

    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (['Deployment', 'ReplicaSet'].includes(parent?.type ?? '')) {
        return acc;
      }
    }

    const cpuReq = parseCPU(data.cpuRequest || '0');
    const memReq = parseMemory(data.memoryRequest || '0');
    const cpuLim = data.cpuLimit ? parseCPU(data.cpuLimit) : cpuReq;
    const memLim = data.memoryLimit ? parseMemory(data.memoryLimit) : memReq;

    return {
      cpuReq: acc.cpuReq + cpuReq * replicas,
      memReq: acc.memReq + memReq * replicas,
      cpuLim: acc.cpuLim + cpuLim * replicas,
      memLim: acc.memLim + memLim * replicas,
      hasMissingLimits: acc.hasMissingLimits || (!data.cpuLimit || !data.memoryLimit),
    };
  }, { cpuReq: 0, memReq: 0, cpuLim: 0, memLim: 0, hasMissingLimits: false });
};

export const ResourceBudget = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const systemResources = useFlowStore((state) => state.systemResources);
  const colorMode = useFlowStore((state) => state.colorMode);

  const totals = useMemo(() => calculateResourceTotals(nodes), [nodes]);

  if (!systemResources) return null;

  const cpuLimit = systemResources.cpuCores * 1000;
  const memLimit = systemResources.totalMemoryGB * 1024;

  const usedMemMiB = (systemResources.totalMemoryGB - systemResources.freeMemoryGB) * 1024;

  const k8sCpuReqPercent = (totals.cpuReq / cpuLimit) * 100;
  const k8sCpuLimPercent = (totals.cpuLim / cpuLimit) * 100;
  const k8sMemReqPercent = (totals.memReq / memLimit) * 100;
  const k8sMemLimPercent = (totals.memLim / memLimit) * 100;

  const totalCpuPercent = systemResources.cpuUsage;
  const totalMemPercent = (usedMemMiB / memLimit) * 100;

  const isOverCpu = k8sCpuLimPercent > 90 || (totalCpuPercent > 0 && totalCpuPercent > 95);
  const isOverMem = k8sMemLimPercent > 90 || (totalMemPercent > 0 && totalMemPercent > 95);

  return (
    <div className="flex flex-col gap-4">
      {(isOverCpu || isOverMem) && (
        <div className="flex items-center justify-between bg-red-500/10 p-2 rounded-lg border border-red-500/20 animate-pulse">
          <span className="text-[9px] font-bold text-red-500 uppercase tracking-tight">System Overload!</span>
          <AlertCircle size={12} className="text-red-500" />
        </div>
      )}

      <div className="space-y-3">
        {/* CPU */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cpu size={10} /> CPU Usage
            </span>
            <span className={cn(totalCpuPercent + k8sCpuReqPercent > 90 ? "text-red-500 font-bold" : "text-slate-400")}>
              {Math.round(totalCpuPercent + k8sCpuReqPercent)}%
            </span>
          </div>
          <MultiProgressBar
            height="h-2"
            colorMode={colorMode as any}
            segments={[
              { value: totalCpuPercent, color: "bg-slate-500/40", title: "Current System Load" },
              { value: k8sCpuReqPercent, color: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]", title: `Predicted K8s: ${formatCPU(totals.cpuReq)}` },
              { value: Math.max(0, k8sCpuLimPercent - k8sCpuReqPercent), color: "bg-red-500/30 border-l border-red-500/20", title: "Potential Overhead (Limits)" }
            ]}
          />
          <div className="flex justify-between text-[7px] text-slate-500 font-mono pt-0.5 uppercase tracking-tighter">
            <span>OS: {totalCpuPercent}%</span>
            <span>K8s Req: {formatCPU(totals.cpuReq)}</span>
            <span>Avail: {Math.max(0, 100 - totalCpuPercent - k8sCpuLimPercent).toFixed(0)}%</span>
          </div>
        </div>

        {/* Memory */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database size={10} /> RAM Usage
            </span>
            <span className={cn(totalMemPercent + k8sMemReqPercent > 90 ? "text-red-500 font-bold" : "text-slate-400")}>
              {systemResources?.freeMemoryGB?.toFixed?.(1) || '0.0'}GB
            </span>
          </div>
          <MultiProgressBar
            height="h-2"
            colorMode={colorMode as any}
            segments={[
              { value: totalMemPercent, color: "bg-slate-500/40", title: "Current RAM Used by OS" },
              { value: k8sMemReqPercent, color: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]", title: `Predicted K8s: ${formatMemory(totals.memReq)}` },
              { value: Math.max(0, k8sMemLimPercent - k8sMemReqPercent), color: "bg-red-500/30 border-l border-red-500/20", title: "Potential Overhead (Limits)" }
            ]}
          />
          <div className="flex justify-between text-[7px] text-slate-500 font-mono pt-0.5 uppercase tracking-tighter">
            <span>OS: {Math.round(totalMemPercent)}%</span>
            <span>K8s Req: {formatMemory(totals.memReq)}</span>
            <span>Free: {systemResources?.freeMemoryGB?.toFixed?.(1) || '0.0'}GB</span>
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
