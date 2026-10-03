import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { Database, ShieldCheck, AlertTriangle } from 'lucide-react';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { AdvancedSection, ConfigSection, ConfigInput } from '@/components/UI/ConfigUI';
import { calculatePvcConnectedReplicas } from '@/activities/config/pvcConfigHelpers';

interface PVCConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

/**
 * Configuration component for PersistentVolumeClaim (PVC) resources.
 *
 * @param props - Component properties for handling updates and UI toggles.
 */
export const PVCConfig = ({
  selectedNode,
  performUpdate,
  toggleVisibility,
  toggleYaml
}: PVCConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const data = selectedNode.data;

  const totalConnectedReplicas = calculatePvcConnectedReplicas(selectedNode.id, nodes, edges);
  const isRwoDisabled = totalConnectedReplicas > 1;

  const accessModes = [
    { value: 'ReadWriteOnce', label: 'RWO', desc: 'ReadWriteOnce: Accessible by 1 Pod (Read/Write)' },
    { value: 'ReadOnlyMany', label: 'ROX', desc: 'ReadOnlyMany: Multiple Pods can read-only' },
    { value: 'ReadWriteMany', label: 'RWX', desc: 'ReadWriteMany: Multiple Pods can Read/Write' },
  ];

  return (
    <div className="space-y-4">
      {/* Storage Capacity Section */}
      <ConfigSection title="Storage Capacity" icon={Database}>
        <div className="space-y-2">
          <SelectorGroup
            options={[
              { label: '1Gi', value: '1Gi' },
              { label: '5Gi', value: '5Gi' },
              { label: '10Gi', value: '10Gi' }
            ]}
            currentValue={data.storageCapacity}
            onSelect={(size) => performUpdate({ storageCapacity: size })}
            colorMode={colorMode}
            activeColorClass="bg-orange-500 border-orange-500"
            activeShadowClass="shadow-lg shadow-orange-500/20"
          />
          <ConfigInput
            value={data.storageCapacity || '1Gi'}
            onChange={(e: any) => performUpdate({ storageCapacity: e.target.value })}
            placeholder="Custom (e.g., 20Gi)"
            colorMode={colorMode}
          />
        </div>
      </ConfigSection>

      {/* Access Mode Selection */}
      <ConfigSection title="Access Mode" icon={ShieldCheck}>
        <div className="flex flex-col gap-2">
          {accessModes.map((mode) => {
            const isActive = data.accessMode === mode.value;
            const isRwoOption = mode.value === 'ReadWriteOnce';
            const isDisabledOption = isRwoOption && isRwoDisabled;

            let modeClasses = "";
            if (isDisabledOption) {
              modeClasses = colorMode === 'dark'
                ? "bg-slate-800/40 border-slate-700/40 text-slate-600 opacity-50 cursor-not-allowed pointer-events-none"
                : "bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed pointer-events-none";
            } else if (isActive) {
              modeClasses = "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20";
            } else if (colorMode === 'dark') {
              modeClasses = "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500";
            } else {
              modeClasses = "bg-white border-slate-200 text-slate-600 hover:border-slate-300";
            }

            return (
              <div key={mode.value} className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={isDisabledOption}
                  onClick={() => !isDisabledOption && performUpdate({ accessMode: mode.value })}
                  className={cn(
                    "flex flex-col items-start p-2 rounded border text-left transition-all w-full",
                    modeClasses
                  )}
                >
                  <span className="text-[10px] font-bold">{mode.label}</span>
                  <span className={cn(
                    "text-[8px] leading-tight mt-0.5",
                    data.accessMode === mode.value && !isDisabledOption ? "text-orange-100" : "text-slate-500"
                  )}>
                    {mode.desc}
                  </span>
                </button>

                {isDisabledOption && (
                  <div className={cn(
                    "p-2 rounded text-[9px] border leading-tight flex items-start gap-1.5",
                    colorMode === 'dark'
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  )}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      <strong>RWO Disabled:</strong> ReadWriteOnce allows maximum 1 replica, but connected workload currently has {totalConnectedReplicas} replicas.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ConfigSection>

      {/* Advanced PVC Settings */}
      <AdvancedSection colorMode={colorMode}>
        <ConfigSection
          title="Storage Class"
          icon={Database}
          isVisible={data.displaySettings?.storageClass}
          onToggle={() => toggleVisibility('storageClass')}
          isYamlEnabled={data.yamlSettings?.storageClass}
          onYamlToggle={() => toggleYaml('storageClass')}
        >
          <select
            value={data.storageClass || 'standard'}
            onChange={(e) => performUpdate({ storageClass: e.target.value })}
            className={cn(
              "w-full text-[10px] p-2 rounded border outline-none",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
            )}
          >
            <option value="standard">Standard (HDD)</option>
            <option value="ssd">Fast (SSD)</option>
            <option value="cloud-nfs">Cloud Storage (NFS)</option>
            <option value="local-storage">Local Storage</option>
          </select>
        </ConfigSection>
      </AdvancedSection>
    </div>
  );
};
