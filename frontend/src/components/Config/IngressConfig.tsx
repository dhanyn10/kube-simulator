import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { Globe, Code, Server, ChevronDown, Check } from 'lucide-react';
import { ConfigInput, ConfigSection, AdvancedSection } from '@/components/UI/ConfigUI';
import { cn } from '@/lib/utils';

interface IngressConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Configuration component for Kubernetes Ingress resources.
 *
 * @param props - Component properties for handling updates and UI toggles.
 */
export const IngressConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: IngressConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const data = selectedNode.data;

  const [isBackendDropdownOpen, setIsBackendDropdownOpen] = useState(false);
  const backendDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (backendDropdownRef.current && !backendDropdownRef.current.contains(event.target as Node)) {
        setIsBackendDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  const isBackendValid = currentBackend && availableServiceNames.includes(currentBackend);

  return (
    <div className="space-y-4">
      {/* Backend Service Selection Dropdown (Only rendered when ClusterIP services exist in same namespace) */}
      {availableServiceNames.length > 0 && (
        <ConfigSection
          title="Backend Service (ClusterIP)"
          icon={Server}
          isVisible={data.displaySettings?.backendService}
          onToggle={() => toggleVisibility('backendService')}
          isYamlEnabled={data.yamlSettings?.backendService}
          onYamlToggle={() => toggleYaml('backendService')}
          disableYamlToggle={Boolean(data.backendServiceName) === false}
        >
          <div ref={backendDropdownRef} className="relative w-full">
            <button
              type="button"
              onClick={() => setIsBackendDropdownOpen((prev) => !prev)}
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
              <ChevronDown size={14} className={cn("transition-transform duration-200 opacity-60 shrink-0", isBackendDropdownOpen && "rotate-180")} />
            </button>

            {isBackendDropdownOpen && (
              <div
                className={cn(
                  "absolute left-0 right-0 top-full mt-1.5 z-50 rounded-md border shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                )}
              >
                {availableServiceNames.map((svcName) => {
                  const isSelected = currentBackend === svcName;

                  const getSelectedStyles = (mode: string) =>
                    mode === 'dark'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-rose-50 text-rose-800 border border-rose-200';

                  const getUnselectedStyles = (mode: string) =>
                    mode === 'dark'
                      ? 'hover:bg-slate-800 hover:text-white'
                      : 'hover:bg-slate-100 hover:text-slate-900';

                  const buttonClassName = isSelected
                    ? getSelectedStyles(colorMode)
                    : getUnselectedStyles(colorMode);

                  return (
                    <button
                      key={svcName}
                      type="button"
                      onClick={() => {
                        performUpdate({ backendServiceName: svcName });
                        setIsBackendDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between gap-2 font-mono group cursor-pointer",
                        buttonClassName
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

      <AdvancedSection colorMode={colorMode}>
        <ConfigSection
          title="Path"
          icon={Code}
          isVisible={data.displaySettings?.path}
          onToggle={() => toggleVisibility('path')}
          isYamlEnabled={data.yamlSettings?.path}
          onYamlToggle={() => toggleYaml('path')}
          disableYamlToggle={!data.ingressPath}
        >
          <ConfigInput
            value={data.ingressPath || ''}
            onChange={(e: any) => performUpdate({ ingressPath: e.target.value })}
            placeholder="/"
            colorMode={colorMode}
          />
        </ConfigSection>
      </AdvancedSection>
    </div>
  );
};
