import { StateCreator } from 'zustand';
import { FlowState, AlignmentGuide, SnapGuide } from '../types';

export interface AlignmentSlice {
  setAlignmentGuides: (guides: { vertical: AlignmentGuide[], horizontal: AlignmentGuide[] }) => void;
  clearAlignmentGuides: () => void;
  setSnapGuides: (guides: { vertical: SnapGuide[], horizontal: SnapGuide[] }) => void;
  clearSnapGuides: () => void;
  setDraggedNodeId: (id: string | null) => void;
}

export const createAlignmentSlice: StateCreator<FlowState, [], [], AlignmentSlice> = (set) => ({
  setAlignmentGuides: (guides: { vertical: AlignmentGuide[], horizontal: AlignmentGuide[] }) => {
    set({ alignmentGuides: guides });
  },
  clearAlignmentGuides: () => {
    set({ alignmentGuides: { vertical: [], horizontal: [] } });
  },
  setSnapGuides: (guides: { vertical: SnapGuide[], horizontal: SnapGuide[] }) => {
    set({ snapGuides: guides });
  },
  clearSnapGuides: () => {
    set({ snapGuides: { vertical: [], horizontal: [] } });
  },
  setDraggedNodeId: (id: string | null) => {
    set({ draggedNodeId: id });
  },
});

