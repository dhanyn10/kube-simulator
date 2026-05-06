import React from 'react';
import { Box, Layers, Network, Anchor, Globe, Activity, X, Search, Grid } from 'lucide-react';
import { K8sResourceType } from '../types';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (type: K8sResourceType) => void;
}

export const MegaMenu = ({ isOpen, onClose, onAddNode }: MegaMenuProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const [searchTerm, setSearchTerm] = React.useState('');

  if (!isOpen) return null;

  const categories = [
    {
      title: 'Workloads',
      color: 'violet',
      items: [
        { type: 'Pod' as K8sResourceType, icon: Box, label: 'Pod', desc: 'Atomic unit of Kubernetes, represents a single instance of a running process.' },
        { type: 'Deployment' as K8sResourceType, icon: Layers, label: 'Deployment', desc: 'Provides declarative updates for Pods and ReplicaSets.' },
      ]
    },
    {
      title: 'Networking',
      color: 'amber',
      items: [
        { type: 'Service' as K8sResourceType, icon: Network, label: 'Service', desc: 'An abstract way to expose an application running on a set of Pods.' },
        { type: 'Ingress' as K8sResourceType, icon: Globe, label: 'Ingress', desc: 'Manages external access to services, typically HTTP.' },
        { type: 'Namespace' as K8sResourceType, icon: Anchor, label: 'Namespace', desc: 'Provides a mechanism for isolating groups of resources.' },
      ]
    },
    {
      title: 'Scaling & Traffic',
      color: 'fuchsia',
      items: [
        { type: 'HPA' as K8sResourceType, icon: Activity, label: 'HPA', desc: 'Automatically scales the number of Pods in a deployment based on CPU utilization.' },
        { type: 'Internet' as K8sResourceType, icon: Globe, label: 'Internet', desc: 'Represents external traffic sources and public internet connectivity.' },
      ]
    }
  ];

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-6 bg-slate-950/20"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-5xl rounded-2xl shadow-2xl border animate-in zoom-in-95 duration-200 overflow-hidden",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}
      >
        {/* Header */}
        <div className={cn(
          "px-8 py-6 border-b flex items-center justify-between",
          colorMode === 'dark' ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Grid size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">All Infrastructure Components</h2>
              <p className={cn("text-xs", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
                Browse and add Kubernetes resources to your canvas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2",
                colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
              )} size={16} />
              <input
                autoFocus
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-64 pl-10 pr-4 py-2 text-sm rounded-xl border outline-none transition-all",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500"
                    : "bg-white border-slate-200 text-slate-800 focus:border-blue-400"
                )}
              />
            </div>
            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-full transition-colors",
                colorMode === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
              )}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-8">
            {filteredCategories.map((category) => (
              <div key={category.title} className="space-y-4">
                <h3 className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em] px-1",
                  colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
                )}>
                  {category.title}
                </h3>
                <div className="grid gap-3">
                  {category.items.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => {
                        onAddNode(item.type);
                        onClose();
                      }}
                      className={cn(
                        "group flex items-start gap-4 p-4 rounded-xl border transition-all text-left",
                        colorMode === 'dark'
                          ? "bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700 hover:shadow-xl"
                          : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-lg hover:bg-slate-50"
                      )}
                    >
                      <div className={cn(
                        "p-2.5 rounded-lg transition-colors shadow-sm",
                        category.color === 'violet' ? "bg-violet-500/10 text-violet-500" :
                        category.color === 'amber' ? "bg-amber-500/10 text-amber-500" :
                        "bg-fuchsia-500/10 text-fuchsia-500"
                      )}>
                        <item.icon size={20} />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-bold tracking-tight group-hover:text-blue-500 transition-colors">
                          {item.label}
                        </div>
                        <p className={cn(
                          "text-[11px] leading-relaxed",
                          colorMode === 'dark' ? "text-slate-400" : "text-slate-500"
                        )}>
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div className="py-20 text-center">
              <Search size={48} className="mx-auto mb-4 opacity-10" />
              <p className={cn("text-sm font-medium", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
                No infrastructure components match your search.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "px-8 py-4 border-t flex items-center justify-between",
          colorMode === 'dark' ? "border-slate-800 bg-slate-900/30" : "border-slate-50 bg-slate-50/50"
        )}>
          <div className="flex gap-6">
             <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               Ready to deploy
             </div>
             <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
               <div className="w-2 h-2 rounded-full bg-blue-500"></div>
               Interactive Canvas
             </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 italic">
            Press ESC to close
          </div>
        </div>
      </div>
    </div>
  );
};
