import { describe, it, expect } from 'vitest';
import {
  toggleSidebarAccordionSection,
  filterSidebarItems,
  SIDEBAR_SECTIONS,
  executeSidebarAddNode,
  handleSidebarDragStart,
  handleSidebarDragEnd
} from '@/activities/layout/sidebarHelpers';

describe('sidebarHelpers', () => {
  it('toggles sidebar accordion section correctly', () => {
    const initial = {
      'useful-resources': true,
      workloads: false,
      networking: false,
      configuration: false,
      scaling: false,
      others: false
    };

    const updated = toggleSidebarAccordionSection(initial, 'workloads');
    expect(updated['useful-resources']).toBe(false);
    expect(updated['workloads']).toBe(true);
  });

  it('filters sidebar items by search term', () => {
    const items = [
      { type: 'Pod', label: 'Pod' },
      { type: 'Service', label: 'Service' },
      { type: 'Deployment', label: 'Deployment' }
    ];

    expect(filterSidebarItems(items, '')).toHaveLength(3);
    expect(filterSidebarItems(items, 'pod')).toHaveLength(1);
    expect(filterSidebarItems(items, 'pod')[0].type).toBe('Pod');
    expect(filterSidebarItems(items, 'nonexistent')).toHaveLength(0);
  });

  it('tests SIDEBAR_SECTIONS category filter functions', () => {
    const findSection = (id: string) => SIDEBAR_SECTIONS.find((s) => s.id === id);

    expect(findSection('useful-resources')?.filter('IAM')).toBe(true);
    expect(findSection('useful-resources')?.filter('Pod')).toBe(false);

    expect(findSection('workloads')?.filter('Deployment')).toBe(true);
    expect(findSection('workloads')?.filter('Pod')).toBe(true);
    expect(findSection('workloads')?.filter('Service')).toBe(false);

    expect(findSection('networking')?.filter('Service')).toBe(true);
    expect(findSection('networking')?.filter('Namespace')).toBe(true);
    expect(findSection('networking')?.filter('Ingress')).toBe(true);
    expect(findSection('networking')?.filter('Pod')).toBe(false);

    expect(findSection('security')?.filter('Role')).toBe(true);
    expect(findSection('security')?.filter('Secret')).toBe(false);

    expect(findSection('configuration')?.filter('ConfigMap')).toBe(true);
    expect(findSection('configuration')?.filter('Secret')).toBe(true);
    expect(findSection('configuration')?.filter('Role')).toBe(false);

    expect(findSection('scaling')?.filter('HPA')).toBe(true);
    expect(findSection('scaling')?.filter('Pod')).toBe(false);

    expect(findSection('others')?.filter('Internet')).toBe(true);
    expect(findSection('others')?.filter('PVC')).toBe(true);
    expect(findSection('others')?.filter('Pod')).toBe(false);
  });

  it('executes executeSidebarAddNode for IAM, Role (with target vs without target), and standard nodes', () => {
    const onAddNode = vi.fn();
    const mockContext = {
      nodes: [
        { id: 'node-1', selected: true, data: { label: 'Selected Pod' } },
        { id: 'node-2', selected: false, data: {} },
      ],
      configuringNodeId: null as string | null,
      setKubeIamModalOpen: vi.fn(),
      setRoleModalTargetNode: vi.fn(),
      addLog: vi.fn(),
    };

    // 1. IAM node type
    executeSidebarAddNode('IAM' as any, onAddNode, mockContext);
    expect(mockContext.setKubeIamModalOpen).toHaveBeenCalledWith(true);

    // 2. Role node type when a selected node exists
    executeSidebarAddNode('Role' as any, onAddNode, mockContext);
    expect(mockContext.setRoleModalTargetNode).toHaveBeenCalledWith({ id: 'node-1', label: 'Selected Pod' });

    // 2b. Role node type when configuringNodeId exists (and label falls back to id)
    mockContext.nodes[0].selected = false;
    mockContext.configuringNodeId = 'node-2';
    executeSidebarAddNode('Role' as any, onAddNode, mockContext);
    expect(mockContext.setRoleModalTargetNode).toHaveBeenCalledWith({ id: 'node-2', label: 'node-2' });

    // 2c. Role node type when no target node is selected or configuring
    mockContext.configuringNodeId = null;
    executeSidebarAddNode('Role' as any, onAddNode, mockContext);
    expect(mockContext.addLog).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining("[Sidebar Action] 'Role' is an attached resource"),
      'UI'
    );

    // 3. Standard node type (e.g. Pod)
    executeSidebarAddNode('Pod' as any, onAddNode, mockContext);
    expect(onAddNode).toHaveBeenCalledWith('Pod');
  });

  it('handles drag start and drag end handlers including resetting hovered nodes', () => {
    const setDraggingSidebarItem = vi.fn();
    const mockEvent = {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: '',
      },
    } as unknown as React.DragEvent;

    useFlowStore.setState({
      nodes: [
        { id: 'node-1', data: { isHovered: true, label: 'Hovered Pod' } },
        { id: 'node-2', data: { isHovered: false, label: 'Normal Pod' } },
      ] as any,
    });

    handleSidebarDragStart(mockEvent, 'Deployment' as any, setDraggingSidebarItem);
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('application/reactflow', 'Deployment');
    expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
    expect(setDraggingSidebarItem).toHaveBeenCalledWith('Deployment');

    handleSidebarDragEnd(setDraggingSidebarItem);
    expect(setDraggingSidebarItem).toHaveBeenCalledWith(null);

    const updatedNodes = useFlowStore.getState().nodes;
    expect(updatedNodes[0].data.isHovered).toBe(false);
    expect(updatedNodes[1].data.isHovered).toBe(false);
  });
});
