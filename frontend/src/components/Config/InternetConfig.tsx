
import { useMemo } from 'react';
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

  // Calculate dynamic maxRange based on current traffic (minimum 1000)
  const maxRange = useMemo(() => {
    let limit = 1000;
    while (currentTraffic >= limit) {
      limit *= 2;
    }
    return limit;
  }, [currentTraffic]);

  const handleSliderChange = (newVal: number) => {
    const val = Math.max(1, newVal);
    performUpdate({ traffic: val });
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
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  value={currentTraffic}
                  onChange={(e) => handleSliderChange(Number.parseInt(e.target.value, 10) || 1)}
                  data-testid="traffic-numeric-input"
                  className="w-20 text-right bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-bold text-blue-400 font-mono outline-none focus:border-blue-500"
                />
                <span className="text-[9px] font-normal text-slate-400">visits</span>
              </div>
            </div>

            <div className="relative pt-1 pb-4">
              <input
                type="range"
                min="1"
                max={maxRange}
                step={maxRange > 10000 ? 50 : 1}
                value={currentTraffic}
                onChange={(e) => handleSliderChange(Number.parseInt(e.target.value, 10) || 1)}
                className="w-full h-2 bg-slate-800 rounded appearance-none cursor-pointer custom-traffic-slider outline-none"
              />

              {/* Interactive 4-part ruler scale perfectly aligned to track */}
              <div className="relative w-full text-[8px] font-mono text-slate-500 h-6 mt-1">
                {rulerTicks.map((tick, idx) => {
                  const pct = (idx / 4) * 100;
                  return (
                    <button
                      type="button"
                      key={`tick-${tick.label}-${idx}`}
                      onClick={() => handleSliderChange(tick.val)}
                      data-testid={`ruler-tick-${tick.val}`}
                      title={`Set traffic to ${tick.val.toLocaleString()}`}
                      style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                      className="absolute top-0 flex flex-col items-center gap-0.5 hover:text-blue-400 transition-colors group focus:outline-none"
                    >
                      <div className="w-0.5 h-2 bg-slate-600 rounded-full group-hover:bg-blue-400" />
                      <span className="font-bold tracking-tighter whitespace-nowrap">{tick.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <style>{`
              .custom-traffic-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 18px;
                background-color: #3b82f6;
                clip-path: polygon(0% 0%, 100% 0%, 100% 65%, 60% 65%, 50% 100%, 40% 65%, 0% 65%);
                cursor: pointer;
                transition: background-color 0.15s ease;
              }
              .custom-traffic-slider::-webkit-slider-thumb:hover {
                background-color: #60a5fa;
              }
              .custom-traffic-slider::-moz-range-thumb {
                width: 14px;
                height: 18px;
                background-color: #3b82f6;
                border: none;
                clip-path: polygon(0% 0%, 100% 0%, 100% 65%, 60% 65%, 50% 100%, 40% 65%, 0% 65%);
                cursor: pointer;
                transition: background-color 0.15s ease;
              }
              .custom-traffic-slider::-moz-range-thumb:hover {
                background-color: #60a5fa;
              }
            `}</style>
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
