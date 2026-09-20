import React from 'react';
import { Globe, Plus, Trash2, Check, Activity, Sparkles, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import {
  useInternetProfileModal,
  DAYS_OF_WEEK,
  ECOMMERCE_PROFILE,
  InternetProfileItem
} from '@/activities/modals';

interface InternetProfileModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly selectedNode: any;
  readonly performUpdate: (updates: any) => void;
}

const MiniCurvePreview = ({
  profile
}: {
  readonly profile: InternetProfileItem;
}) => {
  const width = 220;
  const height = 60;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 10;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const values = DAYS_OF_WEEK.map((day) => profile.daily[day] || 0);
  const maxVal = Math.max(...values, 1000);
  const minVal = 0;

  const points = values.map((val, idx) => {
    const x = padLeft + (idx / (DAYS_OF_WEEK.length - 1)) * chartWidth;
    const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`;

  const gradientId = `miniGrad-${profile.name.replace(/\s+/g, '-')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14 overflow-visible my-1">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      {points.map((pt, idx) => (
        <circle key={`pt-${idx}`} cx={pt.x} cy={pt.y} r="2.5" className="fill-blue-500 stroke-white dark:stroke-slate-900" strokeWidth="1" />
      ))}
    </svg>
  );
};

export const InternetProfileModal: React.FC<InternetProfileModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
  performUpdate
}) => {
  const cardName = selectedNode?.data?.label || 'Internet';

  const {
    colorMode,
    profiles,
    activeProfileName,
    activeProfile,
    isCreating,
    setIsCreating,
    newProfileName,
    setNewProfileName,
    newDailyValues,
    setNewDailyValues,
    handleSelectProfile,
    handleSaveCustomProfile,
    handleDeleteProfile,
    handleActivateProfile
  } = useInternetProfileModal(isOpen, selectedNode, performUpdate, onClose);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cardName}
      subtitle="Weekly Connection Simulation Profile Templates (Senin - Minggu)"
      icon={Globe}
      iconColorClass="text-blue-500"
      widthClass="w-full max-w-4xl"
      maxHeightClass="max-h-[85vh] h-[75vh]"
    >
      <div className="space-y-5">
        {/* Gallery Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Select Connection Simulation Profile
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {profiles.length} Available Profile{profiles.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* MS Word-style Template Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => {
            const isSelected = p.name === activeProfileName;
            const values = DAYS_OF_WEEK.map((d) => p.daily[d] || 0);
            const peakVal = Math.max(...values);

            return (
              <div
                key={p.name}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectProfile(p.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSelectProfile(p.name);
                  }
                }}
                className={cn(
                  "relative p-3.5 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between select-none outline-none focus:ring-2 focus:ring-blue-500/50",
                  isSelected
                    ? (colorMode === 'dark' ? "bg-slate-900 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500" : "bg-blue-50/70 border-blue-500 shadow-md ring-1 ring-blue-500")
                    : (colorMode === 'dark' ? "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50")
                )}
              >
                <div>
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn(
                      "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider",
                      p.name === ECOMMERCE_PROFILE.name
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    )}>
                      {p.name === ECOMMERCE_PROFILE.name ? 'Default' : 'Custom'}
                    </span>

                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="p-0.5 rounded-full bg-blue-600 text-white shadow">
                          <Check size={12} />
                        </span>
                      )}
                      {p.name !== ECOMMERCE_PROFILE.name && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(p.name);
                          }}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Template Title */}
                  <h4 className="text-xs font-bold text-slate-200 dark:text-slate-100 line-clamp-1 mb-1">
                    {p.name}
                  </h4>

                  {/* Curve Preview */}
                  <MiniCurvePreview profile={p} />
                </div>

                {/* Footer Metrics */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono font-semibold text-slate-400">
                  <span className="flex items-center gap-1 text-blue-400">
                    <Activity size={12} />
                    Peak: {peakVal.toLocaleString()}
                  </span>
                  <span className="text-slate-500">Sen-Ming</span>
                </div>
              </div>
            );
          })}

          {/* Add Custom Profile Template Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsCreating(!isCreating)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setIsCreating(!isCreating);
              }
            }}
            className={cn(
              "p-4 rounded-xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 select-none min-h-[140px] outline-none focus:ring-2 focus:ring-blue-500/50",
              isCreating
                ? "border-blue-500 bg-blue-500/10 text-blue-400"
                : (colorMode === 'dark' ? "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 text-slate-500 hover:text-slate-700")
            )}
          >
            <div className="p-2.5 rounded-full bg-blue-600/20 text-blue-400">
              <Plus size={20} />
            </div>
            <span className="text-xs font-bold">Add Custom Profile</span>
            <span className="text-[10px] text-slate-500">Create new weekly connection schedule</span>
          </div>
        </div>

        {/* Custom Profile Creation Form Drawer */}
        {isCreating && (
          <div className={cn(
            "p-4 rounded-xl border space-y-4 animate-in fade-in duration-200",
            colorMode === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-300"
          )}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Create Custom Connection Profile Template
              </h3>
            </div>

            <div>
              <label htmlFor="new-profile-name" className="block text-[11px] font-bold text-slate-400 mb-1">
                Profile Name
              </label>
              <input
                id="new-profile-name"
                type="text"
                placeholder="e.g. Weekend Flash Sale"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className={cn(
                  "w-full px-3 py-1.5 rounded-lg border text-xs font-medium outline-none focus:border-blue-500",
                  colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-300 text-slate-800"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-2">
                Daily Traffic Levels (Visits / Day)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{day}</span>
                    <input
                      type="number"
                      min="1"
                      value={newDailyValues[day] || 1000}
                      onChange={(e) =>
                        setNewDailyValues({
                          ...newDailyValues,
                          [day]: Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                        })
                      }
                      className={cn(
                        "w-full px-2 py-1 rounded border text-xs font-mono font-bold text-blue-400 outline-none focus:border-blue-500",
                        colorMode === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-300"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/50">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomProfile}
                disabled={!newProfileName.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow"
              >
                Save Profile Template
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
          <p className="text-[11px] text-slate-400 font-medium">
            Selected Template: <span className="text-blue-400 font-bold">{activeProfile.name}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-colors",
                colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              )}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleActivateProfile}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
            >
              <Check size={16} />
              <span>Activate Profile</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
