import { create } from 'zustand';
import { temporal, TemporalState } from 'zundo';
import { FlowState } from './types';
import { createFlowSlice } from './slices/createFlowSlice';
import { createDeploymentSlice } from './slices/createDeploymentSlice';
import { createNodeSlice } from './slices/createNodeSlice';
import { createUiSlice } from './slices/createUiSlice';

export const useFlowStore = create<FlowState>()(
  temporal(
    (...a) => ({
      ...createFlowSlice(...a),
      ...createDeploymentSlice(...a),
      ...createNodeSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      partialize: (state) => {
        const { nodes, edges } = state;
        return { nodes, edges };
      },
    }
  )
);

// Helper to access temporal state
export const useTemporalStore = <T,>(
  selector: (state: TemporalState<{ nodes: any[]; edges: any[] }>) => T,
  equality?: (a: T, b: T) => boolean
) => useFlowStore.temporal(selector, equality);
