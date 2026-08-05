import React, { useState } from 'react';
import { Sliders, Eye, Grid, RefreshCw } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { Modal } from './Modal';
import { ColorPalette } from '../UI/ColorPalette';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'view' | 'canvas';

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const [activeTab, setActiveTab] = useState<SettingsTab>('view');

  const getTabClass = (tab: SettingsTab) => {
    const isSelected = activeTab === tab;
    if (colorMode === 'dark') {
      return isSelected
        ? "bg-slate-800 text-blue-400"
        : "text-slate-400 hover:bg-slate-800/30 hover:text-slate-200";
    } else {
      return isSelected
        ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
    }
  };

  const isSidebarVisible = useFlowStore((state) => state.isSidebarVisible);
  const isRightSidebarVisible = useFlowStore((state) => state.isRightSidebarVisible);
  const isMonitoringOpen = useFlowStore((state) => state.isMonitoringOpen);
  const isAutofocusEnabled = useFlowStore((state) => state.isAutofocusEnabled);

  const setSidebarVisible = useFlowStore((state) => state.setSidebarVisible);
  const setRightSidebarVisible = useFlowStore((state) => state.setRightSidebarVisible);
  const setMonitoringOpen = useFlowStore((state) => state.setMonitoringOpen);
  const toggleAutofocus = useFlowStore((state) => state.toggleAutofocus);

  const canvasBgVariant = useFlowStore((state) => state.canvasBgVariant);
  const canvasBgColor = useFlowStore((state) => state.canvasBgColor);
  const canvasBgOpacity = useFlowStore((state) => state.canvasBgOpacity);

  const setCanvasBgVariant = useFlowStore((state) => state.setCanvasBgVariant);
  const setCanvasBgColor = useFlowStore((state) => state.setCanvasBgColor);
  const setCanvasBgOpacity = useFlowStore((state) => state.setCanvasBgOpacity);

  const resetCanvasBgColor = () => {
    setCanvasBgColor('default');
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCanvasBgOpacity(parseFloat(e.target.value));
  };

  const activeBtnClass = "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10 border-blue-600";
  const inactiveBtnClass = colorMode === 'dark'
    ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
    : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700";

  const renderViewTab = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-2 border-b border-dashed border-slate-700/30">
        <Eye size={16} className="text-blue-500" />
        <h3 className="font-bold text-sm tracking-tight">View & Layout Toggles</h3>
      </div>
      <div className="flex flex-col gap-2.5">
        {/* Toggle Components */}
        <label className={cn(
          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none",
          colorMode === 'dark' ? "bg-slate-800/40 border-slate-800 hover:bg-slate-800/60" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
        )}>
          <div className="flex flex-col">
            <span className="text-xs font-bold">Components Sidebar</span>
            <span className="text-[10px] opacity-60">Show left panel</span>
          </div>
          <input
            type="checkbox"
            checked={isSidebarVisible}
            onChange={() => setSidebarVisible(!isSidebarVisible)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            aria-label="Toggle Components Sidebar"
          />
        </label>

        {/* Toggle Utilities */}
        <label className={cn(
          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none",
          colorMode === 'dark' ? "bg-slate-800/40 border-slate-800 hover:bg-slate-800/60" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
        )}>
          <div className="flex flex-col">
            <span className="text-xs font-bold">Utilities Sidebar</span>
            <span className="text-[10px] opacity-60">Show right panel</span>
          </div>
          <input
            type="checkbox"
            checked={isRightSidebarVisible}
            onChange={() => setRightSidebarVisible(!isRightSidebarVisible)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            aria-label="Toggle Utilities Sidebar"
          />
        </label>

        {/* Toggle Simulation */}
        <label className={cn(
          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none",
          colorMode === 'dark' ? "bg-slate-800/40 border-slate-800 hover:bg-slate-800/60" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
        )}>
          <div className="flex flex-col">
            <span className="text-xs font-bold">Simulation Panel</span>
            <span className="text-[10px] opacity-60">Show monitoring</span>
          </div>
          <input
            type="checkbox"
            checked={isMonitoringOpen}
            onChange={() => setMonitoringOpen(!isMonitoringOpen)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            aria-label="Toggle Simulation Panel"
          />
        </label>

        {/* Toggle Autofocus */}
        <label className={cn(
          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none",
          colorMode === 'dark' ? "bg-slate-800/40 border-slate-800 hover:bg-slate-800/60" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
        )}>
          <div className="flex flex-col">
            <span className="text-xs font-bold">Autofocus</span>
            <span className="text-[10px] opacity-60">Auto zoom on selection</span>
          </div>
          <input
            type="checkbox"
            checked={isAutofocusEnabled}
            onChange={() => toggleAutofocus()}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            aria-label="Toggle Autofocus"
          />
        </label>
      </div>
    </div>
  );

  const renderCanvasTab = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-2 border-b border-dashed border-slate-700/30">
        <Grid size={16} className="text-blue-500" />
        <h3 className="font-bold text-sm tracking-tight">Canvas Customization</h3>
      </div>

      {/* Background Pattern */}
      <div className="space-y-2">
        <span className="text-xs font-bold block">Background Pattern</span>
        <div className="flex gap-2">
          <button
            onClick={() => setCanvasBgVariant('dots')}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all",
              canvasBgVariant === 'dots' ? activeBtnClass : inactiveBtnClass
            )}
          >
            Dots
          </button>
          <button
            onClick={() => setCanvasBgVariant('lines')}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all",
              canvasBgVariant === 'lines' ? activeBtnClass : inactiveBtnClass
            )}
          >
            Lines
          </button>
        </div>
      </div>

      {/* Color & Transparency Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold">Grid/Dot Color</span>
          {canvasBgColor !== 'default' && (
            <button
              onClick={resetCanvasBgColor}
              className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={10} /> Reset to Default
            </button>
          )}
        </div>

        <ColorPalette
          selectedColor={canvasBgColor}
          onSelect={setCanvasBgColor}
          className="max-w-md"
        />
      </div>

      {/* Opacity/Brightness Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold">Brightness / Opacity</span>
          <span className="font-semibold text-blue-500">{Math.round(canvasBgOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={canvasBgOpacity}
          onChange={handleOpacityChange}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          aria-label="Canvas Opacity"
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Application Settings"
      subtitle="Customize your simulation experience and workspace layout"
      icon={Sliders}
      iconColorClass="text-blue-500"
      widthClass="w-[680px]"
      maxHeightClass="h-[70vh]"
      disableScroll={true}
      compactHeader={true}
    >
      <div className="flex h-[calc(100%+2rem)] -mx-4 -my-4 overflow-hidden">
        {/* Left Sidebar Menu */}
        <div className={cn(
          "w-44 border-r p-4 space-y-1 shrink-0 flex flex-col h-full",
          colorMode === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          {/* Tab View */}
          <button
            type="button"
            onClick={() => setActiveTab('view')}
            className={cn(
              "w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left",
              getTabClass('view')
            )}
          >
            <Eye size={15} />
            <span>View</span>
          </button>

          {/* Tab Canvas */}
          <button
            type="button"
            onClick={() => setActiveTab('canvas')}
            className={cn(
              "w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left",
              getTabClass('canvas')
            )}
          >
            <Grid size={15} />
            <span>Canvas</span>
          </button>
        </div>

        {/* Right Active Panel */}
        <div className="flex-1 p-6 overflow-y-auto h-full custom-scrollbar">
          {activeTab === 'view' && renderViewTab()}
          {activeTab === 'canvas' && renderCanvasTab()}
        </div>
      </div>
    </Modal>
  );
};
