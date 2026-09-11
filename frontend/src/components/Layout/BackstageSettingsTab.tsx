import React from 'react';
import { Eye, Grid, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColorPalette } from '@/components/UI/ColorPalette';
import { BackstageTab } from '@/activity/layout/fileBackstageHelpers';

export interface BackstageSettingsTabProps {
  readonly activeTab: BackstageTab;
  readonly colorMode: 'dark' | 'light';
  readonly isSidebarVisible: boolean;
  readonly isRightSidebarVisible: boolean;
  readonly isMonitoringOpen: boolean;
  readonly isAutofocusEnabled: boolean;
  readonly canvasBgVariant: 'dots' | 'lines' | 'cross';
  readonly canvasBgColor: string;
  readonly canvasBgOpacity: number;
  readonly setSidebarVisible: (val: boolean) => void;
  readonly setRightSidebarVisible: (val: boolean) => void;
  readonly setMonitoringOpen: (val: boolean) => void;
  readonly toggleAutofocus: () => void;
  readonly setCanvasBgVariant: (val: 'dots' | 'lines' | 'cross') => void;
  readonly setCanvasBgColor: (val: string) => void;
  readonly setCanvasBgOpacity: (val: number) => void;
}

/**
 * Settings tab content for View & Layout and Canvas Grid options.
 */
export const BackstageSettingsTab: React.FC<BackstageSettingsTabProps> = ({
  activeTab,
  colorMode,
  isSidebarVisible,
  isRightSidebarVisible,
  isMonitoringOpen,
  isAutofocusEnabled,
  canvasBgVariant,
  canvasBgColor,
  canvasBgOpacity,
  setSidebarVisible,
  setRightSidebarVisible,
  setMonitoringOpen,
  toggleAutofocus,
  setCanvasBgVariant,
  setCanvasBgColor,
  setCanvasBgOpacity,
}) => {
  const isDark = colorMode === 'dark';
  const activeBtnClass = "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10 border-blue-600";
  const inactiveBtnClass = isDark
    ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
    : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700";

  if (activeTab === 'settings-view') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="border-b pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">View & Layout Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Toggle panels, sidebars, and autofocus behaviors</p>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Eye size={24} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className={cn(
            "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
            isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
          )}>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Components Sidebar</span>
              <span className="text-xs opacity-60">Show left resource palette</span>
            </div>
            <input
              type="checkbox"
              checked={isSidebarVisible}
              onChange={() => setSidebarVisible(!isSidebarVisible)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className={cn(
            "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
            isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
          )}>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Utilities Sidebar</span>
              <span className="text-xs opacity-60">Show right configuration panel</span>
            </div>
            <input
              type="checkbox"
              checked={isRightSidebarVisible}
              onChange={() => setRightSidebarVisible(!isRightSidebarVisible)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className={cn(
            "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
            isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
          )}>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Simulation Panel</span>
              <span className="text-xs opacity-60">Show monitoring graph & telemetry</span>
            </div>
            <input
              type="checkbox"
              checked={isMonitoringOpen}
              onChange={() => setMonitoringOpen(!isMonitoringOpen)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className={cn(
            "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
            isDark ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
          )}>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Autofocus</span>
              <span className="text-xs opacity-60">Auto zoom on node selection</span>
            </div>
            <input
              type="checkbox"
              checked={isAutofocusEnabled}
              onChange={() => toggleAutofocus()}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>
      </div>
    );
  }

  if (activeTab === 'settings-canvas') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="border-b pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Canvas Grid Customization</h1>
            <p className="text-xs text-slate-500 mt-0.5">Customize background patterns, dot/line colors, and grid opacity</p>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Grid size={24} />
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">Background Pattern</span>
          <div className="flex gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setCanvasBgVariant('dots')}
              className={cn(
                "flex-1 py-3 px-5 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                canvasBgVariant === 'dots' ? activeBtnClass : inactiveBtnClass
              )}
            >
              Dots Pattern
            </button>
            <button
              type="button"
              onClick={() => setCanvasBgVariant('lines')}
              className={cn(
                "flex-1 py-3 px-5 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                canvasBgVariant === 'lines' ? activeBtnClass : inactiveBtnClass
              )}
            >
              Lines Grid
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between max-w-md">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Grid / Dot Color</span>
            {canvasBgColor !== 'default' && (
              <button
                type="button"
                onClick={() => setCanvasBgColor('default')}
                className="text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Reset Color
              </button>
            )}
          </div>

          <ColorPalette
            selectedColor={canvasBgColor}
            onSelect={setCanvasBgColor}
            className="max-w-md"
          />
        </div>

        <div className="space-y-3 max-w-md">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="canvas-grid-opacity-input" className="font-bold uppercase text-slate-400 tracking-wider">
              Opacity / Intensity
            </label>
            <span className="font-extrabold text-blue-500">{Math.round(canvasBgOpacity * 100)}%</span>
          </div>
          <input
            id="canvas-grid-opacity-input"
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={canvasBgOpacity}
            onChange={(e) => setCanvasBgOpacity(Number.parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    );
  }

  return null;
};
