import React, { useRef, useState } from 'react';
import { Activity, Edit2, ZoomIn, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/useFlowStore';
import {
  InternetProfileItem,
  calculateProfileChartData,
  calculateYValueFromPointer,
  calculateMinutePoint,
  calculateProfileHoverData,
  generateProfileIntervalPoints,
  PROFILE_INTERVAL_OPTIONS,
  ProfileHoverData
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
  const [hoverData, setHoverData] = useState<ProfileHoverData | null>(null);

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

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    const data = calculateProfileHoverData(
      relativeX,
      relativeY,
      rect.width,
      rect.height,
      padLeft,
      chartWidth,
      points
    );
    setHoverData(data);
  };

  const handlePointerLeave = () => {
    setHoverData(null);
  };

  return (
    <div className="relative w-full h-12 my-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible cursor-pointer select-none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />

        {/* Traffic Position Dot for Applied Profile (shown when not hovering) */}
        {isApplied && !hoverData && (
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

        {/* Hover Position Indicator Dot (Only 1 dot rendered, 100% aligned with cursor X position) */}
        {hoverData && (
          <g key={`mini-traffic-dot-hover-${hoverData.minuteIndex}`} data-testid="mini-hover-traffic-dot" className="cursor-pointer pointer-events-none">
            <circle
              cx={hoverData.x}
              cy={hoverData.y}
              r="4"
              className={getMiniHoverDotClass(hoverData.minuteIndex === minuteIdx, isRed)}
              strokeWidth="1.5"
            />
            <title>{`${hoverData.hourStr} - ${hoverData.val.toLocaleString()} visits`}</title>
          </g>
        )}

        {/* Strict Graph Canvas Hover Overlay Rect */}
        <rect
          data-testid="mini-chart-canvas-overlay"
          x={padLeft}
          y={padTop}
          width={chartWidth}
          height={chartHeight}
          className="fill-transparent cursor-pointer pointer-events-auto"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />
      </svg>
    </div>
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
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [zoomScale, setZoomScale] = useState<number>(100);

  const baseWidth = 680;
  const width = Math.round((baseWidth * zoomScale) / 100);
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

  const { intervalPoints } = generateProfileIntervalPoints(
    profile,
    intervalMinutes,
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

  const [hoverData, setHoverData] = useState<ProfileHoverData | null>(null);

  const handleGraphPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    const data = calculateProfileHoverData(
      relativeX,
      relativeY,
      rect.width,
      rect.height,
      padLeft,
      chartWidth,
      points
    );
    if (!draggingHour) {
      setHoverData(data);
    }
  };

  const handleGraphPointerLeave = () => {
    if (!draggingHour) {
      setHoverData(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
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

      {/* Interactive Controls Bar: Interval Resolution Dropdown & Horizontal Zoom Slider */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3 px-1 py-1.5 rounded-lg border bg-slate-900/40 border-slate-800 text-xs">
        {/* Interval Dropdown */}
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-400" />
          <span className="font-semibold text-slate-300">Interval:</span>
          <select
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className={cn(
              "px-2 py-1 rounded border text-xs font-bold outline-none cursor-pointer transition-all",
              colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-blue-400" : "bg-white border-slate-300 text-blue-600"
            )}
          >
            {PROFILE_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.minutes} value={opt.minutes}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Horizontal Zoom Slider */}
        <div className="flex items-center gap-2 flex-1 max-w-xs justify-end">
          <ZoomIn size={14} className="text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-300 text-[11px] shrink-0">Horizontal Zoom:</span>
          <input
            type="range"
            min={100}
            max={800}
            step={10}
            value={zoomScale}
            onChange={(e) => setZoomScale(Number(e.target.value))}
            className="w-28 accent-blue-500 cursor-pointer h-1.5 rounded-lg bg-slate-700"
          />
          <span className="font-mono text-[10px] text-slate-400 w-10 text-right shrink-0">{zoomScale}%</span>
        </div>
      </div>

      <p className="text-[11px] font-medium text-slate-400 mb-2 px-1">
        💡 Drag data points vertically up/down on the Y-axis to dynamically modify traffic values.
      </p>

      {/* Scrollable Container for Horizontal Zooming */}
      <div className="w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: zoomScale > 100 ? `${width}px` : '100%',
          minWidth: '100%',
          height: `${height}px`
        }}
        preserveAspectRatio="none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="overflow-visible select-none touch-none cursor-ns-resize"
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

        {/* Strict Graph Canvas Hover Overlay Rect (detects pointer strictly inside graph bounds) */}
        <rect
          data-testid="interactive-chart-canvas-overlay"
          x={padLeft}
          y={padTop}
          width={chartWidth}
          height={chartHeight}
          className="fill-transparent cursor-ns-resize pointer-events-auto"
          onPointerMove={handleGraphPointerMove}
          onPointerLeave={handleGraphPointerLeave}
        />

        {/* Minute-level Active Traffic Indicator Dot (shown when not hovering) */}
        {isSimulating && isApplied && !hoverData && (
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

        {/* Minute-level Hover Indicator (Only 1 dot rendered, 100% aligned with cursor X position) */}
        {!draggingHour && hoverData && (
          <g key={`interactive-hover-minute-${hoverData.hourStr}`} data-testid="interactive-hover-minute-indicator" className="pointer-events-none">
            <line
              x1={hoverData.x}
              y1={padTop}
              x2={hoverData.x}
              y2={padTop + chartHeight}
              stroke="#3b82f6"
              strokeDasharray="2 2"
              strokeWidth="1.5"
            />
            <circle cx={hoverData.x} cy={hoverData.y} r="8" className="fill-transparent" />
            <circle
              cx={hoverData.x}
              cy={hoverData.y}
              r="5"
              className="fill-blue-500 stroke-white dark:stroke-slate-900"
              strokeWidth="1.5"
            />
            <g transform={`translate(${hoverData.x}, ${Math.max(padTop + 20, hoverData.y - 32)})`}>
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
                {`${hoverData.hourStr} • ${hoverData.val.toLocaleString()}`}
              </text>
            </g>
          </g>
        )}

        {/* Reference points for selected interval (render vertical drag target points) */}
        {intervalPoints.map((pt) => {
          const isDraggingThis = draggingHour === pt.hour;
          return (
            <g key={`ref-pt-${pt.hour}`}>
              {/* Invisible touch target for drag ease */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="10"
                className="fill-transparent cursor-ns-resize"
                onPointerDown={(e) => handlePointerDown(pt.hour, e)}
              />

              {/* Small point indicator */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isDraggingThis ? 6 : 3}
                className={cn(
                  "cursor-ns-resize transition-all hover:scale-150",
                  isDraggingThis ? "fill-blue-400 stroke-white dark:stroke-slate-900" : "fill-blue-500/70 hover:fill-blue-400"
                )}
                strokeWidth="1.5"
                onPointerDown={(e) => handlePointerDown(pt.hour, e)}
              />
            </g>
          );
        })}

        {/* Interactive Data points & X-axis Hour labels */}
        {points.map((pt, idx) => {
          const isDraggingThis = draggingHour === pt.hour;
          const isSimulatingActive = isSimulating && isApplied && idx === safeHourIdx;
          const isSameHour = idx === safeHourIdx;
          const showLabel = idx % 3 === 0 || idx === points.length - 1;

          const guideLineStroke = getGuideLineStroke(false, isSimulatingActive, isSameHour, isRed);
          const pointFillClass = getPointFillClass(false, isSameHour, isSimulatingActive, isDraggingThis, isRed);

          return (
            <g key={`pt-${pt.hour}`}>
              {/* Vertical Guide Line when dragging or active simulation tick */}
              {(isDraggingThis || isSimulatingActive) && (
                <line
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + chartHeight}
                  stroke={guideLineStroke}
                  strokeDasharray="2 2"
                  strokeWidth={isSimulatingActive ? "2" : "1.5"}
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

              {/* Visible Circle - only rendered when actively dragging an hourly point */}
              {isDraggingThis && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={6}
                  className={cn("cursor-ns-resize transition-all hover:scale-125", pointFillClass)}
                  strokeWidth="1.5"
                  onPointerDown={(e) => handlePointerDown(pt.hour, e)}
                />
              )}

              {/* Tooltip Card directly on chart when dragging an hourly point */}
              {isDraggingThis && (
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
    </div>
  );
};
