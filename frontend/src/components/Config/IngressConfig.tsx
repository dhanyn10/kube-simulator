import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { Globe, Code, Server, ChevronDown, Check, Plus } from 'lucide-react';
import { IngressPathsModal } from '@/components/Modals/IngressPathsModal';
import { ConfigInput, ConfigSection } from '@/components/UI/ConfigUI';
import { cn } from '@/lib/utils';

interface IngressConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

const getIngressClassButtonStyles = (isSelected: boolean, colorMode: 'dark' | 'light'): string => {
  if (isSelected) {
    return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  }
  return colorMode === 'dark'
    ? 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
    : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900';
};

const getDropdownItemStyles = (isSelected: boolean, colorMode: 'dark' | 'light'): string => {
  if (isSelected) {
    return colorMode === 'dark'
      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      : 'bg-rose-50 text-rose-800 border border-rose-200';
  }
  return colorMode === 'dark'
    ? 'hover:bg-slate-800 hover:text-white'
    : 'hover:bg-slate-100 hover:text-slate-900';
};

interface BackendServiceDropdownProps {
  readonly colorMode: 'dark' | 'light';
  readonly availableServiceNames: string[];
  readonly currentBackend: string;
  readonly isBackendValid: boolean;
  readonly onSelect: (svcName: string) => void;
}

const BackendServiceDropdown = ({
  colorMode,
  availableServiceNames,
  currentBackend,
  isBackendValid,
  onSelect,
}: BackendServiceDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-mono transition-all cursor-pointer shadow-sm",
          colorMode === 'dark'
            ? "bg-slate-900/90 border-slate-700 text-slate-100 hover:border-slate-600 focus:border-rose-500/80"
            : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-rose-500/80"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={cn(
              "font-semibold truncate",
              isBackendValid ? "text-rose-500" : "text-rose-400 font-mono tracking-widest"
            )}
          >
            {isBackendValid ? currentBackend : '---'}
          </span>
          {isBackendValid && (
            <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              SERVICE
            </span>
          )}
        </div>
        <ChevronDown size={14} className={cn("transition-transform duration-200 opacity-60 shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full mt-1.5 z-50 rounded-md border shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto",
            colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
          )}
        >
          {availableServiceNames.map((svcName) => {
            const isSelected = currentBackend === svcName;
            return (
              <button
                key={svcName}
                type="button"
                onClick={() => {
                  onSelect(svcName);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between gap-2 font-mono group cursor-pointer",
                  getDropdownItemStyles(isSelected, colorMode)
                )}
              >
                <span className="truncate">{svcName}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    SERVICE
                  </span>
                  {isSelected && <Check size={14} className="text-rose-500 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Configuration component for Kubernetes Ingress resources.
 *
 * @param props - Component properties for handling updates and UI toggles.
 */
export const IngressConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: IngressConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const data = selectedNode.data;

  const [isPathsModalOpen, setIsPathsModalOpen] = useState(false);

  // Filter for ClusterIP services in the same namespace
  const selectedNamespaceId = selectedNode.parentId || selectedNode.data?.parentId || null;
  const inSameNamespace = (n: any) => {
    if (!selectedNamespaceId) {
      return !n.parentId || n.parentId === '';
    }
    return n.parentId === selectedNamespaceId;
  };

  const clusterIpServices = nodes.filter(
    (n) => n.type === 'Service' && (n.data?.serviceType || 'ClusterIP') === 'ClusterIP' && inSameNamespace(n)
  );

  const availableServiceNames = Array.from(
    new Set(
      clusterIpServices
        .map((n) => (n.data?.label as string) || n.id)
        .filter(Boolean)
    )
  );

  const currentBackend = data.backendServiceName || '';
  const isBackendValid = Boolean(currentBackend && availableServiceNames.includes(currentBackend));
  const hasMultiplePaths = Array.isArray(data.ingressPaths) && data.ingressPaths.length > 1;

  return (
    <div className="space-y-4">
      {/* Backend Service Selection Dropdown (Hidden when multiple paths exist since each path configures its own service) */}
      {availableServiceNames.length > 0 && !hasMultiplePaths && (
        <ConfigSection
          title="Backend Service (ClusterIP)"
          icon={Server}
          isVisible={data.displaySettings?.backendService}
          onToggle={() => toggleVisibility('backendService')}
          isYamlEnabled={data.yamlSettings?.backendService}
          onYamlToggle={() => toggleYaml('backendService')}
          disableYamlToggle={Boolean(data.backendServiceName) === false}
        >
          <BackendServiceDropdown
            colorMode={colorMode}
            availableServiceNames={availableServiceNames}
            currentBackend={currentBackend}
            isBackendValid={isBackendValid}
            onSelect={(svcName) => {
              const updatedSinglePaths =
                Array.isArray(data.ingressPaths) && data.ingressPaths.length === 1
                  ? [{ ...data.ingressPaths[0], serviceName: svcName }]
                  : data.ingressPaths;
              performUpdate({
                backendServiceName: svcName,
                ...(updatedSinglePaths ? { ingressPaths: updatedSinglePaths } : {}),
              });
            }}
          />
        </ConfigSection>
      )}

      <ConfigSection
        title="Host"
        icon={Globe}
        isVisible={data.displaySettings?.host}
        onToggle={() => toggleVisibility('host')}
      >
        <ConfigInput
          value={data.ingressHost || ''}
          onChange={(e: any) => performUpdate({ ingressHost: e.target.value })}
          placeholder="example.com"
          colorMode={colorMode}
        />
      </ConfigSection>

      <ConfigSection
        title="Ingress Class"
        icon={Server}
        isVisible={data.displaySettings?.ingressClassName}
        onToggle={() => toggleVisibility('ingressClassName')}
      >
        <div className="flex gap-1.5 flex-wrap">
          {['nginx', 'traefik'].map((cls) => {
            const isSelected = (data.ingressClassName || 'nginx') === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => performUpdate({ ingressClassName: cls })}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer border",
                  getIngressClassButtonStyles(isSelected, colorMode)
                )}
              >
                {cls}
              </button>
            );
          })}
        </div>
      </ConfigSection>

      <ConfigSection
        title="Path"
        icon={Code}
        isVisible={data.displaySettings?.path}
        onToggle={() => toggleVisibility('path')}
        isYamlEnabled={data.yamlSettings?.path}
        onYamlToggle={() => toggleYaml('path')}
        disableYamlToggle={!data.ingressPath && (!Array.isArray(data.ingressPaths) || data.ingressPaths.length === 0)}
      >
        <div className="space-y-2">
          {!hasMultiplePaths ? (
            <ConfigInput
              value={data.ingressPath || ''}
              onChange={(e: any) => performUpdate({ ingressPath: e.target.value })}
              placeholder="/"
              colorMode={colorMode}
            />
          ) : (
            <div className="space-y-1">
              {data.ingressPaths.map((p: any) => (
                <div
                  key={`block-path-${p.id || p.path}`}
                  className={cn(
                    "block w-full px-2.5 py-1 rounded text-[10px] font-mono border transition-colors",
                    colorMode === 'dark'
                      ? "bg-slate-900 border-slate-800 text-rose-400"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.path}</span>
                    {p.serviceName && (
                      <span className="text-[9px] opacity-70 font-sans">
                        → {p.serviceName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsPathsModalOpen(true)}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded border text-[11px] font-medium transition-all cursor-pointer",
              colorMode === 'dark'
                ? "border-dashed border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400"
                : "border-dashed border-slate-300 hover:border-rose-500/50 hover:bg-rose-50 text-slate-600 hover:text-rose-700"
            )}
          >
            <Plus size={13} />
            <span>
              {hasMultiplePaths
                ? `Manage Paths (${data.ingressPaths.length} paths)`
                : 'Add more paths...'}
            </span>
          </button>
        </div>
      </ConfigSection>

      <IngressPathsModal
        isOpen={isPathsModalOpen}
        onClose={() => setIsPathsModalOpen(false)}
        ingressNode={selectedNode}
        onSave={(paths) => {
          performUpdate({
            ingressPaths: paths,
            ingressPath: paths[0]?.path || data.ingressPath || '/',
            backendServiceName: paths[0]?.serviceName || data.backendServiceName,
            servicePort: paths[0]?.servicePort || data.servicePort || 80,
          });
        }}
      />
    </div>
  );
};
