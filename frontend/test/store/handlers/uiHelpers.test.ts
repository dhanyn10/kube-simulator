import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applyParsedSettings,
  buildEdgeMaps,
  classifyNodes,
  createLogLineForResource,
  simulateAllResourceLogs,
  removeUserFromRole,
  purgeUserFromNodes,
  renameUserInNodeRoles,
} from '@/store/handlers/uiHelpers';
import { Node } from '@xyflow/react';
import * as utils from '@/lib/utils';

describe('uiHelpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('applyParsedSettings', () => {
    it('parses valid json settings and invokes set function', () => {
      const set = vi.fn();
      const validSettings = JSON.stringify({
        isSidebarVisible: false,
        isRightSidebarVisible: true,
        isAutofocusEnabled: true,
        isMonitoringOpen: false,
        canvasBgVariant: 'lines',
        canvasBgColor: '#000000',
        canvasBgOpacity: 0.5,
      });

      applyParsedSettings(validSettings, set);

      expect(set).toHaveBeenCalledWith({
        isSidebarVisible: false,
        isRightSidebarVisible: true,
        isAutofocusEnabled: true,
        isMonitoringOpen: false,
        canvasBgVariant: 'lines',
        canvasBgColor: '#000000',
        canvasBgOpacity: 0.5,
      });
    });

    it('applies canvasBgVariant dots when provided', () => {
      const set = vi.fn();
      applyParsedSettings(JSON.stringify({ canvasBgVariant: 'dots' }), set);
      expect(set).toHaveBeenCalledWith({ canvasBgVariant: 'dots' });
    });

    it('ignores invalid types for settings fields', () => {
      const set = vi.fn();
      applyParsedSettings(
        JSON.stringify({
          isSidebarVisible: 'not-bool',
          isRightSidebarVisible: 123,
          isAutofocusEnabled: null,
          isMonitoringOpen: undefined,
          canvasBgVariant: 'unsupported-variant',
          canvasBgColor: 456,
          canvasBgOpacity: 'not-number',
        }),
        set
      );
      expect(set).toHaveBeenCalledWith({});
    });

    it('ignores invalid json without throwing error', () => {
      const set = vi.fn();
      applyParsedSettings('invalid-json', set);
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('buildEdgeMaps', () => {
    it('classifies source and target edges into maps', () => {
      const edges = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n1', target: 'n3' },
      ];

      const { edgeMap, targetEdgeMap } = buildEdgeMaps(edges);

      expect(edgeMap.get('n1')).toHaveLength(2);
      expect(targetEdgeMap.get('n2')).toHaveLength(1);
      expect(targetEdgeMap.get('n3')).toHaveLength(1);
    });
  });

  describe('classifyNodes', () => {
    it('groups workloads, internet nodes, and children pods', () => {
      const nodes: Node[] = [
        { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} },
        { id: 'net1', type: 'Internet', position: { x: 0, y: 0 }, data: {} },
        { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: {} },
        { id: 'standalone', type: 'Pod', position: { x: 0, y: 0 }, data: {} },
      ];

      const { workloads, internetNodes, childPodMap } = classifyNodes(nodes);

      expect(workloads).toHaveLength(2);
      expect(internetNodes).toHaveLength(1);
      expect(childPodMap.get('dep1')).toHaveLength(1);
    });
  });

  describe('createLogLineForResource', () => {
    it('returns OOM fatal log line when point.isOOM is true', () => {
      const node: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod' } };
      const log = createLogLineForResource(node, { isOOM: true });
      expect(log).toContain('[FATAL] Out of Memory (OOM)');
      expect(log).toContain('web-pod');
    });

    it('returns CPU throttle warning log line when point.isThrottled is true', () => {
      const node: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod' } };
      const log = createLogLineForResource(node, { isThrottled: true });
      expect(log).toContain('[WARNING] CPU limit reached for web-pod');
    });

    it('falls back to node.id when node.data.label is undefined', () => {
      const node: Node = { id: 'fallback-pod-id', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      const log = createLogLineForResource(node, { isOOM: true });
      expect(log).toContain('fallback-pod-id');
    });

    it('generates access log when safeRandom > 0.3 and no OOM/throttling', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.5);
      const node: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod' } };
      const log = createLogLineForResource(node, {});
      expect(log).toContain('GET');
      expect(log).toContain('200 OK');
      expect(log).toContain('web-pod');
    });

    it('returns null when safeRandom <= 0.3', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.2);
      const node: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod' } };
      const log = createLogLineForResource(node, {});
      expect(log).toBeNull();
    });

    it('returns 503 status code when isOOM evaluates to true on access log generation', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.5);
      const node: Node = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod' } };
      let calls = 0;
      const dynamicPoint = {
        get isOOM() {
          calls++;
          return calls > 1;
        },
      };
      const log = createLogLineForResource(node, dynamicPoint);
      expect(log).toContain('503');
      expect(log).toContain('web-pod');
    });
  });

  describe('simulateAllResourceLogs', () => {
    it('returns early when no loggable nodes exist', () => {
      const set = vi.fn();
      simulateAllResourceLogs([{ id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: {} }], {}, set);
      expect(set).not.toHaveBeenCalled();
    });

    it('appends terminal logs for loggable workloads', () => {
      const set = vi.fn((fn: any) => fn({ terminalLogs: {} }));
      const nodes: Node[] = [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1' } }];
      const metrics = { p1: [{ isOOM: true }] };

      simulateAllResourceLogs(nodes, metrics, set);

      expect(set).toHaveBeenCalled();
    });

    it('uses node.parentId as metricKey if present and retains previous terminal logs', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.5);
      const set = vi.fn((fn: any) => fn({ terminalLogs: { 'child-pod': ['existing log'] } }));
      const nodes: Node[] = [
        { id: 'child-pod', parentId: 'parent-dep', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'child' } },
      ];
      const metrics = { 'parent-dep': [{ isThrottled: true }] };

      simulateAllResourceLogs(nodes, metrics, set);

      expect(set).toHaveBeenCalled();
    });

    it('handles missing metrics array without error', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.5);
      const set = vi.fn((fn: any) => fn({ terminalLogs: {} }));
      const nodes: Node[] = [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1' } }];
      const metrics = {};

      simulateAllResourceLogs(nodes, metrics, set);

      expect(set).toHaveBeenCalled();
    });

    it('does not invoke set when all generated log lines are null', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.1);
      const set = vi.fn();
      const nodes: Node[] = [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1' } }];
      const metrics = { p1: [{}] };

      simulateAllResourceLogs(nodes, metrics, set);

      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('user and role helpers', () => {
    it('removeUserFromRole filters out username from role assignedUsers', () => {
      const role = { assignedUsers: ['alice', 'bob'] };
      const updated = removeUserFromRole(role, 'alice');
      expect(updated.assignedUsers).toEqual(['bob']);
    });

    it('removeUserFromRole returns role unchanged if assignedUsers is missing', () => {
      const role = {};
      expect(removeUserFromRole(role, 'alice')).toEqual({});
    });

    it('purgeUserFromNodes removes user across canvas node roles', () => {
      const nodes: Node[] = [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            roles: [{ assignedUsers: ['alice', 'bob'] }],
          },
        },
      ];

      const cleaned = purgeUserFromNodes(nodes, 'alice');
      expect((cleaned[0].data.roles as any[])[0].assignedUsers).toEqual(['bob']);
    });

    it('purgeUserFromNodes returns node unchanged if data.roles is missing or not an array', () => {
      const nodes: Node[] = [
        { id: 'n1', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', position: { x: 0, y: 0 }, data: { roles: 'invalid' as any } },
      ];
      const cleaned = purgeUserFromNodes(nodes, 'alice');
      expect(cleaned[0]).toBe(nodes[0]);
      expect(cleaned[1]).toBe(nodes[1]);
    });

    it('renameUserInNodeRoles updates user name in role assignedUsers', () => {
      const node: Node = {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: {
          roles: [{ assignedUsers: ['alice', 'bob'] }],
        },
      };

      const updated = renameUserInNodeRoles(node, 'alice', 'charlie');
      expect((updated.data.roles as any[])[0].assignedUsers).toEqual(['charlie', 'bob']);
    });

    it('renameUserInNodeRoles returns node unchanged if data.roles is missing or not an array', () => {
      const nodeNoRoles: Node = { id: 'n1', position: { x: 0, y: 0 }, data: {} };
      const nodeInvalidRoles: Node = { id: 'n2', position: { x: 0, y: 0 }, data: { roles: null as any } };
      expect(renameUserInNodeRoles(nodeNoRoles, 'alice', 'bob')).toBe(nodeNoRoles);
      expect(renameUserInNodeRoles(nodeInvalidRoles, 'alice', 'bob')).toBe(nodeInvalidRoles);
    });

    it('renameUserInNodeRoles handles role without assignedUsers', () => {
      const node: Node = {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: {
          roles: [{ name: 'viewer' }],
        },
      };
      const updated = renameUserInNodeRoles(node, 'alice', 'bob');
      expect((updated.data.roles as any[])[0].assignedUsers).toBeUndefined();
    });
  });
});
