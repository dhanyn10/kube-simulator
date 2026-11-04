import React from 'react';
import { cn } from '@/lib/utils';

export interface ResourceRangeBarProps {
  readonly label: string;
  readonly unit: string;
  readonly requestStr: string;
  readonly limitStr: string;
  readonly parsedRequest: number;
  readonly parsedLimit: number;
  readonly maxScale?: number;
  readonly colorMode?: string;
  readonly formatDisplay?: (value: number) => string;
}

export const ResourceRangeBar: React.FC<ResourceRangeBarProps> = ({
  label,
  unit,
  requestStr,
  limitStr,
  parsedRequest,
  parsedLimit,
  maxScale = 2000,
  colorMode = 'dark',
  formatDisplay,
}) => {
  const isInvalid = parsedRequest > parsedLimit;
  const isGuaranteed = parsedRequest === parsedLimit;
  const burstValue = Math.max(0, parsedLimit - parsedRequest);

  const effectiveMax = Math.max(maxScale, parsedLimit, parsedRequest, 1);
  const reqPercent = Math.min(100, Math.max(0, (parsedRequest / effectiveMax) * 100));
  const limPercent = Math.min(100, Math.max(0, (parsedLimit / effectiveMax) * 100));
  const burstWidth = Math.max(0, limPercent - reqPercent);

  const formatText = (num: number) => {
    if (formatDisplay) return formatDisplay(num);
    return `${num}${unit}`;
  };

  const renderStatusBadge = () => {
    const labelKey = label.toLowerCase();
    if (isInvalid) {
      return (
        <span
          data-testid={`range-status-invalid-${labelKey}`}
          className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-rose-500/20 text-rose-300 border border-rose-500/40"
        >
          Invalid: Request &gt; Limit
        </span>
      );
    }
    if (isGuaranteed) {
      return (
        <span
          data-testid={`range-status-guaranteed-${labelKey}`}
          className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
        >
          Guaranteed ({requestStr})
        </span>
      );
    }
    return (
      <span
        data-testid={`range-status-burstable-${labelKey}`}
        className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-purple-500/15 text-purple-300 border border-purple-500/30"
      >
        {requestStr} &rarr; {limitStr} (+{formatText(burstValue)} burst)
      </span>
    );
  };

  return (
    <div className="space-y-1.5 pt-1" data-testid={`resource-range-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-400">{label} Range</span>
        {renderStatusBadge()}
      </div>

      <div
        className={cn(
          "relative h-3 w-full rounded-full overflow-hidden border",
          colorMode === 'dark' ? "bg-slate-900 border-slate-700/60" : "bg-slate-200 border-slate-300"
        )}
      >
        {isInvalid ? (
          <div
            data-testid={`range-track-invalid-${label.toLowerCase()}`}
            className="h-full bg-rose-500/80 transition-all duration-300"
            style={{ width: `${Math.max(reqPercent, limPercent)}%` }}
          />
        ) : (
          <>
            <div
              data-testid={`range-track-reserved-${label.toLowerCase()}`}
              className="absolute left-0 top-0 bottom-0 bg-purple-600 transition-all duration-300"
              style={{ width: `${reqPercent}%` }}
              title={`Reserved Request: ${requestStr}`}
            />
            {burstWidth > 0 && (
              <div
                data-testid={`range-track-burst-${label.toLowerCase()}`}
                className="absolute top-0 bottom-0 bg-purple-400/40 border-l border-purple-300/50 transition-all duration-300"
                style={{ left: `${reqPercent}%`, width: `${burstWidth}%` }}
                title={`Burstable Headroom: +${formatText(burstValue)}`}
              />
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>0</span>
        <div className="flex items-center gap-3 text-[9px] font-sans">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-600" />
            <span>Reserved</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400/40 border border-purple-300/50" />
            <span>Burstable</span>
          </span>
        </div>
        <span>Max: {formatText(effectiveMax)}</span>
      </div>
    </div>
  );
};
