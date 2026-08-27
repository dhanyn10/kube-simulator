import { StateCreator } from 'zustand';
import { FlowState } from '../types';

export interface DeploymentSlice {
  activeDeploymentId: string | null;
  hoveredDeploymentId: string | null;
  detachingDeploymentId: string | null;
  configuringNodeId: string | null;
  configuringEdgeId: string | null;
  setActiveDeploymentId: (id: string | null) => void;
  setHoveredDeploymentId: (id: string | null) => void;
  setDetachingDeploymentId: (id: string | null) => void;
  setConfiguringNodeId: (id: string | null) => void;
  setConfiguringEdgeId: (id: string | null) => void;
  toggleNodeSettings: (id: string) => void;
  toggleEdgeSettings: (id: string) => void;
}

export const createDeploymentSlice: StateCreator<FlowState, [], [], DeploymentSlice> = (set, get) => ({
  activeDeploymentId: null,
  hoveredDeploymentId: null,
  detachingDeploymentId: null,
  configuringNodeId: null,
  configuringEdgeId: null,
  setActiveDeploymentId: (id: string | null) => set({ activeDeploymentId: id }),
  setHoveredDeploymentId: (id: string | null) => set({ hoveredDeploymentId: id }),
  setDetachingDeploymentId: (id: string | null) => set({ detachingDeploymentId: id }),
  setConfiguringNodeId: (id: string | null) => set({ configuringNodeId: id, configuringEdgeId: null }),
  setConfiguringEdgeId: (id: string | null) => set({ configuringEdgeId: id, configuringNodeId: null }),
  toggleNodeSettings: (id: string) => {
    const state = get();
    const isSameNode = state.configuringNodeId === id;
    const isVisible = state.isRightSidebarVisible;
    const isHistory = state.isHistoryViewOpen;

    if (isHistory) {
      state.setHistoryViewOpen(false);
      set({ configuringNodeId: id, configuringEdgeId: null });
    } else if (isSameNode && isVisible) {
      state.setRightSidebarVisible(false);
      set({ configuringNodeId: null, configuringEdgeId: null });
    } else {
      if (!isVisible) state.setRightSidebarVisible(true);
      set({ configuringNodeId: id, configuringEdgeId: null });
    }
  },
  toggleEdgeSettings: (id: string) => {
    const state = get();
    const isSameEdge = state.configuringEdgeId === id;
    const isVisible = state.isRightSidebarVisible;
    const isHistory = state.isHistoryViewOpen;

    if (isHistory) {
      state.setHistoryViewOpen(false);
      set({ configuringEdgeId: id, configuringNodeId: null });
    } else if (isSameEdge && isVisible) {
      state.setRightSidebarVisible(false);
      set({ configuringEdgeId: null, configuringNodeId: null });
    } else {
      if (!isVisible) state.setRightSidebarVisible(true);
      set({ configuringEdgeId: id, configuringNodeId: null });
    }
  },
});
