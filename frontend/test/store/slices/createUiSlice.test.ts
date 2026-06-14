import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('createUiSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      isSimulating: false,
      visibleWidgets: ['w1'],
      customImages: ['img1']
    });
  });

  it('toggles color mode', () => {
    const { toggleColorMode } = useFlowStore.getState();
    toggleColorMode();
    expect(useFlowStore.getState().colorMode).toBe('light');

    toggleColorMode();
    expect(useFlowStore.getState().colorMode).toBe('dark');
  });

  it('toggles widgets', () => {
    const { toggleWidget } = useFlowStore.getState();
    toggleWidget('w2');
    expect(useFlowStore.getState().visibleWidgets).toContain('w2');

    toggleWidget('w2');
    expect(useFlowStore.getState().visibleWidgets).not.toContain('w2');
  });

  it('adds and deletes custom images', () => {
    const { addCustomImage, deleteCustomImage } = useFlowStore.getState();
    addCustomImage('img2');
    expect(useFlowStore.getState().customImages).toContain('img2');

    deleteCustomImage('img1');
    expect(useFlowStore.getState().customImages).not.toContain('img1');
  });

  it('sets visibility states', () => {
    const { setSidebarVisible, setRightSidebarVisible } = useFlowStore.getState();
    setSidebarVisible(false);
    expect(useFlowStore.getState().isSidebarVisible).toBe(false);

    setRightSidebarVisible(false);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);
  });
});
