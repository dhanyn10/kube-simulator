import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../../src/components/Layout/Sidebar';
import { useFlowStore } from '../../../src/store';

describe('Sidebar', () => {
  it('renders all sections and search input', () => {
    render(<Sidebar onAddNode={vi.fn()} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
    expect(screen.getByText('Workloads')).toBeDefined();
    expect(screen.getByText('Networking')).toBeDefined();
    expect(screen.getByText('Configuration')).toBeDefined();
    expect(screen.getByText('Scaling')).toBeDefined();
    expect(screen.getByText('Others')).toBeDefined();
  });

  it('filters items based on search term', () => {
    render(<Sidebar onAddNode={vi.fn()} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Deployment' } });

    expect(screen.getByText('Deployment')).toBeDefined();
    expect(screen.queryByText('Service')).toBeNull();
  });

  it('shows "No elements found" when search yields no results', () => {
    render(<Sidebar onAddNode={vi.fn()} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-component' } });

    expect(screen.getByText('No elements found')).toBeDefined();
  });

  it('toggles sections', () => {
    render(<Sidebar onAddNode={vi.fn()} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

    const networkingBtn = screen.getByText('Networking');
    fireEvent.click(networkingBtn);

    // Networking should be expanded, showing Service
    expect(screen.getByText('Service')).toBeDefined();

    // Workloads should be collapsed.
    // The structure is: button(Workloads) + div(container)
    // The div has max-h-0, opacity-0, invisible classes when collapsed.
    const workloadsBtn = screen.getByText('Workloads');
    const sectionContainer = workloadsBtn.nextElementSibling;
    expect(sectionContainer?.className).toContain('invisible');
    expect(sectionContainer?.className).toContain('max-h-0');
  });

  it('calls onAddNode when a component is clicked', () => {
    const onAddNode = vi.fn();
    render(<Sidebar onAddNode={onAddNode} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

    const podBtn = screen.getByText('Pod');
    fireEvent.click(podBtn);

    expect(onAddNode).toHaveBeenCalledWith('Pod');
  });

  it('handles drag start', () => {
    const setDraggingSidebarItem = vi.spyOn(useFlowStore.getState(), 'setDraggingSidebarItem');
    render(<Sidebar onAddNode={vi.fn()} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

    const podBtn = screen.getByText('Pod').closest('button');
    const mockDataTransfer = {
        setData: vi.fn(),
        effectAllowed: ''
    };

    fireEvent.dragStart(podBtn!, { dataTransfer: mockDataTransfer });

    expect(mockDataTransfer.setData).toHaveBeenCalledWith('application/reactflow', 'Pod');
    expect(setDraggingSidebarItem).toHaveBeenCalledWith('Pod');
  });

  it('shows custom context menu on right click with change theme and close options', () => {
    const toggleColorModeSpy = vi.spyOn(useFlowStore.getState(), 'toggleColorMode');
    const setSidebarVisibleSpy = vi.spyOn(useFlowStore.getState(), 'setSidebarVisible');

    render(<Sidebar onAddNode={vi.fn()} isProjectOpen={true} setIsProjectOpen={vi.fn()} />);

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
});
