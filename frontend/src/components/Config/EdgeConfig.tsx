import { useFlowStore } from '@/store';
import { Layers, Palette, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColorPalette } from '../UI/ColorPalette';
import {
  formatColorName,
  useEdgeConfigHandler
} from '@/activities/config';

interface EdgeConfigProps {
  selectedEdge: any;
}

export const EdgeConfig = ({ selectedEdge }: EdgeConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const {
    edgeWidth,
    globalEdgeColor,
    globalEdgeErrorColor,
    updateEdgeData,
    handleRunningColorChange,
    handleErrorColorChange,
    resetRunningColor,
    resetErrorColor,
  } = useEdgeConfigHandler(selectedEdge);

  return (
    <div className="space-y-6">
      {/* Thickness */}
      <div className="space-y-2">
        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Layers size={10} /> Thickness
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={edgeWidth}
            onChange={(e) => updateEdgeData({ width: Number.parseInt(e.target.value, 10) })}
            className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {edgeWidth}px
          </span>
        </div>
      </div>

      {/* Global Color Palette Sections */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Palette size={10} /> Connection Styles
          </label>
          <span className="text-[8px] text-slate-400 italic leading-tight">These colors apply to all connections in the diagram.</span>
        </div>

        {/* Running Color */}
        <div className={cn(
          "p-3 rounded-lg border space-y-3 transition-colors",
          colorMode === 'dark'
            ? "bg-slate-800/40 border-slate-700/50"
            : "bg-slate-50/50 border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Normal / Running</span>
            </div>
            <button
              type="button"
              onClick={resetRunningColor}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-600"
              title="Reset to default"
            >
              <RefreshCcw size={10} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 shadow-sm"
                style={{ backgroundColor: globalEdgeColor }}
              />
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full traffic-line"
                    style={{
                      backgroundColor: globalEdgeColor,
                      width: '100%',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{formatColorName(globalEdgeColor)}</span>
              </div>
            </div>
            <ColorPalette selectedColor={globalEdgeColor} onSelect={handleRunningColorChange} className="mt-2" />
          </div>
        </div>

        {/* Error Color */}
        <div className={cn(
          "p-3 rounded-lg border space-y-3 transition-colors",
          colorMode === 'dark'
            ? "bg-slate-800/40 border-slate-700/50"
            : "bg-slate-50/50 border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={12} className="text-red-500" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Error State</span>
            </div>
            <button
              type="button"
              onClick={resetErrorColor}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-600"
              title="Reset to default"
            >
              <RefreshCcw size={10} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 shadow-sm"
                style={{ backgroundColor: globalEdgeErrorColor }}
              />
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: globalEdgeErrorColor,
                      width: '100%',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{formatColorName(globalEdgeErrorColor)}</span>
              </div>
            </div>
            <ColorPalette selectedColor={globalEdgeErrorColor} onSelect={handleErrorColorChange} className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
};
