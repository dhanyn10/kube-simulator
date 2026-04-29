import { StateCreator } from 'zustand';
import { FlowState } from '../types';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
}

export const createUiSlice: StateCreator<FlowState, [], [], UiSlice> = (set) => ({
  colorMode: 'dark',
  draggingSidebarItem: null,
  toggleColorMode: () => set((state) => ({ colorMode: state.colorMode === 'dark' ? 'light' : 'dark' })),
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
});
