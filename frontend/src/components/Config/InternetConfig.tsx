import { useMemo, useState } from 'react';
import { Network, Sparkles, Activity } from 'lucide-react';
import { ConfigSection } from '../UI/ConfigUI';
import { InternetProfileModal } from '../Modals/InternetProfileModal';
import { HOURS_OF_DAY } from '@/activities/modals';

interface InternetConfigProps {
  readonly selectedNode: any;
  readonly performUpdate: (updates: any) => void;
  readonly toggleVisibility: (field: string) => void;
}

const formatNumberCompact = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  return num.toString();
};

const ReadOnlyProfileChart = ({ profile }: { readonly profile: any }) => {
  const width = 240;
  const height = 80;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 8;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const values = HOURS_OF_DAY.map((hour) => profile.hourly?.[hour] ?? profile.daily?.[hour] ?? 0);
  const maxVal = Math.max(...values, 1000);
  const minVal = 0;

  const points = values.map((val, idx) => {
    const x = padLeft + (idx / (HOURS_OF_DAY.length - 1)) * chartWidth;
    const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`;

  return (
    <div className="p-2.5 rounded-lg border border-blue-500/30 bg-slate-900/60 space-y-1.5" data-testid="profile-chart-preview">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <div className="flex items-center gap-1.5 text-blue-400">
          <Activity size={13} className="shrink-0" />
          <span className="truncate max-w-[200px]">{profile.name}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible">
        <defs>
          <linearGradient id="sidebarChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sidebarChartGrad)" />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-0.5 border-t border-slate-800">
        <span>Min: <strong className="text-slate-200">{Math.min(...values).toLocaleString()}</strong></span>
        <span>Peak: <strong className="text-blue-400">{Math.max(...values).toLocaleString()}</strong></span>
      </div>
    </div>
  );
};

export const InternetConfig = ({ selectedNode, performUpdate, toggleVisibility }: InternetConfigProps) => {
  const data = selectedNode.data;
  const currentTraffic = Math.max(1, data.traffic || 1);
  const activeProfile = data.connectionProfile;
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      {/* Small floating right-aligned Explore More button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="py-1 px-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Sparkles size={12} />
          <span>Explore More</span>
        </button>
      </div>

      {/* Data Traffic Section */}
      <ConfigSection
        title="Data Traffic"
        icon={Network}
        isVisible={data.displaySettings?.traffic}
        onToggle={() => toggleVisibility('traffic')}
      >
        <div className="px-1 py-2 space-y-2">
          {activeProfile ? (
            <ReadOnlyProfileChart profile={activeProfile} />
          ) : (
            <>
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

              <div className="relative pt-1 pb-5">
                <input
                  type="range"
                  min="1"
                  max={maxRange}
                  step={maxRange > 10000 ? 50 : 1}
                  value={currentTraffic}
                  onChange={(e) => handleSliderChange(Number.parseInt(e.target.value, 10) || 1)}
                  className="w-full h-2 bg-slate-800 rounded appearance-none cursor-pointer custom-traffic-slider outline-none"
                />

                {/* Interactive 4-part ruler scale with track padding offset matching 20px thumb center */}
                <div className="relative w-full text-[8px] font-mono text-slate-500 h-6 mt-1 px-2.5">
                  {rulerTicks.map((tick, idx) => (
                    <button
                      type="button"
                      key={`tick-${tick.label}-${idx}`}
                      onClick={() => handleSliderChange(tick.val)}
                      data-testid={`ruler-tick-${tick.val}`}
                      title={`Set traffic to ${tick.val.toLocaleString()}`}
                      style={{ left: `calc(10px + (100% - 20px) * ${idx / 4})`, transform: 'translateX(-50%)' }}
                      className="absolute top-0 flex flex-col items-center gap-0.5 hover:text-blue-400 transition-colors group focus:outline-none"
                    >
                      <div className="w-0.5 h-2 bg-slate-600 rounded-full group-hover:bg-blue-400" />
                      <span className="font-bold tracking-tighter whitespace-nowrap">{tick.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <style>{`
                .custom-traffic-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 28px;
                  background-color: #3b82f6;
                  clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%);
                  cursor: pointer;
                  transition: background-color 0.15s ease;
                  margin-top: -10px;
                }
                .custom-traffic-slider::-webkit-slider-thumb:hover {
                  background-color: #60a5fa;
                }
                .custom-traffic-slider::-moz-range-thumb {
                  width: 20px;
                  height: 28px;
                  background-color: #3b82f6;
                  border: none;
                  clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%);
                  cursor: pointer;
                  transition: background-color 0.15s ease;
                }
                .custom-traffic-slider::-moz-range-thumb:hover {
                  background-color: #60a5fa;
                }
              `}</style>
            </>
          )}
        </div>
      </ConfigSection>

      {/* Modal for Internet Connection Profiles */}
      <InternetProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    </div>
  );
};
