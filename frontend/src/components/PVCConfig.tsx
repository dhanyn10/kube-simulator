
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Database, Eye, EyeOff, FileCode, FileX, ShieldCheck } from 'lucide-react';
import { SelectorGroup } from './SelectorGroup';
import { AdvancedSection } from './ConfigUI';

interface PVCConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml: (field: string) => void;
}

export const PVCConfig = ({ selectedNode, performUpdate, toggleVisibility, toggleYaml }: PVCConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  const accessModes = [
    { value: 'ReadWriteOnce', label: 'RWO', desc: 'ReadWriteOnce: Bisa diakses 1 Pod (Read/Write)' },
    { value: 'ReadOnlyMany', label: 'ROX', desc: 'ReadOnlyMany: Banyak Pod bisa baca saja' },
    { value: 'ReadWriteMany', label: 'RWX', desc: 'ReadWriteMany: Banyak Pod bisa Read/Write' },
  ];

  return (
    <div className="space-y-4">
      {/* Capacity */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Database size={10} /> Kapasitas (Storage)
          </label>
        </div>
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
        <input
          type="text"
          value={data.storageCapacity || '1Gi'}
          onChange={(e) => performUpdate({ storageCapacity: e.target.value })}
          placeholder="Custom (misal: 20Gi)"
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>

      {/* Access Mode */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <ShieldCheck size={10} /> Mode Akses
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {accessModes.map((mode) => {
            const isActive = data.accessMode === mode.value;
            let modeClasses = "";
            if (isActive) {
              modeClasses = "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20";
            } else {
              modeClasses = colorMode === 'dark'
                ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300";
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
      </div>

      <AdvancedSection colorMode={colorMode}>
        {/* Storage Class */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Database size={10} /> Storage Class
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleVisibility('storageClass')} className={cn("transition-colors", data.displaySettings?.storageClass !== false ? "text-blue-500" : "text-slate-500 hover:text-blue-400")}>
                {(data.displaySettings?.storageClass !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
              <button onClick={() => toggleYaml('storageClass')} className={cn("transition-colors", data.yamlSettings?.storageClass !== false ? "text-emerald-500" : "text-slate-500 hover:text-emerald-400")}>
                {(data.yamlSettings?.storageClass !== false) ? <FileCode size={10} /> : <FileX size={10} />}
              </button>
            </div>
          </div>
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
        </div>
      </AdvancedSection>
    </div>
  );
};
