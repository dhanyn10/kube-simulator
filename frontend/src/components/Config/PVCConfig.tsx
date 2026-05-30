import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { Database, ShieldCheck } from 'lucide-react';
import { SelectorGroup } from '../UI/SelectorGroup';
import { AdvancedSection, ConfigSection, ConfigInput } from '../UI/ConfigUI';

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
  const data = selectedNode.data;

  const accessModes = [
    { value: 'ReadWriteOnce', label: 'RWO', desc: 'ReadWriteOnce: Bisa diakses 1 Pod (Read/Write)' },
    { value: 'ReadOnlyMany', label: 'ROX', desc: 'ReadOnlyMany: Banyak Pod bisa baca saja' },
    { value: 'ReadWriteMany', label: 'RWX', desc: 'ReadWriteMany: Banyak Pod bisa Read/Write' },
  ];

  return (
    <div className="space-y-4">
      {/* Storage Capacity Section */}
      <ConfigSection title="Kapasitas (Storage)" icon={Database}>
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
            placeholder="Custom (misal: 20Gi)"
            colorMode={colorMode}
          />
        </div>
      </ConfigSection>

      {/* Access Mode Selection */}
      <ConfigSection title="Mode Akses" icon={ShieldCheck}>
        <div className="flex flex-col gap-2">
          {accessModes.map((mode) => {
            const isActive = data.accessMode === mode.value;
            let modeClasses = "";
            if (isActive) {
              modeClasses = "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20";
            } else if (colorMode === 'dark') {
              modeClasses = "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500";
            } else {
              modeClasses = "bg-white border-slate-200 text-slate-600 hover:border-slate-300";
            }

            return (
              <button
                key={mode.value}
                onClick={() => performUpdate({ accessMode: mode.value })}
                className={cn(
                  "flex flex-col items-start p-2 rounded border text-left transition-all",
                  modeClasses
                )}
              >
                <span className="text-[10px] font-bold">{mode.label}</span>
                <span className={cn(
                  "text-[8px] leading-tight mt-0.5",
                  data.accessMode === mode.value ? "text-orange-100" : "text-slate-500"
                )}>
                  {mode.desc}
                </span>
              </button>
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
