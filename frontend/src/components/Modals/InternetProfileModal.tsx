import React, { useRef, useState, useMemo } from 'react';
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
  currentHourIndex,
  isRed
}: {
  readonly profile: InternetProfileItem;
  readonly isApplied?: boolean;
  readonly currentHourIndex?: number;
  readonly isRed?: boolean;
}) => {
  const isSimulating = useFlowStore((state) => state.isSimulating);
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number | null>(null);

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

  const safeHourIdx = typeof currentHourIndex === 'number' ? (currentHourIndex % 24) : 0;
  const currentPt = points[safeHourIdx] || points[0];
  const currentVal = values[safeHourIdx] ?? 0;
  const currentHour = HOURS_OF_DAY[safeHourIdx] || '00:00';

  const hoveredPt = hoveredHourIdx !== null ? points[hoveredHourIdx] : null;
  const hoveredVal = hoveredHourIdx !== null ? (values[hoveredHourIdx] ?? 0) : 0;
  const hoveredHour = hoveredHourIdx !== null ? (HOURS_OF_DAY[hoveredHourIdx] || '00:00') : '00:00';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;
    const clampedX = Math.max(padLeft, Math.min(width - padRight, relativeX));
    const ratio = (clampedX - padLeft) / chartWidth;
    const hourIdx = Math.min(23, Math.max(0, Math.round(ratio * (HOURS_OF_DAY.length - 1))));
    setHoveredHourIdx(hourIdx);
  };

  const handleMouseLeave = () => {
    setHoveredHourIdx(null);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12 overflow-visible my-1 cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />

      {/* Traffic Position Dot for Applied Profile (Always locked at safeHourIdx) */}
      {isApplied && (
        <g key={`mini-traffic-dot-active-${safeHourIdx}`} data-testid="mini-active-traffic-dot" className="group/minidot cursor-pointer">
          <circle cx={currentPt.x} cy={currentPt.y} r="8" className="fill-transparent" />
          <circle
            cx={currentPt.x}
            cy={currentPt.y}
            r="3.5"
            className={isRed ? "fill-rose-500 stroke-white dark:stroke-slate-900 transition-transform group-hover/minidot:scale-125" : "fill-blue-400 stroke-white dark:stroke-slate-900 transition-transform group-hover/minidot:scale-125"}
            strokeWidth="1.5"
          />
          <title>{`${currentHour} - ${currentVal.toLocaleString()} visits`}</title>
        </g>
      )}

      {/* Hover Position Indicator Dot */}
      {hoveredPt && (
        <g key={`mini-traffic-dot-hover-${hoveredHourIdx}`} data-testid="mini-hover-traffic-dot" className="cursor-pointer">
          <circle
            cx={hoveredPt.x}
            cy={hoveredPt.y}
            r="4"
            className={hoveredHourIdx === safeHourIdx ? (isRed ? "fill-rose-500 stroke-white dark:stroke-slate-900" : "fill-emerald-400 stroke-white dark:stroke-slate-900") : "fill-blue-300 stroke-white dark:stroke-slate-900"}
            strokeWidth="1.5"
          />
          <title>{`${hoveredHour} - ${hoveredVal.toLocaleString()} visits`}</title>
        </g>
      )}
    </svg>
  );
};

const InteractiveTrafficChart = ({
  profile,
  colorMode,
  isApplied,
  currentHourIndex,
  isRed,
  onUpdatePoint,
  onUpdateName
}: {
  readonly profile: InternetProfileItem;
  readonly colorMode: string;
  readonly isApplied?: boolean;
  readonly currentHourIndex?: number;
  readonly isRed?: boolean;
  readonly onUpdatePoint: (hour: string, newValue: number) => void;
  readonly onUpdateName: (newName: string) => void;
}) => {
  const isSimulating = useFlowStore((state) => state.isSimulating);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingHour, setDraggingHour] = useState<string | null>(null);
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number | null>(null);

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

  const safeHourIdx = typeof currentHourIndex === 'number' ? (currentHourIndex % 24) : 0;

  const handlePointerDown = (hour: string, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDraggingHour(hour);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const svgX = (clientX / rect.width) * width;
      const clampedX = Math.max(padLeft, Math.min(width - padRight, svgX));
      const ratioX = (clampedX - padLeft) / chartWidth;
      const hourIdx = Math.min(23, Math.max(0, Math.round(ratioX * (HOURS_OF_DAY.length - 1))));
      setHoveredHourIdx(hourIdx);
    }

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

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingHour) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      setDraggingHour(null);
    }
  };

  const handlePointerLeave = () => {
    setHoveredHourIdx(null);
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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
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

        {/* Interactive Data points & X-axis Hour labels */}
        {points.map((pt, idx) => {
          const isDraggingThis = draggingHour === pt.hour;
          const isHoveredThis = hoveredHourIdx === idx;
          const isSimulatingActive = isSimulating && isApplied && idx === safeHourIdx;
          const showLabel = idx % 3 === 0 || idx === points.length - 1;

          return (
            <g key={`pt-${pt.hour}`}>
              {/* Vertical Guide Line when dragging, hovered, or active simulation tick */}
              {(isDraggingThis || isHoveredThis || isSimulatingActive) && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + chartHeight}
                  stroke={isHoveredThis && idx === safeHourIdx ? (isRed ? "#f43f5e" : "#10b981") : (isSimulatingActive && !isHoveredThis ? (isRed ? "#f43f5e" : "#34d399") : "#3b82f6")}
                  strokeDasharray="2 2"
                  strokeWidth={isSimulatingActive || isHoveredThis ? "2" : "1.5"}
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

              {/* Visible Circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isDraggingThis || isHoveredThis || isSimulatingActive ? 6 : 4}
                className={cn(
                  "cursor-ns-resize transition-all hover:scale-125",
                  isHoveredThis && idx === safeHourIdx
                    ? (isRed ? "fill-rose-500 stroke-white ring-4 ring-rose-500/50" : "fill-emerald-400 stroke-white ring-4 ring-emerald-500/50")
                    : isSimulatingActive && !isHoveredThis
                      ? (isRed ? "fill-rose-500 stroke-white dark:stroke-slate-900 ring-4 ring-rose-500/50" : "fill-emerald-400 stroke-white dark:stroke-slate-900 ring-4 ring-emerald-500/50")
                      : isDraggingThis || isHoveredThis
                        ? "fill-blue-400 stroke-white ring-4 ring-blue-500/50"
                        : "fill-blue-500 stroke-white dark:stroke-slate-900"
                )}
                strokeWidth="1.5"
                onPointerDown={(e) => handlePointerDown(pt.hour, e)}
              />

              {/* Tooltip Card directly on chart when hovered or dragging */}
              {(isDraggingThis || isHoveredThis) && (
                <g transform={`translate(${pt.x}, ${Math.max(padTop + 20, pt.y - 32)})`}>
                  <rect
                    x="-45"
                    y="-14"
                    width="90"
                    height="22"
                    rx="6"
                    className={cn(
                      "shadow-lg backdrop-blur-md",
                      colorMode === 'dark' ? "fill-slate-900/90 stroke-blue-500/50" : "fill-white/95 stroke-blue-400"
                    )}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    className={cn(
                      "text-[10px] font-mono font-bold select-none",
                      colorMode === 'dark' ? "fill-blue-400" : "fill-blue-600"
                    )}
                  >
                    {`${pt.hour} • ${pt.val.toLocaleString()}`}
                  </text>
                </g>
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

  const edges = useFlowStore((state) => state.edges);
  const nodes = useFlowStore((state) => state.nodes);

  const outgoingEdges = edges.filter((e) => String(e.source) === String(selectedNode?.id));
  const isRed = useMemo(() => {
    if (outgoingEdges.length === 0) return true;
    if (outgoingEdges.some((e) => e.data?.validationError)) return true;
    const targets = outgoingEdges.map((e) => nodes.find((n) => String(n.id) === String(e.target)));
    return targets.some((t) => !t || (t.type === 'Pod' || t.type === 'Deployment') && t.data?.status !== 'ready');
  }, [outgoingEdges, nodes]);

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
                      <MiniCurvePreview profile={p} isApplied={isApplied} currentHourIndex={currentHourIndex} isRed={isRed} />
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
              isRed={isRed}
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
              isRed={isRed}
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
