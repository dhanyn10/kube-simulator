
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Layers, Palette, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';

interface EdgeConfigProps {
  selectedEdge: any;
}

const DEFAULT_RUNNING_COLOR = '#1d4ed8';
const DEFAULT_ERROR_COLOR = '#ef4444';

export const EdgeConfig = ({ selectedEdge }: EdgeConfigProps) => {
  const edges = useFlowStore((state) => state.edges);
  const setEdges = useFlowStore((state) => state.setEdges);

  const data = selectedEdge.data || {};
  const runningColor = data.color || DEFAULT_RUNNING_COLOR;
  const errorColor = data.errorColor || DEFAULT_ERROR_COLOR;
  const edgeWidth = data.width || 2;

  const updateEdgeData = (newData: any) => {
    setEdges(edges.map(e => e.id === selectedEdge.id ? {
      ...e,
      data: { ...(e.data || {}), ...newData }
    } : e));
  };

  const handleRunningColorChange = (newColor: string) => {
    if (newColor.toLowerCase() === errorColor.toLowerCase()) {
      // Swap colors
      updateEdgeData({ color: newColor, errorColor: runningColor });
    } else {
      updateEdgeData({ color: newColor });
    }
  };

  const handleErrorColorChange = (newColor: string) => {
    if (newColor.toLowerCase() === runningColor.toLowerCase()) {
      // Swap colors
      updateEdgeData({ errorColor: newColor, color: errorColor });
    } else {
      updateEdgeData({ errorColor: newColor });
    }
  };

  const resetRunningColor = () => updateEdgeData({ color: DEFAULT_RUNNING_COLOR });
  const resetErrorColor = () => updateEdgeData({ errorColor: DEFAULT_ERROR_COLOR });

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

      {/* Color Palette Sections */}
      <div className="space-y-4">
        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Palette size={10} /> Connection Colors
        </label>

        {/* Running Color */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Normal / Running</span>
            </div>
            <button
              onClick={resetRunningColor}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-600"
              title="Reset to default"
            >
              <RefreshCcw size={10} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div
                className="w-10 h-10 rounded-lg border-2 border-white dark:border-slate-800 shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: runningColor }}
              />
              <input
                type="color"
                value={runningColor}
                onChange={(e) => handleRunningColorChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full traffic-line"
                  style={{
                    backgroundColor: runningColor,
                    width: '100%',
                    boxShadow: `0 0 8px ${runningColor}44`
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{runningColor}</span>
            </div>
          </div>
        </div>

        {/* Error Color */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={12} className="text-red-500" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Error State</span>
            </div>
            <button
              onClick={resetErrorColor}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-600"
              title="Reset to default"
            >
              <RefreshCcw size={10} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div
                className="w-10 h-10 rounded-lg border-2 border-white dark:border-slate-800 shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: errorColor }}
              />
              <input
                type="color"
                value={errorColor}
                onChange={(e) => handleErrorColorChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    backgroundColor: errorColor,
                    width: '100%',
                    boxShadow: `0 0 8px ${errorColor}44`
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{errorColor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
