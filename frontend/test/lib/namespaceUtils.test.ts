import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import { resolveNodeNamespace } from '@/lib/namespaceUtils';

describe('namespaceUtils - resolveNodeNamespace', () => {
  it('returns default when node is null or undefined', () => {
    expect(resolveNodeNamespace(null)).toBe('default');
    expect(resolveNodeNamespace(undefined)).toBe('default');
  });

  it('returns explicit namespace from node.data.namespace if present', () => {
    const node: Node = {
      id: 'pod-custom',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: { namespace: 'production-app' },
    };
    expect(resolveNodeNamespace(node, [])).toBe('production-app');
  });

  it('resolves namespace from parentId pointing to a Namespace node with label', () => {
    const nsNode: Node = {
      id: 'ns-staging',
      type: 'Namespace',
      position: { x: 0, y: 0 },
      data: { label: 'staging-env' },
    };
    const podNode: Node = {
      id: 'pod-staging',
      type: 'Pod',
      parentId: 'ns-staging',
      position: { x: 0, y: 0 },
      data: {},
    };

    expect(resolveNodeNamespace(podNode, [nsNode, podNode])).toBe('staging-env');
  });

  it('resolves namespace using data.name or id when label is not provided on parent Namespace', () => {
    const nsWithName: Node = {
      id: 'ns-named',
      type: 'Namespace',
      position: { x: 0, y: 0 },
      data: { name: 'finance-ns' },
    };
    const podWithNamedParent: Node = {
      id: 'pod-1',
      parentId: 'ns-named',
      position: { x: 0, y: 0 },
      data: {},
    };
    expect(resolveNodeNamespace(podWithNamedParent, [nsWithName])).toBe('finance-ns');

    const nsWithOnlyId: Node = {
      id: 'ns-raw-id',
      type: 'Namespace',
      position: { x: 0, y: 0 },
      data: {},
    };
    const podWithRawParent: Node = {
      id: 'pod-2',
      parentId: 'ns-raw-id',
      position: { x: 0, y: 0 },
      data: {},
    };
    expect(resolveNodeNamespace(podWithRawParent, [nsWithOnlyId])).toBe('ns-raw-id');
  });

  it('supports node.data.parentId as fallback when node.parentId is undefined', () => {
    const nsNode: Node = {
      id: 'ns-data-parent',
      type: 'Namespace',
      position: { x: 0, y: 0 },
      data: { label: 'dev-cluster' },
    };
    const podNode: Node = {
      id: 'pod-data-parent',
      position: { x: 0, y: 0 },
      data: { parentId: 'ns-data-parent' },
    };

    expect(resolveNodeNamespace(podNode, [nsNode])).toBe('dev-cluster');
  });

  it('traverses multi-level parent hierarchy (Pod -> Deployment -> Namespace)', () => {
    const nsNode: Node = {
      id: 'ns-top',
      type: 'Namespace',
      position: { x: 0, y: 0 },
      data: { label: 'core-system' },
    };
    const depNode: Node = {
      id: 'dep-mid',
      type: 'Deployment',
      parentId: 'ns-top',
      position: { x: 0, y: 0 },
      data: {},
    };
    const podNode: Node = {
      id: 'pod-leaf',
      type: 'Pod',
      parentId: 'dep-mid',
      position: { x: 0, y: 0 },
      data: {},
    };

    expect(resolveNodeNamespace(podNode, [nsNode, depNode, podNode])).toBe('core-system');

    // Multi-level hierarchy where intermediate node uses data.parentId
    const depWithDataParent: Node = {
      id: 'dep-data-mid',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { parentId: 'ns-top' },
    };
    const podUnderDataMid: Node = {
      id: 'pod-sub-leaf',
      type: 'Pod',
      parentId: 'dep-data-mid',
      position: { x: 0, y: 0 },
      data: {},
    };
    expect(resolveNodeNamespace(podUnderDataMid, [nsNode, depWithDataParent, podUnderDataMid])).toBe('core-system');
  });

  it('returns parentId directly when parentNode is not found in nodes list', () => {
    const orphanPod: Node = {
      id: 'pod-orphan',
      parentId: 'missing-ns-container',
      position: { x: 0, y: 0 },
      data: {},
    };

    expect(resolveNodeNamespace(orphanPod, [])).toBe('missing-ns-container');
  });

  it('returns default when node has no parent and no namespace data', () => {
    const standalonePod: Node = {
      id: 'pod-standalone',
      position: { x: 0, y: 0 },
      data: {},
    };

    expect(resolveNodeNamespace(standalonePod, [])).toBe('default');
  });
});
