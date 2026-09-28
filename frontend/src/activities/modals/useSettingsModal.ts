import { useState, ChangeEvent } from 'react';
import { useFlowStore } from '@/store';

export type SettingsTab = 'view' | 'canvas';

export const useSettingsModal = () => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const [activeTab, setActiveTab] = useState<SettingsTab>('view');

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

  const handleOpacityChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCanvasBgOpacity(Number.parseFloat(e.target.value));
  };

  const getTabClass = (tab: SettingsTab) => {
    const isSelected = activeTab === tab;
    if (colorMode === 'dark') {
      return isSelected
        ? 'bg-slate-800 text-blue-400'
        : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200';
    }
    return isSelected
      ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  };

  const activeBtnClass =
    'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10 border-blue-600';
  const inactiveBtnClass =
    colorMode === 'dark'
      ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
      : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700';

  return {
    colorMode,
    activeTab,
    setActiveTab,
    getTabClass,
    isSidebarVisible,
    setSidebarVisible,
    isRightSidebarVisible,
    setRightSidebarVisible,
    isMonitoringOpen,
    setMonitoringOpen,
    isAutofocusEnabled,
    toggleAutofocus,
    canvasBgVariant,
    setCanvasBgVariant,
    canvasBgColor,
    setCanvasBgColor,
    canvasBgOpacity,
    resetCanvasBgColor,
    handleOpacityChange,
    activeBtnClass,
    inactiveBtnClass,
  };
};
