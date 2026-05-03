import React from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Layers, Code } from 'lucide-react';

interface EdgeConfigProps {
  selectedEdge: any;
}

export const EdgeConfig = ({ selectedEdge }: EdgeConfigProps) => {
  const edges = useFlowStore((state) => state.edges);
  const setEdges = useFlowStore((state) => state.setEdges);

  const data = selectedEdge.data || {};
  const edgeColor = data.color || '#1d4ed8';
  const edgeWidth = data.width || 2;

  const updateEdgeData = (newData: any) => {
    setEdges(edges.map(e => e.id === selectedEdge.id ? {
      ...e,
      data: { ...(e.data || {}), ...newData }
    } : e));
  };

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
            onChange={(e) => updateEdgeData({ width: parseInt(e.target.value) })}
            className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {edgeWidth}px
          </span>
        </div>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Code size={10} /> Color Palette
        </label>
        <div className="grid grid-cols-5 gap-2">
          {['#1d4ed8', '#ef4444', '#10b981', '#f59e0b', '#6366f1'].map((c) => (
            <button
              key={c}
              onClick={() => updateEdgeData({ color: c })}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                edgeColor === c ? "border-slate-400 dark:border-slate-300 scale-110 shadow-md" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform">
            <input
              type="color"
              value={edgeColor}
              onChange={(e) => updateEdgeData({ color: e.target.value })}
              className="absolute -top-1 -left-1 w-10 h-10 cursor-pointer bg-transparent border-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
