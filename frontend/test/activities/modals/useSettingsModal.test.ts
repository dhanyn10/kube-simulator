import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsModal } from '@/activities/modals/useSettingsModal';
import { useFlowStore } from '@/store';

describe('useSettingsModal', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      isSidebarVisible: true,
      isRightSidebarVisible: true,
      isMonitoringOpen: false,
      isAutofocusEnabled: true,
      canvasBgVariant: 'dots',
      canvasBgColor: 'default',
      canvasBgOpacity: 0.5,
    });
  });

  it('provides default settings state and allows tab switching', () => {
    const { result } = renderHook(() => useSettingsModal());

    expect(result.current.activeTab).toBe('view');
    expect(result.current.colorMode).toBe('dark');
    expect(result.current.getTabClass('view')).toContain('bg-slate-800');

    act(() => {
      result.current.setActiveTab('canvas');
    });

    expect(result.current.activeTab).toBe('canvas');
    expect(result.current.getTabClass('canvas')).toContain('bg-slate-800');
  });

  it('allows toggling layout and canvas options', () => {
    const { result } = renderHook(() => useSettingsModal());

    act(() => {
      result.current.setSidebarVisible(false);
      result.current.setRightSidebarVisible(false);
      result.current.setMonitoringOpen(true);
      result.current.toggleAutofocus();
      result.current.setCanvasBgVariant('lines');
      result.current.setCanvasBgColor('#123456');
    });

    expect(useFlowStore.getState().isSidebarVisible).toBe(false);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);
    expect(useFlowStore.getState().isMonitoringOpen).toBe(true);
    expect(useFlowStore.getState().isAutofocusEnabled).toBe(false);
    expect(useFlowStore.getState().canvasBgVariant).toBe('lines');
    expect(useFlowStore.getState().canvasBgColor).toBe('#123456');

    act(() => {
      result.current.resetCanvasBgColor();
    });

    expect(useFlowStore.getState().canvasBgColor).toBe('default');
  });

  it('handles opacity slider change', () => {
    const { result } = renderHook(() => useSettingsModal());

    act(() => {
      result.current.handleOpacityChange({ target: { value: '0.8' } } as any);
    });

    expect(useFlowStore.getState().canvasBgOpacity).toBe(0.8);
  });
});
