
import { useFlowStore } from '../store';
import { Network, Layers } from 'lucide-react';
import { ConfigSection, AdvancedSection } from './ConfigUI';
import { SelectorGroup } from './SelectorGroup';

interface InternetConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
  toggleYaml?: (field: string) => void;
}

export const InternetConfig = ({ selectedNode, performUpdate, toggleVisibility }: InternetConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <div className="space-y-4">
      <AdvancedSection colorMode={colorMode}>
        <ConfigSection
          title="Data Traffic"
          icon={Network}
          isVisible={data.displaySettings?.traffic}
          onToggle={() => toggleVisibility('traffic')}
        >
          <div className="px-1 py-2">
            <input
              type="range"
              min="0"
              max="20000"
              step="500"
              value={data.traffic || 1000}
              onChange={(e) => performUpdate({ traffic: Number.parseInt(e.target.value, 10) || 1000 })}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[8px] font-mono text-slate-500 italic">1k</span>
              <span className="text-[10px] font-bold text-blue-500">{(data.traffic || 1000).toLocaleString()} <span className="text-[8px] font-normal opacity-70">visits</span></span>
              <span className="text-[8px] font-mono text-slate-500 italic">1M</span>
            </div>
          </div>
        </ConfigSection>

        <ConfigSection
          title="Data Duration"
          icon={Layers}
          isVisible={data.displaySettings?.duration}
          onToggle={() => toggleVisibility('duration')}
        >
          <SelectorGroup
            options={[
              { label: 'Second', value: 'second' },
              { label: 'Minute', value: 'minute' },
              { label: 'Hour', value: 'hour' }
            ]}
            currentValue={data.durationUnit || 'minute'}
            onSelect={(val) => performUpdate({ durationUnit: val })}
            colorMode={colorMode}
            className="grid grid-cols-3"
          />
        </ConfigSection>
      </AdvancedSection>
    </div>
  );
};
