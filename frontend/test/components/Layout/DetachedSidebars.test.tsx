import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DetachedLeftSidebar } from '@/components/Layout/DetachedLeftSidebar';
import { DetachedRightSidebar } from '@/components/Layout/DetachedRightSidebar';
import { useFlowStore } from '@/store';

const mockBroadcastAddNode = vi.fn();
const mockBroadcastAttachSidebar = vi.fn();
const mockBroadcastUpdateNodeData = vi.fn();

vi.mock('@/activities/layout/useSidebarSync', () => ({
  useSidebarSync: () => ({
    broadcastAddNode: mockBroadcastAddNode,
    broadcastAttachSidebar: mockBroadcastAttachSidebar,
    broadcastUpdateNodeData: mockBroadcastUpdateNodeData,
  }),
}));

describe('Detached Sidebars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [],
      edges: [],
    });
  });

  it('renders DetachedLeftSidebar with title bar and components', () => {
    render(<DetachedLeftSidebar />);

    expect(screen.getByText('Components Palette')).toBeDefined();
    expect(screen.getByTestId('attach-left-sidebar-btn')).toBeDefined();
    expect(screen.getByTestId('close-left-sidebar-window-btn')).toBeDefined();
  });

  it('renders DetachedRightSidebar with title bar and tabs', () => {
    render(<DetachedRightSidebar />);

    expect(screen.getByText('Configuration & Inspector')).toBeDefined();
    expect(screen.getByTestId('attach-right-sidebar-btn')).toBeDefined();
    expect(screen.getByTestId('close-right-sidebar-window-btn')).toBeDefined();
  });

  it('renders DetachedRightSidebar in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<DetachedRightSidebar />);

    expect(screen.getByText('Configuration & Inspector')).toBeDefined();
    const closeBtn = screen.getByTestId('close-right-sidebar-window-btn');
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn);
    expect(mockBroadcastAttachSidebar).toHaveBeenCalledWith('right');
  });

  it('triggers attach action on click', () => {
    render(<DetachedLeftSidebar />);
    const attachBtn = screen.getByTestId('attach-left-sidebar-btn');
    fireEvent.click(attachBtn);
    expect(mockBroadcastAttachSidebar).toHaveBeenCalledWith('left');
  });

  it('triggers attach action on right sidebar click', () => {
    render(<DetachedRightSidebar />);
    const attachBtn = screen.getByTestId('attach-right-sidebar-btn');
    fireEvent.click(attachBtn);
    expect(mockBroadcastAttachSidebar).toHaveBeenCalledWith('right');
  });
});
