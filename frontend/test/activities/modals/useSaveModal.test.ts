import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlowStore } from '@/store';
import { useSaveModal } from '@/activities/modals/useSaveModal';

vi.mock('@/hooks/useFitView', () => ({
  useFitView: () => vi.fn(),
}));

describe('useSaveModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [{ id: 'node-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'Pod 1' } }],
      edges: [],
      currentProject: null,
    });
  });

  it('initializes default state when currentProject is null', () => {
    const { result } = renderHook(() => useSaveModal({ isOpen: true, onClose }));

    expect(result.current.activeLocation).toBe('~/.kube-simulator/app_settings_json');
    expect(result.current.newProjectName).toMatch(/^Project-/);
    expect(result.current.isCanvasEmpty).toBe(false);
  });

  it('initializes location and name when currentProject exists', () => {
    useFlowStore.setState({ currentProject: { id: 3, name: 'Cluster Arch' } });
    const { result } = renderHook(() => useSaveModal({ isOpen: true, onClose }));

    expect(result.current.activeLocation).toBe('~/.kube-simulator/projects/3/architecture.infra');
    expect(result.current.newProjectName).toBe('Cluster Arch');
  });

  it('handles click outside context menu to close it', () => {
    const { result } = renderHook(() => useSaveModal({ isOpen: true, onClose }));

    act(() => {
      result.current.setContextMenu({ x: 50, y: 50, item: null });
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

  it('handles row context menu event', () => {
    const { result } = renderHook(() => useSaveModal({ isOpen: true, onClose }));
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 150,
      clientY: 250,
    } as unknown as React.MouseEvent;

    const mockItem = {
      id: 2,
      name: 'P2',
      location: 'loc2',
      fullPath: 'path2',
      updatedAt: 'now',
    };

    act(() => {
      result.current.handleRowContextMenu(mockEvent, mockItem);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 150, y: 250, item: mockItem });
  });

  it('handles quick save current for existing project', async () => {
    useFlowStore.setState({ currentProject: { id: 7, name: 'Project 7' } });
    const mockUpdateProject = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          UpdateProject: mockUpdateProject,
        },
      },
    };

    const { result } = renderHook(() => useSaveModal({ isOpen: true, onClose }));

    await act(async () => {
      await result.current.handleQuickSaveCurrent();
    });

    expect(mockUpdateProject).toHaveBeenCalledWith(7, expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it('handles quick save for new project name', async () => {
    useFlowStore.setState({ currentProject: null });
    const mockSaveProject = vi.fn().mockResolvedValue(15);
    (globalThis as any).go = {
      main: {
        App: {
          SaveProject: mockSaveProject,
        },
      },
    };

    const { result } = renderHook(() => useSaveModal({ isOpen: true, onClose }));

    act(() => {
      result.current.setNewProjectName('New Architecture');
    });

    await act(async () => {
      await result.current.handleQuickSaveCurrent();
    });

    expect(mockSaveProject).toHaveBeenCalledWith('New Architecture', expect.any(String));
    expect(useFlowStore.getState().currentProject).toEqual({ id: 15, name: 'New Architecture' });
    expect(onClose).toHaveBeenCalled();
  });
});
