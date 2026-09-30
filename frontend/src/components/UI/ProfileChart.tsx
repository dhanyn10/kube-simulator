import React, { useRef, useState } from 'react';
import { Activity, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/useFlowStore';
import {
  InternetProfileItem,
  calculateProfileChartData,
  calculateHourIndexFromX,
  calculateMinuteIndexFromX,
  calculateYValueFromPointer,
  calculateMinutePoint
} from '@/activities/modals';
import {
  getMiniHoverDotClass,
  getGuideLineStroke,
  getPointFillClass,
} from '@/activities/ui';

export interface MiniCurvePreviewProps {
  readonly profile: InternetProfileItem;
  readonly isApplied?: boolean;
  readonly currentHourIndex?: number;
  readonly currentMinuteIndex?: number;
  readonly isRed?: boolean;
}

export const MiniCurvePreview: React.FC<MiniCurvePreviewProps> = ({
  profile,
  isApplied,
  currentHourIndex,
  currentMinuteIndex,
  isRed
}) => {
  const [hoveredMinuteIdx, setHoveredMinuteIdx] = useState<number | null>(null);

  const width = 220;
  const height = 55;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 10;

  const { points, pathD, areaD, minVal, maxVal, chartWidth, chartHeight } = calculateProfileChartData(
    profile,
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom
  );

  const gradientId = `miniGrad-${profile.name.replaceAll(/\s+/g, '-')}`;

  let minuteIdx = 0;
  if (typeof currentMinuteIndex === 'number') {
    minuteIdx = currentMinuteIndex;
  } else if (typeof currentHourIndex === 'number') {
    minuteIdx = currentHourIndex * 60;
  }
  const currentPt = calculateMinutePoint(points, minuteIdx, minVal, maxVal, chartHeight, padTop);
  const currentVal = currentPt.val;
  const currentHour = currentPt.hour;

  const hoveredPt = hoveredMinuteIdx !== null ? calculateMinutePoint(points, hoveredMinuteIdx, minVal, maxVal, chartHeight, padTop) : null;
  const hoveredVal = hoveredPt ? hoveredPt.val : 0;
  const hoveredTimeStr = hoveredPt ? hoveredPt.hour : '00:00';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const minIdx = calculateMinuteIndexFromX(mouseX, rect.width, width, padLeft, padRight, chartWidth);
    setHoveredMinuteIdx(minIdx);
  };

  const handleMouseLeave = () => {
    setHoveredMinuteIdx(null);
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

      {/* Traffic Position Dot for Applied Profile */}
      {isApplied && (
        <g key={`mini-traffic-dot-active-${minuteIdx}`} data-testid="mini-active-traffic-dot" className="group/minidot cursor-pointer">
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
        <g key={`mini-traffic-dot-hover-${hoveredMinuteIdx}`} data-testid="mini-hover-traffic-dot" className="cursor-pointer">
          <circle
            cx={hoveredPt.x}
            cy={hoveredPt.y}
            r="4"
            className={getMiniHoverDotClass(hoveredMinuteIdx === minuteIdx, isRed)}
            strokeWidth="1.5"
          />
          <title>{`${hoveredTimeStr} - ${hoveredVal.toLocaleString()} visits`}</title>
        </g>
      )}
    </svg>
  );
};

export interface InteractiveTrafficChartProps {
  readonly profile: InternetProfileItem;
  readonly colorMode: string;
  readonly isApplied?: boolean;
  readonly currentHourIndex?: number;
  readonly currentMinuteIndex?: number;
  readonly isRed?: boolean;
  readonly onUpdatePoint: (hour: string, newValue: number) => void;
  readonly onUpdateName: (newName: string) => void;
}

export const InteractiveTrafficChart: React.FC<InteractiveTrafficChartProps> = ({
  profile,
  colorMode,
  isApplied,
  currentHourIndex,
  currentMinuteIndex,
  isRed,
  onUpdatePoint,
  onUpdateName
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

  const { values, points, pathD, areaD, minVal, maxVal, chartWidth, chartHeight } = calculateProfileChartData(
    profile,
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom
  );

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const val = Math.round(minVal + (maxVal - minVal) * (1 - ratio));
    const y = padTop + chartHeight * ratio;
    return { val, y };
  });

  const safeHourIdx = typeof currentHourIndex === 'number' ? (currentHourIndex % 24) : 0;
  let minuteIdx = 0;
  if (typeof currentMinuteIndex === 'number') {
    minuteIdx = currentMinuteIndex;
  } else if (typeof currentHourIndex === 'number') {
    minuteIdx = currentHourIndex * 60;
  }
  const activeMinutePt = calculateMinutePoint(points, minuteIdx, minVal, maxVal, chartHeight, padTop);

  const handlePointerDown = (hour: string, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDraggingHour(hour);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const hourIdx = calculateHourIndexFromX(clientX, rect.width, width, padLeft, padRight, chartWidth);
      setHoveredHourIdx(hourIdx);
    }

    if (!draggingHour || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const finalVal = calculateYValueFromPointer(clientY, rect.height, height, padTop, chartHeight, minVal, maxVal);

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
        {yTicks.map((tick) => (
          <g key={`y-tick-${tick.val}-${tick.y}`}>
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

        {/* Minute-level Active Traffic Indicator Dot */}
        {isSimulating && isApplied && (
          <g key={`interactive-active-traffic-dot-${minuteIdx}`} data-testid="interactive-active-traffic-dot">
            <line
              x1={activeMinutePt.x}
              y1={padTop}
              x2={activeMinutePt.x}
              y2={padTop + chartHeight}
              stroke={isRed ? '#f43f5e' : '#10b981'}
              strokeDasharray="2 2"
              strokeWidth="2"
            />
            <circle cx={activeMinutePt.x} cy={activeMinutePt.y} r="8" className="fill-transparent" />
            <circle
              cx={activeMinutePt.x}
              cy={activeMinutePt.y}
              r="5"
              className={isRed ? "fill-rose-500 stroke-white dark:stroke-slate-900" : "fill-emerald-400 stroke-white dark:stroke-slate-900"}
              strokeWidth="1.5"
            />
            <title>{`${activeMinutePt.hour} - ${activeMinutePt.val.toLocaleString()} visits`}</title>
          </g>
        )}

        {/* Interactive Data points & X-axis Hour labels */}
        {points.map((pt, idx) => {
          const isDraggingThis = draggingHour === pt.hour;
          const isHoveredThis = hoveredHourIdx === idx;
          const isSimulatingActive = isSimulating && isApplied && idx === safeHourIdx;
          const isSameHour = idx === safeHourIdx;
          const showLabel = idx % 3 === 0 || idx === points.length - 1;

          const guideLineStroke = getGuideLineStroke(isHoveredThis, isSimulatingActive, isSameHour, isRed);
          const pointFillClass = getPointFillClass(isHoveredThis, isSameHour, isSimulatingActive, isDraggingThis, isRed);

          return (
            <g key={`pt-${pt.hour}`}>
              {/* Vertical Guide Line when dragging, hovered, or active simulation tick */}
              {(isDraggingThis || isHoveredThis || isSimulatingActive) && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + chartHeight}
                  stroke={guideLineStroke}
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

              {/* Visible Circle - only rendered when dragging, hovered, or actively simulating */}
              {(isDraggingThis || isHoveredThis || isSimulatingActive) && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={6}
                  className={cn("cursor-ns-resize transition-all hover:scale-125", pointFillClass)}
                  strokeWidth="1.5"
                  onPointerDown={(e) => handlePointerDown(pt.hour, e)}
                />
              )}

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
