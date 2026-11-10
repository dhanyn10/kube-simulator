import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { Network, Box, Server, ChevronDown, Check, Lock, AlertTriangle } from 'lucide-react';
import { ConfigSection } from '@/components/UI/ConfigUI';
import { cn } from '@/lib/utils';
import { resolveNodeNamespace } from '@/lib/namespaceUtils';
import { ExternalTrafficPolicySection, EntryNodeSection } from './ServiceWorkerConfigSections';

interface ServiceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

interface ServiceTypeOption {
  value: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'Headless';
  label: string;
  description: string;
  disabled?: boolean;
}

interface SelectorDropdownOption {
  label: string;
  category: 'INGRESS' | 'POD' | 'DEPLOYMENT' | 'REPLICASET' | 'STATEFULSET';
  port?: number;
}

export const SERVICE_TYPE_OPTIONS: ServiceTypeOption[] = [
  { value: 'ClusterIP', label: 'ClusterIP', description: 'Exposes service on an internal IP in the cluster (Default).' },
  { value: 'NodePort', label: 'NodePort', description: 'Exposes service on each Node’s IP at a static port.' },
  { value: 'LoadBalancer', label: 'LoadBalancer', description: 'Exposes service externally using cloud provider’s load balancer.' },
  { value: 'Headless', label: 'Headless', description: 'No virtual IP allocated (clusterIP: None). Required for StatefulSet ordinal pod DNS.' }
];

const WORKLOAD_TYPES = new Set(['Deployment', 'StatefulSet', 'ReplicaSet']);

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
  return getServiceTypeOptionClasses(false, isSelected, colorMode);
};

const getDropdownTriggerClasses = (colorMode: string): string => {
  return colorMode === 'dark'
    ? 'bg-slate-900/90 border-slate-700 text-slate-100 hover:border-slate-600 focus:border-amber-500/80'
    : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-amber-500/80';
};

const getDropdownMenuClasses = (colorMode: string): string => {
  return colorMode === 'dark'
    ? 'bg-slate-900 border-slate-800 text-slate-200'
    : 'bg-white border-slate-200 text-slate-800';
};

const getInputFieldClasses = (colorMode: string): string => {
  return colorMode === 'dark'
    ? 'bg-slate-800 border-slate-700 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';
};

const getCategoryBadgeClasses = (category: string): string => {
  return category === 'INGRESS'
    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
};

const isNodeInServiceScope = (
  candidateNode: any,
  selectedNamespace: string,
  currentServiceType: string,
  nodes: any[]
): boolean => {
  if (currentServiceType === 'LoadBalancer' && candidateNode.type === 'Ingress') return true;
  const candidateNamespace = resolveNodeNamespace(candidateNode, nodes);
  return selectedNamespace === candidateNamespace;
};

const isSelectableWorkloadNode = (candidateNode: any, nodes?: any[]): boolean => {
  if (WORKLOAD_TYPES.has(candidateNode.type)) return true;
  if (candidateNode.type !== 'Pod') return false;
  if (!candidateNode.parentId && !candidateNode.data?.parentId) return true;
  const parentNode = nodes?.find((p) => p.id === (candidateNode.parentId || candidateNode.data?.parentId));
  return parentNode?.type === 'Namespace';
};

const getNodeLabel = (targetNode: any): string => {
  return (targetNode.data?.label as string) || (targetNode.data?.baseName as string) || targetNode.id || '';
};

const toSelectorOption = (
  candidateNode: any,
  currentServiceType: string,
  nodes?: any[]
): SelectorDropdownOption | null => {
  const label = getNodeLabel(candidateNode);
  if (!label) return null;

  if (currentServiceType === 'LoadBalancer' && candidateNode.type === 'Ingress') {
    return { label, category: 'INGRESS' };
  }

  if (!isSelectableWorkloadNode(candidateNode, nodes)) return null;
  const isStateful = candidateNode.type === 'StatefulSet' || candidateNode.data?.workloadType === 'StatefulSet';
  const category = (isStateful ? 'STATEFULSET' : candidateNode.type.toUpperCase()) as 'POD' | 'DEPLOYMENT' | 'REPLICASET' | 'STATEFULSET';
  const port = Number(candidateNode.data?.port) || undefined;
  return { label, category, port };
};

const buildServiceSelectorOptions = (
  selectedNode: any,
  nodes: any[],
  currentServiceType: string
): SelectorDropdownOption[] => {
  const selectedNamespace = resolveNodeNamespace(selectedNode, nodes);
  const optionsMap = new Map<string, SelectorDropdownOption>();

  for (const candidateNode of nodes) {
    if (isNodeInServiceScope(candidateNode, selectedNamespace, currentServiceType, nodes)) {
      const selectorOption = toSelectorOption(candidateNode, currentServiceType, nodes);
      if (selectorOption && !optionsMap.has(selectorOption.label)) {
        optionsMap.set(selectorOption.label, selectorOption);
      }
    }
  }

  return Array.from(optionsMap.values());
};

const resolveActiveIngressTargets = (
  data: any,
  currentServiceType: string,
  availableOptions: SelectorDropdownOption[]
): string[] => {
  if (currentServiceType !== 'LoadBalancer') return [];
  const validIngressLabels = new Set(
    availableOptions.filter((o) => o.category === 'INGRESS').map((o) => o.label)
  );
  if (Array.isArray(data.ingressTargets) && data.ingressTargets.length > 0) {
    return data.ingressTargets.filter((lbl: string) => validIngressLabels.has(lbl));
  }
  if (data.selector && validIngressLabels.has(data.selector)) {
    return [data.selector];
  }
  return [];
};

const buildSelectorUpdatePatch = (
  opt: SelectorDropdownOption,
  data: any,
  activeIngressTargets: string[]
): Record<string, any> => {
  if (opt.category === 'INGRESS') {
    const nextIngressTargets = activeIngressTargets.includes(opt.label)
      ? activeIngressTargets.filter((t) => t !== opt.label)
      : [...activeIngressTargets, opt.label];
    return {
      selector: nextIngressTargets[0] || '',
      ingressTargets: nextIngressTargets.length > 0 ? nextIngressTargets : undefined,
    };
  }
  const isStateful = opt.category === 'STATEFULSET';
  const shouldAutoHeadless = isStateful && (!data.serviceType || data.serviceType === 'ClusterIP');

  return {
    selector: opt.label,
    ...(data.ingressTargets !== undefined ? { ingressTargets: undefined } : {}),
    ...(opt.port ? { targetPort: opt.port } : {}),
    ...(shouldAutoHeadless ? { serviceType: 'Headless' } : {}),
  };
};

const resolveDisplaySelectorInfo = (
  currentSelector: string,
  availableOptions: SelectorDropdownOption[],
  activeIngressTargets: string[]
): {
  isSelectorValid: boolean;
  displaySelectorText: string;
  displayCategory: string | undefined;
} => {
  const selectedOptionObj = availableOptions.find((opt) => opt.label === currentSelector);
  const hasMultiIngress = activeIngressTargets.length > 0;
  const isSelectorValid = hasMultiIngress || Boolean(currentSelector && selectedOptionObj);

  let displaySelectorText = '---';
  if (hasMultiIngress) {
    displaySelectorText = activeIngressTargets.join(', ');
  } else if (isSelectorValid) {
    displaySelectorText = currentSelector;
  }

  const displayCategory = hasMultiIngress ? 'INGRESS' : selectedOptionObj?.category;
  return { isSelectorValid, displaySelectorText, displayCategory };
};

const ServiceTypeOptionItem = ({
  option,
  currentServiceType,
  isInsideNamespace,
  colorMode,
  onSelect,
}: {
  option: ServiceTypeOption;
  currentServiceType: string;
  isInsideNamespace: boolean;
  colorMode: string;
  onSelect: (value: ServiceTypeOption['value']) => void;
}) => {
  const isSelected = currentServiceType === option.value;
  const isLockedInNamespace = option.value === 'LoadBalancer' && isInsideNamespace;
  const isDisabled = Boolean(option.disabled || isLockedInNamespace);
  const lockLabel = isLockedInNamespace ? 'Outside Namespace Only' : 'Disabled';

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) {
          onSelect(option.value);
        }
      }}
      className={cn(
        'w-full text-left p-2 rounded text-xs transition-colors flex items-start justify-between gap-2 group',
        getServiceTypeOptionClasses(isDisabled, isSelected, colorMode)
      )}
    >
      <div className="space-y-0.5 pr-1">
        <div className="flex items-center gap-1.5 font-medium font-mono flex-wrap">
          <span>{option.label}</span>
          {isDisabled && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-sans uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Lock size={10} /> {lockLabel}
            </span>
          )}
        </div>
        <p className="text-[10px] opacity-60 leading-tight font-sans">{option.description}</p>
      </div>
      {isSelected && <Check size={14} className="text-amber-500 shrink-0 mt-0.5" />}
    </button>
  );
};

const ServiceTypeDropdown = ({
  dropdownRef,
  isOpen,
  setIsOpen,
  currentServiceType,
  isInsideNamespace,
  colorMode,
  performUpdate,
}: {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentServiceType: string;
  isInsideNamespace: boolean;
  colorMode: string;
  performUpdate: (updates: any) => void;
}) => {
  const selectedServiceTypeOption =
    SERVICE_TYPE_OPTIONS.find((opt) => opt.value === currentServiceType) || SERVICE_TYPE_OPTIONS[0];

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-mono transition-all cursor-pointer shadow-sm',
          getDropdownTriggerClasses(colorMode)
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-500">{selectedServiceTypeOption.label}</span>
        </div>
        <ChevronDown size={14} className={cn('transition-transform duration-200 opacity-60', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full mt-1.5 z-50 rounded-md border shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100',
            getDropdownMenuClasses(colorMode)
          )}
        >
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <ServiceTypeOptionItem
              key={option.value}
              option={option}
              currentServiceType={currentServiceType}
              isInsideNamespace={isInsideNamespace}
              colorMode={colorMode}
              onSelect={(value) => {
                performUpdate({ serviceType: value });
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ServiceSelectorOptionItem = ({
  opt,
  activeIngressTargets,
  currentSelector,
  colorMode,
  onSelect,
}: {
  opt: SelectorDropdownOption;
  activeIngressTargets: string[];
  currentSelector: string;
  colorMode: string;
  onSelect: (opt: SelectorDropdownOption) => void;
}) => {
  const isSelected =
    opt.category === 'INGRESS'
      ? activeIngressTargets.includes(opt.label)
      : currentSelector === opt.label;

  return (
    <button
      type="button"
      onClick={() => onSelect(opt)}
      className={cn(
        'w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between gap-2 font-mono group cursor-pointer',
        getWorkloadSelectorOptionClasses(isSelected, colorMode)
      )}
    >
      <span className="truncate">{opt.label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            'text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider',
            getCategoryBadgeClasses(opt.category)
          )}
        >
          {opt.category}
        </span>
        {isSelected && <Check size={14} className="text-amber-500 shrink-0" />}
      </div>
    </button>
  );
};

const ServiceSelectorDropdown = ({
  dropdownRef,
  isOpen,
  setIsOpen,
  availableOptions,
  activeIngressTargets,
  currentSelector,
  data,
  colorMode,
  performUpdate,
}: {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  availableOptions: SelectorDropdownOption[];
  activeIngressTargets: string[];
  currentSelector: string;
  data: any;
  colorMode: string;
  performUpdate: (updates: any) => void;
}) => {
  const { isSelectorValid, displaySelectorText, displayCategory } = resolveDisplaySelectorInfo(
    currentSelector,
    availableOptions,
    activeIngressTargets
  );

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-mono transition-all cursor-pointer shadow-sm',
          getDropdownTriggerClasses(colorMode)
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={cn(
              'font-semibold truncate',
              isSelectorValid ? 'text-amber-500' : 'text-rose-400 font-mono tracking-widest'
            )}
          >
            {displaySelectorText}
          </span>
          {displayCategory && (
            <span
              className={cn(
                'text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider shrink-0',
                getCategoryBadgeClasses(displayCategory)
              )}
            >
              {displayCategory}
            </span>
          )}
        </div>
        <ChevronDown size={14} className={cn('transition-transform duration-200 opacity-60 shrink-0', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full mt-1.5 z-50 rounded-md border shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto',
            getDropdownMenuClasses(colorMode)
          )}
        >
          {availableOptions.map((opt) => (
            <ServiceSelectorOptionItem
              key={`${opt.category}-${opt.label}`}
              opt={opt}
              activeIngressTargets={activeIngressTargets}
              currentSelector={currentSelector}
              colorMode={colorMode}
              onSelect={(selectedOpt) => {
                performUpdate(buildSelectorUpdatePatch(selectedOpt, data, activeIngressTargets));
                if (selectedOpt.category !== 'INGRESS') {
                  setIsOpen(false);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Configuration component for Kubernetes Service resources.
 *
 * @param props - Component properties including update and toggle handlers.
 */
interface HeadlessRecommendationBannerProps {
  colorMode: string;
  targetSelector: string;
  onSwitchToHeadless: () => void;
}

const HeadlessRecommendationBanner = ({
  colorMode,
  targetSelector,
  onSwitchToHeadless,
}: HeadlessRecommendationBannerProps) => (
  <div
    data-testid="headless-recommendation-banner"
    className={cn(
      "p-2.5 rounded-lg border text-xs leading-tight flex flex-col gap-2",
      colorMode === 'dark'
        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
        : "bg-amber-50 border-amber-200 text-amber-800"
    )}
  >
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
      <div className="space-y-1">
        <div className="font-semibold text-xs">Headless Service Recommendation</div>
        <p className="text-[11px] opacity-90 leading-relaxed font-sans">
          Targeting StatefulSet &quot;{targetSelector}&quot;. StatefulSets require a Headless Service (clusterIP: None) for pod ordinal DNS resolution.
        </p>
      </div>
    </div>
    <button
      type="button"
      data-testid="switch-to-headless-btn"
      onClick={onSwitchToHeadless}
      className={cn(
        "self-start px-2.5 py-1 rounded text-[11px] font-semibold transition-colors border shadow-sm",
        colorMode === 'dark'
          ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40"
          : "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
      )}
    >
      Switch to Headless Mode
    </button>
  </div>
);

const isTargetStatefulSet = (
  currentSelector: string,
  availableOptions: SelectorDropdownOption[],
  nodes: any[]
): boolean => {
  if (!currentSelector) return false;
  const targetOption = availableOptions.find((opt) => opt.label === currentSelector);
  if (targetOption?.category === 'STATEFULSET') return true;
  return nodes.some(
    (n) =>
      ((n.data?.label as string) === currentSelector || n.id === currentSelector || (n.data?.baseName as string) === currentSelector) &&
      (n.type === 'StatefulSet' || n.data?.workloadType === 'StatefulSet')
  );
};

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
  const isInsideNamespace = Boolean(selectedNode.parentId || selectedNode.data?.parentId);

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

  const availableOptions = buildServiceSelectorOptions(selectedNode, nodes, currentServiceType);
  const activeIngressTargets = resolveActiveIngressTargets(data, currentServiceType, availableOptions);
  const currentSelector = data.selector || '';
  const isTargetingStatefulSet = isTargetStatefulSet(currentSelector, availableOptions, nodes);
  const isNodePortOutOfRange = data.nodePort !== undefined && (data.nodePort < 30000 || data.nodePort > 32767);
  const inputFieldClasses = getInputFieldClasses(colorMode);

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
        <ServiceTypeDropdown
          dropdownRef={serviceTypeDropdownRef}
          isOpen={isServiceTypeDropdownOpen}
          setIsOpen={setIsServiceTypeDropdownOpen}
          currentServiceType={currentServiceType}
          isInsideNamespace={isInsideNamespace}
          colorMode={colorMode}
          performUpdate={performUpdate}
        />
      </ConfigSection>

      {/* Headless Recommendation Banner when targeting a StatefulSet with non-Headless serviceType */}
      {isTargetingStatefulSet && currentServiceType !== 'Headless' && (
        <HeadlessRecommendationBanner
          colorMode={colorMode}
          targetSelector={currentSelector}
          onSwitchToHeadless={() => performUpdate({ serviceType: 'Headless' })}
        />
      )}

      {/* NodePort Configuration (Only for NodePort or LoadBalancer) */}
      {showNodePort && (
        <>
          <ConfigSection
            title="NodePort"
            icon={Network}
            isVisible={data.displaySettings?.nodePort}
            onToggle={() => toggleVisibility('nodePort')}
            isYamlEnabled={data.yamlSettings?.nodePort}
            onYamlToggle={() => toggleYaml('nodePort')}
            disableYamlToggle={Boolean(data.nodePort) === false}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={30000}
                  max={32767}
                  value={data.nodePort ?? ''}
                  onChange={(e: any) => performUpdate({ nodePort: e.target.value ? Number.parseInt(e.target.value, 10) : undefined })}
                  placeholder="30000-32767 (Optional)"
                  className={cn(
                    'w-full text-[10px] p-2 rounded border outline-none font-mono',
                    inputFieldClasses,
                    isNodePortOutOfRange && '!border-rose-500 !focus:ring-rose-500/50'
                  )}
                />
                {data.nodePort !== undefined && (
                  <button
                    type="button"
                    onClick={() => performUpdate({ nodePort: undefined })}
                    className={cn(
                      "px-2 py-1.5 rounded text-[10px] font-medium border transition-colors whitespace-nowrap",
                      colorMode === 'dark'
                        ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                    title="Reset to automatic NodePort allocation"
                    data-testid="nodeport-auto-btn"
                  >
                    Auto
                  </button>
                )}
              </div>

              {/* Interactive Range Slider (30000 - 32767) */}
              <div className="space-y-1 pt-0.5">
                <input
                  type="range"
                  min={30000}
                  max={32767}
                  step={1}
                  value={data.nodePort ?? 30000}
                  onChange={(e: any) => performUpdate({ nodePort: Number.parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  data-testid="nodeport-range-slider"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>30000</span>
                  <span className="text-[10px] text-purple-400 font-semibold font-sans">
                    {data.nodePort ? `Port: ${data.nodePort}` : 'Auto (30000 - 32767)'}
                  </span>
                  <span>32767</span>
                </div>
              </div>

              {isNodePortOutOfRange && (
                <div
                  data-testid="nodeport-range-error"
                  className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1 font-sans"
                >
                  <AlertTriangle size={12} className="shrink-0 text-rose-400" />
                  <span>NodePort must be between 30000 and 32767</span>
                </div>
              )}
            </div>
          </ConfigSection>

          <ExternalTrafficPolicySection
            data={data}
            colorMode={colorMode}
            performUpdate={performUpdate}
            toggleVisibility={toggleVisibility}
            toggleYaml={toggleYaml}
          />

          {currentServiceType === 'NodePort' && (
            <EntryNodeSection
              data={data}
              colorMode={colorMode}
              performUpdate={performUpdate}
              toggleVisibility={toggleVisibility}
            />
          )}
        </>
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
          className={cn('w-full text-[10px] p-2 rounded border outline-none font-mono', inputFieldClasses)}
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
          className={cn('w-full text-[10px] p-2 rounded border outline-none font-mono', inputFieldClasses)}
        />
      </ConfigSection>

      {/* Selector Configuration Dropdown (Only rendered when matching options exist on canvas in same namespace) */}
      {availableOptions.length > 0 && (
        <ConfigSection
          title={
            currentServiceType === 'LoadBalancer' &&
            (Boolean(data.ingressTargets?.length) || availableOptions.some((opt) => opt.category === 'INGRESS' && opt.label === currentSelector))
              ? "Routing Target"
              : "Selector (app)"
          }
          icon={Box}
          isVisible={data.displaySettings?.selector}
          onToggle={() => toggleVisibility('selector')}
          isYamlEnabled={data.yamlSettings?.selector}
          onYamlToggle={() => toggleYaml('selector')}
          disableYamlToggle={Boolean(data.selector) === false}
        >
          <ServiceSelectorDropdown
            dropdownRef={selectorDropdownRef}
            isOpen={isSelectorDropdownOpen}
            setIsOpen={setIsSelectorDropdownOpen}
            availableOptions={availableOptions}
            activeIngressTargets={activeIngressTargets}
            currentSelector={currentSelector}
            data={data}
            colorMode={colorMode}
            performUpdate={performUpdate}
          />
        </ConfigSection>
      )}
    </div>
  );
};
