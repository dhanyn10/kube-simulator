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

  it('filters command tree by search keyword, command match, and description match', () => {
    const result = filterCommandTree(COMMAND_TREE_DATA, 'get-contexts');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe('kubectl');

    // Filter matching command string directly
    const cmdResult = filterCommandTree(COMMAND_TREE_DATA, 'kubectl get pods');
    expect(cmdResult.length).toBeGreaterThan(0);
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

  it('handles custom nodes without command or description in filterCommandTree', () => {
    const customNodes = [
      { id: 'custom-parent', name: 'parent-node', children: [{ id: 'custom-child', name: 'child-item' }] },
      { id: 'custom-leaf', name: 'no-desc-leaf', command: 'custom cmd' },
    ];

    const result = filterCommandTree(customNodes, 'child');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('custom-parent');

    const cmdResult = filterCommandTree(customNodes, 'custom cmd');
    expect(cmdResult).toHaveLength(1);
    expect(cmdResult[0].id).toBe('custom-leaf');
  });

  it('omits command property when command parameter is omitted in LeafSpec', () => {
    const customNodes = [
      { id: 'no-cmd-node', name: 'no-cmd', description: 'node without command string' }
    ];
    const result = filterCommandTree(customNodes, 'no-cmd');
    expect(result).toHaveLength(1);
    expect(result[0].command).toBeUndefined();
  });
});
