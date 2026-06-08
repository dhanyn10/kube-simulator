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

  it('should set hovered deployment id', () => {
    const slice = createDeploymentSlice(set, get, {} as any);
    slice.setHoveredDeploymentId('dep1');
    expect(set).toHaveBeenCalledWith({ hoveredDeploymentId: 'dep1' });
  });

  it('should set detaching deployment id', () => {
    const slice = createDeploymentSlice(set, get, {} as any);
    slice.setDetachingDeploymentId('dep1');
    expect(set).toHaveBeenCalledWith({ detachingDeploymentId: 'dep1' });
  });

  it('should set configuring node id', () => {
    const slice = createDeploymentSlice(set, get, {} as any);
    slice.setConfiguringNodeId('node1');
    expect(set).toHaveBeenCalledWith({ configuringNodeId: 'node1', configuringEdgeId: null });
  });

  it('should set configuring edge id', () => {
    const slice = createDeploymentSlice(set, get, {} as any);
    slice.setConfiguringEdgeId('edge1');
    expect(set).toHaveBeenCalledWith({ configuringEdgeId: 'edge1', configuringNodeId: null });
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

    // Toggle to different node when sidebar is visible
    get.mockReturnValue({
        configuringNodeId: 'node1',
        isRightSidebarVisible: true,
        setRightSidebarVisible,
    });
    slice.toggleNodeSettings('node2');
    expect(setRightSidebarVisible).toHaveBeenCalledTimes(2); // Should not be called again with true because it was already visible
    expect(set).toHaveBeenCalledWith({ configuringNodeId: 'node2', configuringEdgeId: null });
  });

  it('should toggle edge settings', () => {
    const setRightSidebarVisible = vi.fn();
    get.mockReturnValue({
      configuringEdgeId: null,
      isRightSidebarVisible: false,
      setRightSidebarVisible,
    });

    const slice = createDeploymentSlice(set, get, {} as any);

    // Toggle ON
    slice.toggleEdgeSettings('edge1');
    expect(setRightSidebarVisible).toHaveBeenCalledWith(true);
    expect(set).toHaveBeenCalledWith({ configuringEdgeId: 'edge1', configuringNodeId: null });

    // Toggle OFF (same edge)
    get.mockReturnValue({
      configuringEdgeId: 'edge1',
      isRightSidebarVisible: true,
      setRightSidebarVisible,
    });
    slice.toggleEdgeSettings('edge1');
    expect(setRightSidebarVisible).toHaveBeenCalledWith(false);
    expect(set).toHaveBeenCalledWith({ configuringEdgeId: null, configuringNodeId: null });
  });
});
