import { create } from 'zustand';
import { FlowState } from './types';
import { createFlowSlice } from './slices/createFlowSlice';
import { createDeploymentSlice } from './slices/createDeploymentSlice';
import { createNodeSlice } from './slices/createNodeSlice';
import { createUiSlice } from './slices/createUiSlice';

export const useFlowStore = create<FlowState>()((...a) => ({
  ...createFlowSlice(...a),
  ...createDeploymentSlice(...a),
  ...createNodeSlice(...a),
  ...createUiSlice(...a),
}));
