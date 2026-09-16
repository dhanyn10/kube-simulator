import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Sidebar } from '@/components/Layout/Sidebar';
import { useFlowStore } from '@/store';

describe('Sidebar', () => {
  it('renders all sections and search input in dark and light modes', () => {
    const { rerender } = render(<Sidebar onAddNode={vi.fn()} />);

    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
    expect(screen.getByText('Workloads')).toBeDefined();
    expect(screen.getByText('Networking')).toBeDefined();
    expect(screen.getByText('Configuration')).toBeDefined();
    expect(screen.getByText('Scaling')).toBeDefined();
    expect(screen.getByText('Others')).toBeDefined();

    act(() => {
      useFlowStore.setState({ colorMode: 'light' });
    });
    rerender(<Sidebar onAddNode={vi.fn()} />);
    expect(screen.getByText('Workloads')).toBeDefined();
  });

  it('filters items based on search term and automatically expands section containing matched item while hiding non-matched items in same section', () => {
    render(<Sidebar onAddNode={vi.fn()} />);

    // Initially, Networking section is closed, Service is hidden/not in expanded DOM branch
    const searchInput = screen.getByPlaceholderText('Search...');

    // Search for Service (located in Networking section, which is initially collapsed)
    fireEvent.change(searchInput, { target: { value: 'Service' } });

    expect(screen.getByText('Service')).toBeDefined();
    // Deployment (in Workloads) and Namespace (in Networking) should not be shown
    expect(screen.queryByText('Deployment')).toBeNull();
    expect(screen.queryByText('Pod')).toBeNull();
    expect(screen.queryByText('Namespace')).toBeNull();

    // Clearing search restores original expanded states (Networking collapsed, Workloads expanded)
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Pod')).toBeDefined();
    expect(screen.getByText('Deployment')).toBeDefined();
    const networkingBtn = screen.getByText('Networking');
    const sectionContainer = networkingBtn.nextElementSibling;
    expect(sectionContainer?.className).toContain('invisible');
  });

  it('filters strictly by card label and ignores matching text in desc', () => {
    render(<Sidebar onAddNode={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search...');
    // 'Atomic unit of K8s' is description of Pod, searching for 'Atomic' should yield no card match
    fireEvent.change(searchInput, { target: { value: 'Atomic' } });

    expect(screen.getByText('No elements found')).toBeDefined();
    expect(screen.queryByText('Pod')).toBeNull();
  });

  it('shows "No elements found" when search yields no results', () => {
    render(<Sidebar onAddNode={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-component' } });

    expect(screen.getByText('No elements found')).toBeDefined();
  });

  it('toggles sections', () => {
    render(<Sidebar onAddNode={vi.fn()} />);

    const networkingBtn = screen.getByText('Networking');
    fireEvent.click(networkingBtn);

    // Networking should be expanded, showing Service
    expect(screen.getByText('Service')).toBeDefined();

    // Workloads should be collapsed.
    const workloadsBtn = screen.getByText('Workloads');
    const sectionContainer = workloadsBtn.nextElementSibling;
    expect(sectionContainer?.className).toContain('invisible');
    expect(sectionContainer?.className).toContain('max-h-0');
  });

  it('calls onAddNode when a component is clicked and opens IAM modal on IAM click', () => {
    const onAddNode = vi.fn();
    const setKubeIamModalOpen = vi.fn();
    useFlowStore.setState({ setKubeIamModalOpen });

    render(<Sidebar onAddNode={onAddNode} />);

    const podBtn = screen.getByText('Pod');
    fireEvent.click(podBtn);
    expect(onAddNode).toHaveBeenCalledWith('Pod');

    // Kube IAM click
    const iamBtn = screen.getByText('Kube IAM');
    fireEvent.click(iamBtn);
    expect(setKubeIamModalOpen).toHaveBeenCalledWith(true);
  });

  it('handles drag start for draggable items and handles non-draggable IAM item', () => {
    const setDraggingSidebarItem = vi.spyOn(useFlowStore.getState(), 'setDraggingSidebarItem');
    const setKubeIamModalOpen = vi.fn();
    useFlowStore.setState({ setKubeIamModalOpen });

    render(<Sidebar onAddNode={vi.fn()} />);

    const podBtn = screen.getByText('Pod').closest('button');
    const mockDataTransfer = {
      setData: vi.fn(),
      effectAllowed: ''
    };

    fireEvent.dragStart(podBtn!, { dataTransfer: mockDataTransfer });

    expect(mockDataTransfer.setData).toHaveBeenCalledWith('application/reactflow', 'Pod');
    expect(setDraggingSidebarItem).toHaveBeenCalledWith('Pod');

    // Drag start on non-draggable IAM item triggers modal
    const iamBtn = screen.getByText('Kube IAM').closest('button');
    fireEvent.dragStart(iamBtn!, { dataTransfer: mockDataTransfer });

    expect(setKubeIamModalOpen).toHaveBeenCalledWith(true);

    // Drag end clears draggingSidebarItem and hovered nodes
    useFlowStore.setState({
      nodes: [{ id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { isHovered: true } } as any]
    });

    fireEvent.dragEnd(podBtn!);
    expect(setDraggingSidebarItem).toHaveBeenCalledWith(null);
    expect(useFlowStore.getState().nodes[0].data.isHovered).toBe(false);
  });

  it('shows custom context menu on right click with change theme and close options', () => {
    const toggleColorModeSpy = vi.spyOn(useFlowStore.getState(), 'toggleColorMode');
    const setSidebarVisibleSpy = vi.spyOn(useFlowStore.getState(), 'setSidebarVisible');

    render(<Sidebar onAddNode={vi.fn()} />);

    const sidebarContainer = document.getElementById('sidebar-components')!;
    fireEvent.contextMenu(sidebarContainer);

    expect(screen.getByTestId('left-sidebar-context-menu')).toBeDefined();
    expect(screen.getByTestId('left-sidebar-change-theme')).toBeDefined();
    expect(screen.getByTestId('left-sidebar-close')).toBeDefined();

    // Click change theme
    fireEvent.click(screen.getByTestId('left-sidebar-change-theme'));
    expect(toggleColorModeSpy).toHaveBeenCalled();

    // Right click again and click close
    fireEvent.contextMenu(sidebarContainer);
    fireEvent.click(screen.getByTestId('left-sidebar-close'));
    expect(setSidebarVisibleSpy).toHaveBeenCalledWith(false);
  });

  it('handles Role click when a node with or without label is selected, configuring, or when no node is selected', () => {
    const setRoleModalTargetNodeSpy = vi.spyOn(useFlowStore.getState(), 'setRoleModalTargetNode');
    const addLogSpy = vi.spyOn(useFlowStore.getState(), 'addLog');

    // Case 1: Node selected with custom label
    act(() => {
      useFlowStore.setState({
        nodes: [{ id: 'node-1', selected: true, data: { label: 'Custom App' } } as any],
        configuringNodeId: null,
      });
    });

    const { unmount } = render(<Sidebar onAddNode={vi.fn()} />);
    const securityBtn = screen.getByText('Security & Access');
    fireEvent.click(securityBtn);

    const roleBtn = screen.getByText('Role');
    fireEvent.click(roleBtn);

    expect(setRoleModalTargetNodeSpy).toHaveBeenCalledWith({ id: 'node-1', label: 'Custom App' });
    unmount();

    // Case 2: Node selected without custom label (falls back to node id)
    act(() => {
      useFlowStore.setState({
        nodes: [{ id: 'node-2', selected: true, data: {} } as any],
        configuringNodeId: null,
      });
    });

    const { unmount: unmount2 } = render(<Sidebar onAddNode={vi.fn()} />);
    fireEvent.click(screen.getByText('Security & Access'));
    fireEvent.click(screen.getByText('Role'));

    expect(setRoleModalTargetNodeSpy).toHaveBeenCalledWith({ id: 'node-2', label: 'node-2' });
    unmount2();

    // Case 3: Node configuring (not selected)
    act(() => {
      useFlowStore.setState({
        nodes: [{ id: 'node-3', selected: false, data: { label: 'Configuring Node' } } as any],
        configuringNodeId: 'node-3',
      });
    });

    const { unmount: unmount3 } = render(<Sidebar onAddNode={vi.fn()} />);
    fireEvent.click(screen.getByText('Security & Access'));
    fireEvent.click(screen.getByText('Role'));

    expect(setRoleModalTargetNodeSpy).toHaveBeenCalledWith({ id: 'node-3', label: 'Configuring Node' });
    unmount3();

    // Case 4: No node selected or configuring -> logs warning
    act(() => {
      useFlowStore.setState({
        nodes: [{ id: 'node-4', selected: false, data: {} } as any],
        configuringNodeId: null,
      });
    });

    render(<Sidebar onAddNode={vi.fn()} />);
    fireEvent.click(screen.getByText('Security & Access'));
    fireEvent.click(screen.getByText('Role'));

    expect(addLogSpy).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining("'Role' is an attached resource"),
      'UI'
    );
  });
});
