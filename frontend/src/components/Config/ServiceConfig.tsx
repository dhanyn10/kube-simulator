import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { Network, Box, Server, ChevronDown, Check, Lock, AlertCircle } from 'lucide-react';
import { ConfigSection } from '@/components/UI/ConfigUI';
import { cn } from '@/lib/utils';

interface ServiceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

interface ServiceTypeOption {
  value: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  label: string;
  description: string;
  disabled?: boolean;
}

const SERVICE_TYPE_OPTIONS: ServiceTypeOption[] = [
  {
    value: 'ClusterIP',
    label: 'ClusterIP',
    description: 'Exposes service on an internal IP in the cluster (Default).'
  },
  {
    value: 'NodePort',
    label: 'NodePort',
    description: 'Exposes service on each Node’s IP at a static port.'
  },
  {
    value: 'LoadBalancer',
    label: 'LoadBalancer',
    description: 'Exposes service externally using cloud provider’s load balancer (Disabled in local PC mode).',
    disabled: true
  }
];

/**
 * Computes class names for Service Type dropdown option buttons.
 */
const getServiceTypeOptionClasses = (isDisabled: boolean, isSelected: boolean, colorMode: string): string => {
  if (isDisabled) {
    return 'opacity-50 cursor-not-allowed bg-slate-800/20';
  }
  if (isSelected) {
    if (colorMode === 'dark') {
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  if (colorMode === 'dark') {
    return 'hover:bg-slate-800 hover:text-white';
  }
  return 'hover:bg-slate-100 hover:text-slate-900';
};

/**
 * Computes class names for Workload Selector dropdown option buttons.
 */
const getWorkloadSelectorOptionClasses = (isSelected: boolean, colorMode: string): string => {
  if (isSelected) {
    if (colorMode === 'dark') {
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  if (colorMode === 'dark') {
    return 'hover:bg-slate-800 hover:text-white';
  }
  return 'hover:bg-slate-100 hover:text-slate-900';
};

/**
 * Configuration component for Kubernetes Service resources.
 *
 * @param props - Component properties including update and toggle handlers.
 */
export const ServiceConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml
}: ServiceConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const data = selectedNode.data;
  const currentServiceType = data.serviceType || 'ClusterIP';
  const showNodePort = currentServiceType === 'NodePort' || currentServiceType === 'LoadBalancer';

  const [isServiceTypeDropdownOpen, setIsServiceTypeDropdownOpen] = useState(false);
  const [isSelectorDropdownOpen, setIsSelectorDropdownOpen] = useState(false);

  const serviceTypeDropdownRef = useRef<HTMLDivElement>(null);
  const selectorDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceTypeDropdownRef.current && !serviceTypeDropdownRef.current.contains(event.target as Node)) {
        setIsServiceTypeDropdownOpen(false);
      }
      if (selectorDropdownRef.current && !selectorDropdownRef.current.contains(event.target as Node)) {
        setIsSelectorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedServiceTypeOption = SERVICE_TYPE_OPTIONS.find((opt) => opt.value === currentServiceType) || SERVICE_TYPE_OPTIONS[0];

  // Collect available workload resources on canvas (Deployment, Pod, ReplicaSet)
  const workloadNodes = nodes.filter((n) => {
    if (n.type === 'Deployment' || n.type === 'ReplicaSet') return true;
    if (n.type === 'Pod' && !n.parentId && !n.data?.parentId) return true;
    return false;
  });

  const availableWorkloadLabels = Array.from(
    new Set(
      workloadNodes
        .map((n) => (n.data?.label as string) || (n.data?.baseName as string) || n.id)
        .filter(Boolean)
    )
  );

  const currentSelector = data.selector || '';
  const isSelectorValid = currentSelector && availableWorkloadLabels.includes(currentSelector);

  return (
    <div className="space-y-4">
      {/* Service Type Selection */}
      <ConfigSection
        title="Service Type"
        icon={Server}
        isVisible={data.displaySettings?.serviceType}
        onToggle={() => toggleVisibility('serviceType')}
        isYamlEnabled={data.yamlSettings?.serviceType}
        onYamlToggle={() => toggleYaml('serviceType')}
      >
        <div ref={serviceTypeDropdownRef} className="relative w-full">
          <button
            type="button"
            onClick={() => setIsServiceTypeDropdownOpen((prev) => !prev)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-mono transition-all cursor-pointer shadow-sm",
              colorMode === 'dark'
                ? "bg-slate-900/90 border-slate-700 text-slate-100 hover:border-slate-600 focus:border-amber-500/80"
                : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-amber-500/80"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-500">{selectedServiceTypeOption.label}</span>
            </div>
            <ChevronDown size={14} className={cn("transition-transform duration-200 opacity-60", isServiceTypeDropdownOpen && "rotate-180")} />
          </button>

          {isServiceTypeDropdownOpen && (
            <div
              className={cn(
                "absolute left-0 right-0 top-full mt-1.5 z-50 rounded-md border shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100",
                colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
              )}
            >
              {SERVICE_TYPE_OPTIONS.map((option) => {
                const isSelected = currentServiceType === option.value;
                const isDisabled = option.disabled;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        performUpdate({ serviceType: option.value });
                        setIsServiceTypeDropdownOpen(false);
                      }
                    }}
                    className={cn(
                      "w-full text-left p-2 rounded text-xs transition-colors flex items-start justify-between gap-2 group",
                      getServiceTypeOptionClasses(Boolean(isDisabled), isSelected, colorMode)
                    )}
                  >
                    <div className="space-y-0.5 pr-1">
                      <div className="flex items-center gap-1.5 font-medium font-mono">
                        <span>{option.label}</span>
                        {isDisabled && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-sans uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Lock size={10} /> Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] opacity-60 leading-tight font-sans">{option.description}</p>
                    </div>
                    {isSelected && <Check size={14} className="text-amber-500 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ConfigSection>

      {/* NodePort Configuration (Only for NodePort or LoadBalancer) */}
      {showNodePort && (
        <ConfigSection
          title="NodePort"
          icon={Network}
          isVisible={data.displaySettings?.nodePort}
          onToggle={() => toggleVisibility('nodePort')}
          isYamlEnabled={data.yamlSettings?.nodePort}
          onYamlToggle={() => toggleYaml('nodePort')}
          disableYamlToggle={Boolean(data.nodePort) === false}
        >
          <input
            type="number"
            min={30000}
            max={32767}
            value={data.nodePort ?? ''}
            onChange={(e: any) => performUpdate({ nodePort: e.target.value ? Number.parseInt(e.target.value, 10) : undefined })}
            placeholder="30000-32767 (Optional)"
            className={cn(
              "w-full text-[10px] p-2 rounded border outline-none font-mono",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
            )}
          />
        </ConfigSection>
      )}

      {/* Primary Port Configuration */}
      <ConfigSection
        title="Port"
        icon={Network}
        isVisible={data.displaySettings?.port}
        onToggle={() => toggleVisibility('port')}
      >
        <input
          type="number"
          value={data.port || 80}
          onChange={(e: any) => performUpdate({ port: Number.parseInt(e.target.value, 10) || 80 })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none font-mono",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </ConfigSection>

      {/* Target Port Configuration */}
      <ConfigSection
        title="Target Port"
        icon={Network}
        isVisible={data.displaySettings?.targetPort}
        onToggle={() => toggleVisibility('targetPort')}
        isYamlEnabled={data.yamlSettings?.targetPort}
        onYamlToggle={() => toggleYaml('targetPort')}
        disableYamlToggle={Boolean(data.targetPort) === false}
      >
        <input
          type="number"
          value={data.targetPort || 80}
          onChange={(e: any) => performUpdate({ targetPort: Number.parseInt(e.target.value, 10) || 80 })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none font-mono",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </ConfigSection>

      {/* Selector Configuration Dropdown from Canvas Resources */}
      <ConfigSection
        title="Selector (app)"
        icon={Box}
        isVisible={data.displaySettings?.selector}
        onToggle={() => toggleVisibility('selector')}
        isYamlEnabled={data.yamlSettings?.selector}
        onYamlToggle={() => toggleYaml('selector')}
        disableYamlToggle={Boolean(data.selector) === false}
      >
        <div ref={selectorDropdownRef} className="relative w-full">
          <button
            type="button"
            onClick={() => setIsSelectorDropdownOpen((prev) => !prev)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-mono transition-all cursor-pointer shadow-sm",
              colorMode === 'dark'
                ? "bg-slate-900/90 border-slate-700 text-slate-100 hover:border-slate-600 focus:border-amber-500/80"
                : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-amber-500/80"
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span
                className={cn(
                  "font-semibold truncate",
                  isSelectorValid ? "text-amber-500" : "text-rose-400 font-mono tracking-widest"
                )}
              >
                {isSelectorValid ? currentSelector : '---'}
              </span>
            </div>
            <ChevronDown size={14} className={cn("transition-transform duration-200 opacity-60 shrink-0", isSelectorDropdownOpen && "rotate-180")} />
          </button>

          {isSelectorDropdownOpen && (
            <div
              className={cn(
                "absolute left-0 right-0 top-full mt-1.5 z-50 rounded-md border shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto",
                colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
              )}
            >
              {availableWorkloadLabels.length === 0 ? (
                <div className="p-3 text-center text-xs opacity-60 flex items-center justify-center gap-1.5 font-sans">
                  <AlertCircle size={14} className="text-amber-500 shrink-0" />
                  <span>No active workloads on canvas</span>
                </div>
              ) : (
                availableWorkloadLabels.map((label) => {
                  const isSelected = currentSelector === label;

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        performUpdate({ selector: label });
                        setIsSelectorDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between gap-2 font-mono group cursor-pointer",
                        getWorkloadSelectorOptionClasses(isSelected, colorMode)
                      )}
                    >
                      <span className="truncate">{label}</span>
                      {isSelected && <Check size={14} className="text-amber-500 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </ConfigSection>
    </div>
  );
};
