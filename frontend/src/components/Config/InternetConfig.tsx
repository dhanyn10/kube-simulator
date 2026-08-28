
import { useState, useEffect, useMemo } from 'react';
import { useFlowStore } from '../../store';
import { Network, Layers } from 'lucide-react';
import { ConfigSection, AdvancedSection } from '../UI/ConfigUI';
import { SelectorGroup } from '../UI/SelectorGroup';

interface InternetConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

const formatNumberCompact = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  return num.toString();
};

export const InternetConfig = ({ selectedNode, performUpdate, toggleVisibility }: InternetConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;
  const currentTraffic = Math.max(1, data.traffic || 1);

  // Initialize maxRange based on current traffic (at least 1000)
  const [maxRange, setMaxRange] = useState(() => {
    let limit = 1000;
    while (currentTraffic >= limit) {
      limit *= 2;
    }
    return limit;
  });

  useEffect(() => {
    if (currentTraffic >= maxRange) {
      setMaxRange(currentTraffic * 2);
    }
  }, [currentTraffic, maxRange]);

  const handleSliderChange = (newVal: number) => {
    const val = Math.max(1, newVal);
    performUpdate({ traffic: val });
    if (val >= maxRange) {
      setMaxRange(maxRange * 2);
    }
  };

  const rulerTicks = useMemo(() => {
    const step = maxRange / 4;
    return [
      { label: '1', val: 1 },
      { label: formatNumberCompact(Math.round(step * 1)), val: Math.round(step * 1) },
      { label: formatNumberCompact(Math.round(step * 2)), val: Math.round(step * 2) },
      { label: formatNumberCompact(Math.round(step * 3)), val: Math.round(step * 3) },
      { label: formatNumberCompact(maxRange), val: maxRange }
    ];
  }, [maxRange]);

  return (
    <div className="space-y-4">
      <AdvancedSection colorMode={colorMode}>
        <ConfigSection
          title="Data Traffic"
          icon={Network}
          isVisible={data.displaySettings?.traffic}
          onToggle={() => toggleVisibility('traffic')}
        >
          <div className="px-1 py-2 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Visits / Duration</span>
              <span className="text-xs font-bold text-blue-500">
                {currentTraffic.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">visits</span>
              </span>
            </div>

            <input
              type="range"
              min="1"
              max={maxRange}
              step={maxRange > 10000 ? 50 : 1}
              value={currentTraffic}
              onChange={(e) => handleSliderChange(Number.parseInt(e.target.value, 10) || 1)}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            {/* 4-part ruler scale */}
            <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 relative pt-1">
              {rulerTicks.map((tick, idx) => (
                <div key={`tick-${tick.label}-${idx}`} className="flex flex-col items-center gap-0.5">
                  <div className="w-0.5 h-1.5 bg-slate-600 rounded-full" />
                  <span>{tick.label}</span>
                </div>
              ))}
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
              { label: 'ms', value: 'millisecond' },
              { label: 'sec', value: 'second' },
              { label: 'min', value: 'minute' }
            ]}
            currentValue={data.durationUnit || 'second'}
            onSelect={(val) => performUpdate({ durationUnit: val })}
            colorMode={colorMode}
            className="grid grid-cols-3"
          />
        </ConfigSection>
      </AdvancedSection>
    </div>
  );
};
