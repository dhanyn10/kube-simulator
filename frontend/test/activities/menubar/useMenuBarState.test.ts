import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuBarState } from '@/activities/menubar/useMenuBarState';
import { useFlowStore } from '@/store';

describe('useMenuBarState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [],
      edges: [],
      isScenarioModalOpen: false,
      isYamlModalOpen: false,
      isSettingsModalOpen: false,
      isTerminalCommandTreeModalOpen: false,
      loadScenario: vi.fn(),
    });
  });

  it('initializes menu items and manages active menu state', () => {
    const defaultProps = {
      onExportYaml: vi.fn(),
      onImportFile: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onOpenProjects: vi.fn(),
      onOpenScenarios: vi.fn(),
      onOpenAbout: vi.fn(),
      onOpenSettings: vi.fn(),
    };
    const { result } = renderHook(() => useMenuBarState(defaultProps));

    expect(result.current.menuItems).toHaveLength(4);
    expect(result.current.activeMenu).toBeNull();

    act(() => {
      result.current.setActiveMenu('File');
    });

    expect(result.current.activeMenu).toBe('File');
  });
});
