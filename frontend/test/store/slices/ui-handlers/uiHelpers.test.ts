import { describe, it, expect, vi } from 'vitest';
import {
  applyParsedSettings,
  buildEdgeMaps,
  classifyNodes,
  createLogLineForResource,
  simulateAllResourceLogs,
  removeUserFromRole,
  purgeUserFromNodes,
  renameUserInNodeRoles,
} from '@/store/slices/ui-handlers/uiHelpers';
import { Node } from '@xyflow/react';

describe('uiHelpers', () => {
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
  });
});
