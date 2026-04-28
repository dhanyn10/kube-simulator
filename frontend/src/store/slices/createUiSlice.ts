import { StateCreator } from 'zustand';
import { FlowState } from '../types';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  toggleColorMode: () => void;
}

export const createUiSlice: StateCreator<FlowState, [], [], UiSlice> = (set) => ({
  colorMode: 'dark',
  toggleColorMode: () => set((state) => ({ colorMode: state.colorMode === 'dark' ? 'light' : 'dark' })),
});
