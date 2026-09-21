import React, { useRef, useState } from 'react';
import { Globe, Plus, Trash2, Check, Activity, Sparkles, LayoutGrid, ArrowLeft, Eye, Edit2, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import {
  useInternetProfileModal,
  HOURS_OF_DAY,
  ECOMMERCE_PROFILE,
  InternetProfileItem
} from '@/activities/modals';
import { useFlowStore } from '@/store/useFlowStore';

interface InternetProfileModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly selectedNode: any;
  readonly performUpdate: (updates: any) => void;
}

const MiniCurvePreview = ({
  profile,
  isApplied,
  currentHourIndex
}: {
  readonly profile: InternetProfileItem;
  readonly isApplied?: boolean;
  readonly currentHourIndex?: number;
}) => {
  const isSimulating = useFlowStore((state) => state.isSimulating);
  const [frozenHourIndex, setFrozenHourIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const width = 220;
  const height = 55;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 10;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const values = HOURS_OF_DAY.map((hour) => profile.hourly?.[hour] ?? 0);
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

  const gradientId = `miniGrad-${profile.name.replaceAll(/\s+/g, '-')}`;

  const liveHourIdx = typeof currentHourIndex === 'number' ? (currentHourIndex % 24) : 0;
  const safeHourIdx = frozenHourIndex !== null ? frozenHourIndex : liveHourIdx;
  const currentPt = points[safeHourIdx] || points[0];
  const currentVal = values[safeHourIdx] ?? 0;
  const currentHour = HOURS_OF_DAY[safeHourIdx] || '00:00';

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (mouseX - padLeft) / chartWidth));
    const hourIdx = Math.round(ratio * (HOURS_OF_DAY.length - 1));
    setFrozenHourIndex(hourIdx);
    setIsHovered(true);
  };

  const handleChartMouseLeave = () => {
    setFrozenHourIndex(null);
    setIsHovered(false);
  };

  return (
    <div
      className="relative my-1 cursor-pointer select-none"
      onMouseEnter={handleChartMouseMove}
      onMouseMove={handleChartMouseMove}
      onMouseLeave={handleChartMouseLeave}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 overflow-visible pointer-events-none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />

        {/* Chart.js-style Vertical Crosshair Line when Hovered */}
        {isHovered && (
          <line
            x1={currentPt.x}
            y1={padTop}
            x2={currentPt.x}
            y2={padTop + chartHeight}
            stroke="#3b82f6"
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />
        )}

        {/* Traffic Position Dot with Hover Freeze and Custom Floating Tooltip */}
        {isApplied && (
          <g
            key={`mini-traffic-dot-${safeHourIdx}`}
            data-testid="mini-active-traffic-dot"
          >
            <circle cx={currentPt.x} cy={currentPt.y} r="8" className="fill-transparent" />
            {isHovered ? (
              <>
                <circle cx={currentPt.x} cy={currentPt.y} r="6" className="fill-blue-500/30 stroke-blue-400 animate-pulse" strokeWidth="1.5" />
                <circle cx={currentPt.x} cy={currentPt.y} r="3.5" className="fill-blue-400 stroke-white dark:stroke-slate-900" strokeWidth="1.5" />
              </>
            ) : (
              <circle cx={currentPt.x} cy={currentPt.y} r="3.5" className="fill-blue-400 stroke-white dark:stroke-slate-900 transition-transform" strokeWidth="1.5" />
            )}
          </g>
        )}
      </svg>

      {isApplied && isHovered && (
        <div
          data-testid="mini-traffic-dot-tooltip"
          className="absolute z-30 px-2 py-1 text-[10px] font-mono font-bold bg-slate-950/95 text-white border border-blue-500/80 rounded-md shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-1 animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap"
          style={{
            left: `${(currentPt.x / width) * 100}%`,
            top: `${(currentPt.y / height) * 100}%`
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 font-extrabold">{currentHour}</span>
            <span className="text-slate-200">{currentVal.toLocaleString()} visits</span>
          </div>
          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-slate-950/95" />
        </div>
      )}
    </div>
  );
};

const InteractiveTrafficChart = ({
  profile,
  colorMode,
  isApplied,
  currentHourIndex,
  onUpdatePoint,
  onUpdateName
}: {
  readonly profile: InternetProfileItem;
  readonly colorMode: string;
  readonly isApplied?: boolean;
  readonly currentHourIndex?: number;
  readonly onUpdatePoint: (hour: string, newValue: number) => void;
  readonly onUpdateName: (newName: string) => void;
}) => {
  const isSimulating = useFlowStore((state) => state.isSimulating);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingHour, setDraggingHour] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ hour: string; val: number; x: number; y: number } | null>(null);
  const [frozenTrafficHourIndex, setFrozenTrafficHourIndex] = useState<number | null>(null);

  const width = 680;
  const height = 280;
  const padLeft = 65;
  const padRight = 35;
  const padTop = 35;
  const padBottom = 45;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const values = HOURS_OF_DAY.map((hour) => profile.hourly?.[hour] ?? 0);
  const currentMax = Math.max(...values, 1000);
  const maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  const minVal = 0;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const val = Math.round(minVal + (maxVal - minVal) * (1 - ratio));
    const y = padTop + chartHeight * ratio;
    return { val, y };
  });

  const points = values.map((val, idx) => {
    const x = padLeft + (idx / (HOURS_OF_DAY.length - 1)) * chartWidth;
    const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, val, hour: HOURS_OF_DAY[idx] };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`;

  const liveTrafficIdx = typeof currentHourIndex === 'number' ? (currentHourIndex % 24) : 0;
  const activeTrafficIdx = frozenTrafficHourIndex !== null ? frozenTrafficHourIndex : liveTrafficIdx;

  const handlePointerDown = (hour: string, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDraggingHour(hour);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingHour || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const svgY = (clientY / rect.height) * height;

    const clampedY = Math.max(padTop, Math.min(padTop + chartHeight, svgY));
    const ratio = (padTop + chartHeight - clampedY) / chartHeight;
    const calculatedVal = Math.round(minVal + ratio * (maxVal - minVal));
    const finalVal = Math.max(10, Math.min(maxVal, calculatedVal));

    onUpdatePoint(draggingHour, finalVal);
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (draggingHour) {
      handlePointerMove(e);
      return;
    }
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (clientX - padLeft) / chartWidth));
    const hourIdx = Math.round(ratio * (HOURS_OF_DAY.length - 1));
    const pt = points[hourIdx] || points[0];
    setHoveredPoint({ hour: pt.hour, val: pt.val, x: pt.x, y: pt.y });
    setFrozenTrafficHourIndex(hourIdx);
  };

  const handleSvgPointerLeave = (e: React.PointerEvent) => {
    if (draggingHour) {
      handlePointerUp(e);
      return;
    }
    setHoveredPoint(null);
    setFrozenTrafficHourIndex(null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingHour) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      setDraggingHour(null);
    }
  };

  return (
    <div className={cn(
      "p-5 rounded-xl border flex flex-col relative overflow-hidden animate-in fade-in duration-200",
      colorMode === 'dark' ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
    )}>
      {/* Title Header with In-Place Editable Name */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Activity size={18} className="text-blue-500 shrink-0" />
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Profile:
            </span>
            <div className="relative flex-1 max-w-sm flex items-center">
              <input
                type="text"
                value={profile.name}
                onChange={(e) => onUpdateName(e.target.value)}
                className={cn(
                  "w-full px-2.5 py-1 rounded-lg border text-xs font-bold text-blue-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/50",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"
                )}
              />
              <Edit2 size={13} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono font-semibold">
          <span className="text-slate-400">Min: <strong className="text-slate-200">{Math.min(...values).toLocaleString()}</strong></span>
          <span className="text-slate-400">Peak: <strong className="text-blue-400">{Math.max(...values).toLocaleString()}</strong> users</span>
        </div>
      </div>

      <p className="text-[11px] font-medium text-slate-400 mb-2 px-1">
        💡 Drag data points vertically up/down on the Y-axis to dynamically modify hourly traffic values.
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handleSvgPointerLeave}
        onPointerUp={handlePointerUp}
        className="w-full h-auto max-h-[260px] overflow-visible select-none touch-none cursor-pointer"
      >
        <defs>
          <linearGradient id="detailGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y-axis horizontal grid lines */}
        {yTicks.map((tick, i) => (
          <g key={`y-tick-${i}`}>
            <line
              x1={padLeft}
              y1={tick.y}
              x2={width - padRight}
              y2={tick.y}
              stroke={colorMode === 'dark' ? '#334155' : '#e2e8f0'}
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={tick.y + 3}
              textAnchor="end"
              className={cn(
                "text-[10px] font-mono font-bold",
                colorMode === 'dark' ? "fill-slate-400" : "fill-slate-600"
              )}
            >
              {tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}k` : tick.val}
            </text>
          </g>
        ))}

        {/* Axis main border lines */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + chartHeight}
          stroke={colorMode === 'dark' ? '#475569' : '#cbd5e1'}
          strokeWidth="2"
        />
        <line
          x1={padLeft}
          y1={padTop + chartHeight}
          x2={width - padRight}
          y2={padTop + chartHeight}
          stroke={colorMode === 'dark' ? '#475569' : '#cbd5e1'}
          strokeWidth="2"
        />

        {/* Area fill */}
        <path d={areaD} fill="url(#detailGradient)" />

        {/* Curve line */}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Chart.js-style Vertical Crosshair Line when Hovered */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={padTop}
            x2={hoveredPoint.x}
            y2={padTop + chartHeight}
            stroke="#3b82f6"
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />
        )}

        {/* Interactive Data points & X-axis Hour labels */}
        {points.map((pt, idx) => {
          const isDraggingThis = draggingHour === pt.hour;
          const showLabel = idx % 3 === 0 || idx === points.length - 1;
          const isCurrentTrafficHour = isSimulating && isApplied && idx === activeTrafficIdx;

          return (
            <g key={`pt-${pt.hour}`}>
              {/* Vertical Guide Line when dragging or active traffic tick */}
              {(isDraggingThis || isCurrentTrafficHour) && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + chartHeight}
                  stroke={isCurrentTrafficHour ? "#34d399" : "#3b82f6"}
                  strokeDasharray="2 2"
                  strokeWidth={isCurrentTrafficHour ? "2" : "1.5"}
                />
              )}

              {/* Invisible touch target for drag ease */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="12"
                className="fill-transparent cursor-ns-resize"
                onPointerDown={(e) => handlePointerDown(pt.hour, e)}
              />

              {/* Visible Circle with Hover Freeze and Custom Floating Tooltip */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isDraggingThis || isCurrentTrafficHour ? 6 : 4}
                className={cn(
                  "cursor-ns-resize transition-all hover:scale-125",
                  isCurrentTrafficHour
                    ? "fill-emerald-400 stroke-white dark:stroke-slate-900 ring-4 ring-emerald-500/50"
                    : isDraggingThis
                      ? "fill-blue-400 stroke-white ring-4 ring-blue-500/50"
                      : "fill-blue-500 stroke-white dark:stroke-slate-900"
                )}
                strokeWidth="1.5"
                onPointerDown={(e) => handlePointerDown(pt.hour, e)}
              />

              {/* Value Label (only when dragging) */}
              {isDraggingThis && (
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  className="text-[10px] font-mono font-bold fill-blue-400 select-none"
                >
                  {pt.val >= 1000 ? `${(pt.val / 1000).toFixed(1)}k` : pt.val}
                </text>
              )}

              {/* Hour Label */}
              {showLabel && (
                <text
                  x={pt.x}
                  y={padTop + chartHeight + 20}
                  textAnchor="middle"
                  className={cn(
                    "text-[9px] font-bold font-mono tracking-wider select-none",
                    colorMode === 'dark' ? "fill-slate-400" : "fill-slate-600"
                  )}
                >
                  {pt.hour}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          data-testid="interactive-chart-tooltip"
          className="absolute z-30 px-2.5 py-1 text-xs font-mono font-bold bg-slate-950/95 text-white border border-blue-500/80 rounded-md shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-1.5 animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 font-extrabold">{hoveredPoint.hour}</span>
            <span className="text-slate-200">{hoveredPoint.val.toLocaleString()} visits</span>
          </div>
          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-slate-950/95" />
        </div>
      )}
    </div>
  );
};

export const InternetProfileModal: React.FC<InternetProfileModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
  performUpdate
}) => {
  const cardName = selectedNode?.data?.label || 'Internet';

  const currentHourIndex = selectedNode?.data?.currentHourIndex;

  const {
    colorMode,
    profiles,
    activeProfileName,
    activeProfile,
    viewMode,
    setViewMode,
    detailProfile,
    handleApplyProfile,
    handleOpenDetails,
    handleUpdateDetailPoint,
    handleUpdateDetailName,
    handleSaveAndApplyDetailProfile,
    handleSaveCustomProfile,
    handleDeleteProfile,
    newProfileName,
    setNewProfileName,
    customHourlyValues,
    handleStartCustomProfile,
    handleRandomizeCustomValues,
    handleUpdateCustomPoint
  } = useInternetProfileModal(isOpen, selectedNode, performUpdate, onClose);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cardName}
      subtitle="24-Hour Connection Simulation Profile Templates (00:00 - 23:00)"
      icon={Globe}
      iconColorClass="text-blue-500"
      widthClass="w-full max-w-4xl"
      maxHeightClass="max-h-[85vh] h-[75vh]"
    >
      <div className="space-y-5">
        {viewMode === 'grid' && (
          <>
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
                const isApplied = p.name === activeProfileName;
                const values = HOURS_OF_DAY.map((h) => p.hourly?.[h] ?? 0);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);

                return (
                  <div
                    key={p.name}
                    className={cn(
                      "relative p-3.5 rounded-xl border transition-all flex flex-col justify-between select-none outline-none",
                      isApplied
                        ? (colorMode === 'dark' ? "bg-slate-900 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500" : "bg-blue-50/70 border-blue-500 shadow-md ring-1 ring-blue-500")
                        : (colorMode === 'dark' ? "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50")
                    )}
                  >
                    {/* Top Right Checkmark Badge (Only icon, no text label) */}
                    {isApplied && (
                      <div
                        data-testid={`applied-badge-${p.name.replaceAll(/\s+/g, '-')}`}
                        className="absolute top-2.5 right-2.5 z-10 p-1 rounded-full bg-blue-600 text-white shadow-md animate-in fade-in zoom-in duration-200"
                        title="Applied Profile"
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}

                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between mb-1.5 pr-10">
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider",
                          p.name === ECOMMERCE_PROFILE.name
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        )}>
                          {p.name === ECOMMERCE_PROFILE.name ? 'Default' : 'Custom'}
                        </span>

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

                      {/* Template Title */}
                      <h4 className="text-xs font-bold text-slate-200 dark:text-slate-100 line-clamp-1 mb-1">
                        {p.name}
                      </h4>

                      {/* Curve Preview */}
                      <MiniCurvePreview profile={p} isApplied={isApplied} currentHourIndex={currentHourIndex} />
                    </div>

                    {/* Metrics Summary */}
                    <div className="pt-2 my-1 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono font-semibold text-slate-400">
                      <span>Min: <strong className="text-slate-200">{minVal >= 1000 ? `${(minVal / 1000).toFixed(1)}k` : minVal}</strong></span>
                      <span className="text-blue-400">Max: <strong className="text-blue-400">{maxVal >= 1000 ? `${(maxVal / 1000).toFixed(1)}k` : maxVal}</strong></span>
                    </div>

                    {/* Action Buttons: Apply & Details (Both typical outline buttons) */}
                    <div className="pt-2 flex items-center gap-2 border-t border-slate-800/40">
                      <button
                        type="button"
                        onClick={() => handleApplyProfile(p.name)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all border shadow-sm",
                          isApplied
                            ? "border-blue-500 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                            : (colorMode === 'dark'
                              ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700")
                        )}
                      >
                        <Check size={13} />
                        <span>Apply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDetails(p.name)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all border shadow-sm",
                          colorMode === 'dark'
                            ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                            : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700"
                        )}
                      >
                        <Eye size={13} />
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add Custom Profile Template Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={handleStartCustomProfile}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleStartCustomProfile();
                  }
                }}
                className={cn(
                  "p-4 rounded-xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 select-none min-h-[160px] outline-none focus:ring-2 focus:ring-blue-500/50",
                  colorMode === 'dark' ? "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                )}
              >
                <div className="p-2.5 rounded-full bg-blue-600/20 text-blue-400">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold">Add Custom Profile</span>
                <span className="text-[10px] text-slate-500">Create new randomized weekly connection schedule</span>
              </div>
            </div>
          </>
        )}

        {/* Detailed Full Profile View */}
        {viewMode === 'details' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Back to Profiles Gallery</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAndApplyDetailProfile}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-sm transition-all",
                    detailProfile.name === activeProfileName
                      ? "border-blue-500 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      : "bg-blue-600 hover:bg-blue-500 text-white border-transparent"
                  )}
                >
                  <Check size={14} />
                  <span>{detailProfile.name === activeProfileName ? 'Applied' : 'Save & Apply Profile'}</span>
                </button>
              </div>
            </div>

            <InteractiveTrafficChart
              profile={detailProfile}
              colorMode={colorMode}
              isApplied={detailProfile.name === activeProfileName}
              currentHourIndex={currentHourIndex}
              onUpdatePoint={handleUpdateDetailPoint}
              onUpdateName={handleUpdateDetailName}
            />
          </div>
        )}

        {/* Custom Graphical Profile Creation Screen */}
        {viewMode === 'custom' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Cancel Custom Creation</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRandomizeCustomValues}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-blue-400 transition-all shadow-sm"
                  title="Randomize daily traffic values"
                >
                  <Shuffle size={14} />
                  <span>Randomize Graph</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCustomProfile}
                  disabled={!newProfileName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 transition-all"
                >
                  <Sparkles size={14} />
                  <span>Save & Apply Custom Profile</span>
                </button>
              </div>
            </div>

            {/* Graphical Chart for Custom Profile */}
            <InteractiveTrafficChart
              profile={{
                name: newProfileName,
                hourly: customHourlyValues
              }}
              colorMode={colorMode}
              isApplied={false}
              currentHourIndex={currentHourIndex}
              onUpdatePoint={handleUpdateCustomPoint}
              onUpdateName={setNewProfileName}
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
          <p className="text-[11px] text-slate-400 font-medium">
            Active Connection Profile: <span className="text-blue-400 font-bold">{activeProfile ? activeProfile.name : 'None'}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow",
              colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
            )}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
