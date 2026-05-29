
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Layers, Palette, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { ColorPalette } from './ColorPalette';

interface EdgeConfigProps {
  selectedEdge: any;
}

const DEFAULT_RUNNING_COLOR = 'var(--color-mat-indigo)';
const DEFAULT_ERROR_COLOR = 'var(--color-mat-red)';

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
      updateEdgeData({ color: newColor, errorColor: runningColor });
    } else {
      updateEdgeData({ color: newColor });
    }
  };

  const handleErrorColorChange = (newColor: string) => {
    if (newColor.toLowerCase() === runningColor.toLowerCase()) {
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

          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 shadow-sm"
                style={{ backgroundColor: runningColor }}
              />
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full traffic-line"
                    style={{
                      backgroundColor: runningColor,
                      width: '100%',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{runningColor.replace('var(--color-mat-', '').replace(')', '')}</span>
              </div>
            </div>
            <ColorPalette selectedColor={runningColor} onSelect={handleRunningColorChange} className="mt-2" />
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

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 shadow-sm"
                style={{ backgroundColor: errorColor }}
              />
              <div className="flex-1 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: errorColor,
                      width: '100%',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{errorColor.replace('var(--color-mat-', '').replace(')', '')}</span>
              </div>
            </div>
            <ColorPalette selectedColor={errorColor} onSelect={handleErrorColorChange} className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
};
