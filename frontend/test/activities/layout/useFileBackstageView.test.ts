import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import { useFileBackstageView } from '@/activities/layout/useFileBackstageView';

vi.mock('@/hooks/useFitView', () => ({
  useFitView: () => vi.fn(),
}));

describe('useFileBackstageView', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [{ id: 'node-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'Pod 1' } }],
      edges: [],
      currentProject: null,
      isAutosaveEnabled: false,
    });
  });

  it('initializes default state and loads project name', async () => {
    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    expect(result.current.activeTab).toBe('home');
    expect(result.current.isCanvasEmpty).toBe(false);
    expect(result.current.newProjectName).toMatch(/^autosave-/);
  });

  it('sets new project name when currentProject exists', () => {
    useFlowStore.setState({ currentProject: { id: 10, name: 'My Project' } });
    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    expect(result.current.newProjectName).toBe('My Project');
  });

  it('handles click outside context menu to close it', () => {
    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    act(() => {
      result.current.setContextMenu({ x: 100, y: 100, item: null });
    });

    expect(result.current.contextMenu).not.toBeNull();

    const menuEl = document.createElement('div');
    const outsideEl = document.createElement('button');
    document.body.appendChild(menuEl);
    document.body.appendChild(outsideEl);

    (result.current.contextMenuRef as React.MutableRefObject<HTMLDivElement | null>).current = menuEl;

    act(() => {
      outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(result.current.contextMenu).toBeNull();

    document.body.removeChild(menuEl);
    document.body.removeChild(outsideEl);
  });

  it('closes view on Escape key press when isOpen is true', () => {
    renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    act(() => {
      globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('handles row context menu', () => {
    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 300,
    } as unknown as React.MouseEvent;

    const mockItem = {
      id: 1,
      name: 'P1',
      location: 'loc',
      fullPath: 'path',
      updatedAt: 'now',
    };

    act(() => {
      result.current.handleRowContextMenu(mockEvent, mockItem);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 200, y: 300, item: mockItem });
  });

  it('handles quick save when autosave is enabled and setting save app API exists', async () => {
    useFlowStore.setState({ isAutosaveEnabled: true });
    const mockSaveSetting = vi.fn();
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: mockSaveSetting,
        },
      },
    };

    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    await act(async () => {
      await result.current.handleQuickSaveCurrent();
    });

    expect(mockSaveSetting).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles quick save for existing project', async () => {
    useFlowStore.setState({ currentProject: { id: 5, name: 'Project 5' }, isAutosaveEnabled: false });
    const mockUpdateProject = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          UpdateProject: mockUpdateProject,
        },
      },
    };

    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    await act(async () => {
      await result.current.handleQuickSaveCurrent();
    });

    expect(mockUpdateProject).toHaveBeenCalledWith(5, expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it('handles quick save as new project', async () => {
    useFlowStore.setState({ currentProject: null, isAutosaveEnabled: false });
    const mockSaveProject = vi.fn().mockResolvedValue(12);
    (globalThis as any).go = {
      main: {
        App: {
          SaveProject: mockSaveProject,
        },
      },
    };

    const { result } = renderHook(() => useFileBackstageView({ isOpen: true, onClose }));

    act(() => {
      result.current.setNewProjectName('Brand New Arch');
    });

    await act(async () => {
      await result.current.handleQuickSaveCurrent();
    });

    expect(mockSaveProject).toHaveBeenCalledWith('Brand New Arch', expect.any(String));
    expect(useFlowStore.getState().currentProject).toEqual({ id: 12, name: 'Brand New Arch' });
    expect(onClose).toHaveBeenCalled();
  });
});
