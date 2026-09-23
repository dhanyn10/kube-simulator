import { describe, it, expect } from 'vitest';
import {
  COMMAND_TREE_DATA,
  filterCommandTree,
  getAllNodeIds
} from '@/activities/modals/terminalCommandTreeHelpers';

describe('terminalCommandTreeHelpers', () => {
  it('returns all nodes when search query is empty', () => {
    const result = filterCommandTree(COMMAND_TREE_DATA, '');
    expect(result).toHaveLength(COMMAND_TREE_DATA.length);
  });

  it('filters command tree by search keyword', () => {
    const result = filterCommandTree(COMMAND_TREE_DATA, 'get-contexts');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe('kubectl');
  });

  it('filters command tree by description keyword', () => {
    const result = filterCommandTree(COMMAND_TREE_DATA, 'kubeconfig settings');
    expect(result.length).toBeGreaterThan(0);
  });

  it('collects all node IDs correctly', () => {
    const allIds = getAllNodeIds(COMMAND_TREE_DATA);
    expect(allIds).toContain('kubectl');
    expect(allIds).toContain('kubectl-get');
    expect(allIds).toContain('kubectl-get-pods');
    expect(allIds).toContain('util-help');
    expect(allIds).toContain('util-history');
    expect(allIds).toContain('util-clear');
  });
});
