import { describe, it, expect } from 'vitest';
import { NODE_TYPES, INITIAL_NODES, INITIAL_EDGES } from '@/constants';
import { LAYOUT, DEFAULT_DIMENSIONS } from '@/constants/layout';

describe('constants', () => {
  it('contains valid NODE_TYPES definition for all resource types', () => {
    expect(NODE_TYPES).toBeDefined();
    expect(NODE_TYPES.Pod).toEqual({ color: 'blue', icon: 'Box' });
    expect(NODE_TYPES.Service).toEqual({ color: 'green', icon: 'Network' });
    expect(NODE_TYPES.Deployment).toEqual({ color: 'purple', icon: 'Layers' });
    expect(NODE_TYPES.Namespace).toEqual({ color: 'orange', icon: 'Anchor' });
    expect(NODE_TYPES.Internet).toEqual({ color: 'blue', icon: 'Globe' });
    expect(NODE_TYPES.Ingress).toEqual({ color: 'rose', icon: 'Globe' });
    expect(NODE_TYPES.HPA).toEqual({ color: 'fuchsia', icon: 'Activity' });
    expect(NODE_TYPES.PVC).toEqual({ color: 'orange', icon: 'Database' });
    expect(NODE_TYPES.ConfigMap).toEqual({ color: 'amber', icon: 'FileText' });
    expect(NODE_TYPES.Secret).toEqual({ color: 'red', icon: 'Lock' });
    expect(NODE_TYPES.Role).toEqual({ color: 'indigo', icon: 'ShieldCheck' });
  });

  it('contains empty initial nodes and edges arrays', () => {
    expect(INITIAL_NODES).toEqual([]);
    expect(INITIAL_EDGES).toEqual([]);
  });

  it('exports layout constants and default dimensions', () => {
    expect(LAYOUT).toBeDefined();
    expect(LAYOUT.PADDING_X).toBe(24);
    expect(LAYOUT.PADDING_Y).toBe(48);
    expect(LAYOUT.SPACING).toBe(20);

    expect(DEFAULT_DIMENSIONS).toBeDefined();
    expect(DEFAULT_DIMENSIONS.Pod).toEqual({ width: 180, height: 130 });
    expect(DEFAULT_DIMENSIONS.Service).toEqual({ width: 180, height: 120 });
    expect(DEFAULT_DIMENSIONS.Deployment).toEqual({ width: 400, height: 300 });
    expect(DEFAULT_DIMENSIONS.Namespace).toEqual({ width: 600, height: 400 });
    expect(DEFAULT_DIMENSIONS.Internet).toEqual({ width: 180, height: 100 });
  });
});
