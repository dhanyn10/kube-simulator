import React, { useRef, useEffect } from 'react';
import { Grid, X, LayoutGrid, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';

export interface CanvasProfilePopoverProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly colorMode: 'dark' | 'light';
}

const PATTERNS = [
  { id: 'dots', label: 'Dots' },
  { id: 'lines', label: 'Lines' },
  { id: 'cross', label: 'Cross' },
] as const;

const getPatternButtonClass = (active: boolean, isDark: boolean): string => {
  if (active) {
    return 'bg-blue-600 text-white shadow-sm font-bold';
  }
  if (isDark) {
    return 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';
  }
  return 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50';
};

export const CanvasProfilePopover: React.FC<CanvasProfilePopoverProps> = ({
  isOpen,
  onClose,
  colorMode,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const canvasBgVariant = useFlowStore((state) => state.canvasBgVariant);
  const setCanvasBgVariant = useFlowStore((state) => state.setCanvasBgVariant);
  const canvasBgOpacity = useFlowStore((state) => state.canvasBgOpacity);
  const setCanvasBgOpacity = useFlowStore((state) => state.setCanvasBgOpacity);
  const isAutosaveEnabled = useFlowStore((state) => state.isAutosaveEnabled);
  const toggleAutosave = useFlowStore((state) => state.toggleAutosave);
  const alignAllNodesToGrid = useFlowStore((state) => state.alignAllNodesToGrid);

  const isDark = colorMode === 'dark';

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      data-testid="canvas-profile-popover"
      className={cn(
        "absolute left-14 top-0 w-64 rounded-xl border p-3.5 shadow-2xl z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-none",
        isDark
          ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/60"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-500/10 text-blue-500">
            <Grid size={15} />
          </div>
          <div>
            <h4 className="text-xs font-bold leading-none tracking-tight">Canvas Profile</h4>
            <span className="text-[10px] text-slate-400">Display & Grid Environment</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Canvas Profile"
          className={cn(
            "p-1 rounded-md transition-colors",
            isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
          )}
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        {/* Pattern Variant Selector */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Grid Pattern
          </span>
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-500/10 border border-slate-500/10">
            {PATTERNS.map((p) => {
              const active = canvasBgVariant === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`pattern-btn-${p.id}`}
                  onClick={() => setCanvasBgVariant(p.id)}
                  className={cn(
                    "py-1 px-1.5 text-center text-[11px] font-semibold rounded-md transition-all",
                    getPatternButtonClass(active, isDark)
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Opacity Range Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Grid Opacity
            </span>
            <span className="text-[11px] font-mono font-semibold text-blue-400">
              {Math.round(canvasBgOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            aria-label="Grid Opacity"
            value={canvasBgOpacity}
            onChange={(e) => setCanvasBgOpacity(Number.parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700/30 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Autosave Switch */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            <span className="text-[11px] font-medium">Autosave</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isAutosaveEnabled}
            data-testid="canvas-autosave-toggle"
            onClick={toggleAutosave}
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md transition-all border",
              isAutosaveEnabled
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
            )}
          >
            {isAutosaveEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Align to Grid Button */}
        <button
          type="button"
          data-testid="canvas-popover-align-btn"
          onClick={() => {
            alignAllNodesToGrid();
          }}
          className={cn(
            "w-full py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors border text-[11px]",
            isDark
              ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
              : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
          )}
        >
          <LayoutGrid size={13} />
          <span>Snap & Align Cards</span>
        </button>
      </div>
    </div>
  );
};
