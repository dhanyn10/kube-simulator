import { StateCreator } from 'zustand';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
}

export const createUiSlice: StateCreator<FlowState, [], [], UiSlice> = (set) => ({
  colorMode: 'dark',
  draggingSidebarItem: null,
  isAutosaveEnabled: false,
  toggleColorMode: () => set((state) => ({ colorMode: state.colorMode === 'dark' ? 'light' : 'dark' })),
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
});
