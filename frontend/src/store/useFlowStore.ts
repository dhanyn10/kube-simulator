import { create } from 'zustand';
import { temporal, TemporalState } from 'zundo';
import { FlowState } from './types';
import { createFlowSlice } from './slices/createFlowSlice';
import { createDeploymentSlice } from './slices/createDeploymentSlice';
import { createNodeSlice } from './slices/createNodeSlice';
import { createUiSlice } from './slices/createUiSlice';

import { createStore } from 'zustand';

const flowStore = createStore<FlowState>()(
  temporal(
    (...a) => ({
      ...createFlowSlice(...a),
      ...createDeploymentSlice(...a),
      ...createNodeSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    }
  )
);

import { useStore } from 'zustand';

export const useFlowStore = ((selector: any) => useStore(flowStore, selector)) as any;
Object.assign(useFlowStore, flowStore);
