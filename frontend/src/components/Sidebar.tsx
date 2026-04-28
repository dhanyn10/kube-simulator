import React from 'react';
import { Box, Layers, Network, Anchor, Plus, FileCode } from 'lucide-react';
import { K8sResourceType } from '../types';
import { cn } from '../lib/utils';
import { NODE_TYPES } from '../constants';

interface SidebarProps {
  onAddNode: (type: K8sResourceType) => void;
  onExport: () => void;
}

export const Sidebar = ({ onAddNode, onExport }: SidebarProps) => {
  const items: { type: K8sResourceType; icon: any; label: string; desc: string }[] = [
    { type: 'Pod', icon: Box, label: 'Pod', desc: 'Atomic unit of K8s' },
    { type: 'Service', icon: Network, label: 'Service', desc: 'Network endpoint' },
    { type: 'Deployment', icon: Layers, label: 'Deployment', desc: 'Pod controller' },
    { type: 'Namespace', icon: Anchor, label: 'Namespace', desc: 'Virtual cluster' },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-10 transition-colors">
      <div className="p-5 border-b border-slate-800">
        <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
          InfraStack Architect
        </h1>
        <p className="text-[10px] text-slate-500 mt-1 font-medium font-mono">
          Cloud Component Library
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <label className="text-[10px] uppercase font-bold text-slate-500 mb-3 block tracking-wider">
            Workloads
          </label>
          <div className="grid gap-2">
            {items.filter(i => i.type === 'Deployment' || i.type === 'Pod').map(({ type, icon: Icon, label, desc }) => (
              <button
                key={type}
                onClick={() => onAddNode(type)}
                className={cn(
                  "group flex items-center gap-3 p-2 rounded-lg bg-slate-800 border-l-[3px] border border-slate-700 cursor-pointer transition-all duration-200",
                  "hover:bg-slate-700/50 hover:shadow-lg",
                  type === 'Deployment' ? "border-l-violet-500 hover:border-violet-500" : "border-l-cyan-500 hover:border-cyan-500"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded transition-colors bg-slate-900/50",
                  type === 'Deployment' ? "text-violet-400" : "text-cyan-400"
                )}>
                  <Icon size={16} />
                </div>
                <div className="text-left overflow-hidden">
                  <div className="text-xs font-semibold text-slate-200">{label}</div>
                  <div className="text-[9px] text-slate-500 font-medium truncate">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="text-[10px] uppercase font-bold text-slate-500 mb-3 block tracking-wider">
            Networking
          </label>
          <div className="grid gap-2">
            {items.filter(i => i.type === 'Service' || i.type === 'Namespace').map(({ type, icon: Icon, label, desc }) => (
              <button
                key={type}
                onClick={() => onAddNode(type)}
                className={cn(
                  "group flex items-center gap-3 p-2 rounded-lg bg-slate-800 border-l-[3px] border border-slate-700 cursor-pointer transition-all duration-200",
                  "hover:bg-slate-700/50 hover:shadow-lg",
                  type === 'Service' ? "border-l-amber-500 hover:border-amber-500" : "border-l-emerald-500 hover:border-emerald-500"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded transition-colors bg-slate-900/50",
                  type === 'Service' ? "text-amber-400" : "text-emerald-400"
                )}>
                  <Icon size={16} />
                </div>
                <div className="text-left overflow-hidden">
                  <div className="text-xs font-semibold text-slate-200">{label}</div>
                  <div className="text-[9px] text-slate-500 font-medium truncate">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-slate-950/30 rounded-lg p-3 border border-slate-800 border-dashed">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Status: Live</span>
          </div>
          <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
            Cluster: prod-us-east-1
          </p>
        </section>
      </div>

      <div className="p-4 bg-slate-950/50 space-y-3">
        <button 
          onClick={onExport}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-2.5 rounded transition-all shadow-lg uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <FileCode size={12} />
          Export YAML
        </button>
      </div>
    </div>
  );
};
