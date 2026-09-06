import React from 'react';
import { Compass, Sparkles, Shield, Activity, Key, Network } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

export type GuidedTourType = 'intro' | 'arch' | 'rbac' | 'hpa' | 'config';

interface TourSelectionModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelectTour: (tourType: GuidedTourType) => void;
}

export const TourSelectionModal: React.FC<TourSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectTour,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const handleSelect = (type: GuidedTourType) => {
    onSelectTour(type);
    onClose();
  };

  const tourOptions = [
    {
      type: 'intro' as GuidedTourType,
      title: 'Quick App Overview',
      subtitle: 'Introduction to Workspace UI',
      description: 'A 4-step quick walk-through of the sidebar, canvas, simulation controls, and settings panel.',
      icon: Compass,
      iconColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      tag: '5 min • Quick Intro',
    },
    {
      type: 'arch' as GuidedTourType,
      title: '1. Web App Architecture',
      subtitle: 'Internet, Services & Pods',
      description: 'Learn how to connect Internet nodes to Services and Deployments, placing pods on the right side and connecting edges.',
      icon: Network,
      iconColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      tag: 'Guided Scenario • Step-by-Step Verification',
    },
    {
      type: 'rbac' as GuidedTourType,
      title: '2. RBAC User & Role Security',
      subtitle: 'IAM Users, Roles & Permissions',
      description: 'Learn how to attach RBAC Roles to Workloads, assign custom User/Subject names (e.g. alice), and configure permission toggles.',
      icon: Shield,
      iconColor: 'text-indigo-400',
      badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      tag: 'Guided Scenario • Security & Users',
    },
    {
      type: 'hpa' as GuidedTourType,
      title: '3. Horizontal Pod Autoscaler',
      subtitle: 'Dynamic Workload Autoscaling',
      description: 'Attach HPAs to Workload cards, set target CPU thresholds, and simulate traffic spikes to observe auto-scaling in real-time.',
      icon: Activity,
      iconColor: 'text-fuchsia-400',
      badgeBg: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
      tag: 'Guided Scenario • Auto-scaling',
    },
    {
      type: 'config' as GuidedTourType,
      title: '4. ConfigMaps & Secrets Binding',
      subtitle: 'Environment Data & Secrets',
      description: 'Configure Key-Value environment variables with ConfigMaps and Secrets, and bind them directly to workload nodes.',
      icon: Key,
      iconColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      tag: 'Guided Scenario • Configuration',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Interactive Learning & Guided Tours"
      subtitle="Choose a guided tour scenario to learn Kubernetes concepts interactively"
      icon={Sparkles}
      iconColorClass="text-amber-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-1">
        {tourOptions.map((opt) => {
          const IconComponent = opt.icon;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleSelect(opt.type)}
              className={cn(
                "p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 group cursor-pointer hover:scale-[1.01] hover:shadow-lg",
                colorMode === 'dark'
                  ? "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg bg-slate-800/50 border border-slate-700/50", opt.iconColor)}>
                      <IconComponent size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                        {opt.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">{opt.subtitle}</p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                  {opt.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
                <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", opt.badgeBg)}>
                  {opt.tag}
                </span>
                <span className="text-[11px] font-bold text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                  Start →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
