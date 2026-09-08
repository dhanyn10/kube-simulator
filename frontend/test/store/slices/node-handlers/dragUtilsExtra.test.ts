import { describe, it, expect, vi } from 'vitest';
import { handleGenericContainerMove } from '../../../../src/store/slices/node-handlers/dragUtils';

describe('dragUtils extra branch conditions', () => {
  it('covers syncOldParentDeployment when old parent is not a Deployment or ReplicaSet', () => {
    const currentNodes: any[] = [
      { id: 'node-1', type: 'Pod', parentId: 'ns-1' },
      { id: 'ns-1', type: 'Namespace' },
    ];
    const getStore = vi.fn();

    const result = handleGenericContainerMove('ns-2', currentNodes[0], currentNodes, 'ns-1', { x: 100, y: 100 }, getStore as any);
    expect(result).toBeDefined();
    expect(result.find(n => n.id === 'node-1')?.parentId).toBe('ns-2');
  });
});
