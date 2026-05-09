import { StateCreator } from 'zustand';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  isSimulating: boolean;
  activeSimulationEdges: string[];
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
  setSimulation: (active: boolean, internetNodeIds?: string[]) => void;
}

export const createUiSlice: StateCreator<FlowState, [], [], UiSlice> = (set, get) => ({
  colorMode: 'dark',
  draggingSidebarItem: null,
  isAutosaveEnabled: false,
  isSimulating: false,
  activeSimulationEdges: [],
  toggleColorMode: () => set((state) => ({ colorMode: state.colorMode === 'dark' ? 'light' : 'dark' })),
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  setSimulation: (active, internetNodeIds) => {
    if (!active) {
      set({ isSimulating: false, activeSimulationEdges: [] });
      return;
    }

    const { nodes, edges } = get();
    const startNodes = internetNodeIds
      ? nodes.filter(n => internetNodeIds.includes(n.id))
      : nodes.filter(n => n.type === 'Internet');

    if (startNodes.length === 0) return;

    const activeEdges = new Set<string>();
    const visitedNodes = new Set<string>();
    const queue: string[] = startNodes.map(n => n.id);

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      if (visitedNodes.has(currentNodeId)) continue;
      visitedNodes.add(currentNodeId);

      // Find all edges starting from this node, using safe string comparison for IDs
      const outgoingEdges = edges.filter(e => String(e.source) === String(currentNodeId));
      for (const edge of outgoingEdges) {
        activeEdges.add(String(edge.id));
        queue.push(String(edge.target));
      }
    }

    set({
      isSimulating: true,
      activeSimulationEdges: Array.from(activeEdges)
    });
  },
});
