import { StateCreator } from 'zustand';
import { FlowState } from '../types';

export interface DeploymentSlice {
  activeDeploymentId: string | null;
  hoveredDeploymentId: string | null;
  detachingDeploymentId: string | null;
  setActiveDeploymentId: (id: string | null) => void;
  setHoveredDeploymentId: (id: string | null) => void;
  setDetachingDeploymentId: (id: string | null) => void;
}

export const createDeploymentSlice: StateCreator<FlowState, [], [], DeploymentSlice> = (set) => ({
  activeDeploymentId: null,
  hoveredDeploymentId: null,
  detachingDeploymentId: null,
  setActiveDeploymentId: (id: string | null) => set({ activeDeploymentId: id }),
  setHoveredDeploymentId: (id: string | null) => set({ hoveredDeploymentId: id }),
  setDetachingDeploymentId: (id: string | null) => set({ detachingDeploymentId: id }),
});
