import { describe, it, expect, vi } from 'vitest';
import { createDeploymentSlice } from '../../../src/store/slices/createDeploymentSlice';

describe('createDeploymentSlice', () => {
  const set = vi.fn();
  const get = vi.fn();

  it('should initialize with default values', () => {
    const slice = createDeploymentSlice(set, get, {} as any);
    expect(slice.activeDeploymentId).toBeNull();
    expect(slice.hoveredDeploymentId).toBeNull();
    expect(slice.detachingDeploymentId).toBeNull();
    expect(slice.configuringNodeId).toBeNull();
    expect(slice.configuringEdgeId).toBeNull();
  });

  it('should set active deployment id', () => {
    const slice = createDeploymentSlice(set, get, {} as any);
    slice.setActiveDeploymentId('dep1');
    expect(set).toHaveBeenCalledWith({ activeDeploymentId: 'dep1' });
  });

  it('should toggle node settings', () => {
    const setRightSidebarVisible = vi.fn();
    get.mockReturnValue({
      configuringNodeId: null,
      isRightSidebarVisible: false,
      setRightSidebarVisible,
    });

    const slice = createDeploymentSlice(set, get, {} as any);

    // Toggle ON
    slice.toggleNodeSettings('node1');
    expect(setRightSidebarVisible).toHaveBeenCalledWith(true);
    expect(set).toHaveBeenCalledWith({ configuringNodeId: 'node1', configuringEdgeId: null });

    // Toggle OFF (same node)
    get.mockReturnValue({
      configuringNodeId: 'node1',
      isRightSidebarVisible: true,
      setRightSidebarVisible,
    });
    slice.toggleNodeSettings('node1');
    expect(setRightSidebarVisible).toHaveBeenCalledWith(false);
    expect(set).toHaveBeenCalledWith({ configuringNodeId: null, configuringEdgeId: null });
  });
});
