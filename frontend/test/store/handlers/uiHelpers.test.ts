import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applyParsedSettings,
  buildEdgeMaps,
  classifyNodes,
  createLogLineForResource,
  simulateAllResourceLogs,
  createServiceKubeProxyLog,
  removeUserFromRole,
  purgeUserFromNodes,
  renameUserInNodeRoles,
  parseLogLine,
  formatLogLineWithCount,
  deduplicateOrAppendLogLine,
  deduplicateOrAppendLogLines,
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
        isTerminalAutoOpenOnPlay: true,
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
        isTerminalAutoOpenOnPlay: true,
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

  describe('createServiceKubeProxyLog', () => {
    it('returns null for ClusterIP service or service without selector', () => {
      const clusterSvc: Node = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { serviceType: 'ClusterIP', selector: 'app' } };
      expect(createServiceKubeProxyLog(clusterSvc, [])).toBeNull();

      const noSelSvc: Node = { id: 's2', type: 'Service', position: { x: 0, y: 0 }, data: { serviceType: 'NodePort' } };
      expect(createServiceKubeProxyLog(noSelSvc, [])).toBeNull();
    });

    it('returns null when no matching workload target exists', () => {
      const svc: Node = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { serviceType: 'NodePort', selector: 'backend' } };
      expect(createServiceKubeProxyLog(svc, [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'frontend' } }])).toBeNull();
    });

    it('generates dropped log when externalTrafficPolicy is Local and target pod is on another worker', () => {
      const svc: Node = {
        id: 's1',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'NodePort', selector: 'app', entryNode: 'worker-1', externalTrafficPolicy: 'Local' },
      };
      const pod: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { label: 'app', assignedNode: 'worker-2' },
      };
      const log = createServiceKubeProxyLog(svc, [pod]);
      expect(log).toContain('externalTrafficPolicy=Local');
      expect(log).toContain('Packet dropped');
    });

    it('generates extra hop log when externalTrafficPolicy is Cluster and target pod is on another worker', () => {
      const svc: Node = {
        id: 's1',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'NodePort', selector: 'app', entryNode: 'worker-1', externalTrafficPolicy: 'Cluster' },
      };
      const pod: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { label: 'app', assignedNode: 'worker-3' },
      };
      const log = createServiceKubeProxyLog(svc, [pod]);
      expect(log).toContain('[Node Hop]');
      expect(log).toContain('SNAT');
    });

    it('generates direct local routing log when target pod is on same entry node', () => {
      const svc: Node = {
        id: 's1',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'NodePort', selector: 'app', entryNode: 'worker-1', externalTrafficPolicy: 'Cluster' },
      };
      const pod: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { label: 'app', assignedNode: 'worker-1' },
      };
      const log = createServiceKubeProxyLog(svc, [pod]);
      expect(log).toContain('Direct local routing');
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

    it('throttles access logs when tick is not a multiple of 10', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.8);
      const set = vi.fn();
      const nodes: Node[] = [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1' } }];
      const metrics = { p1: [{}] };

      // Tick 3 is not a multiple of 10 -> allowAccessLogs is false -> no dummy HTTP log
      simulateAllResourceLogs(nodes, metrics, set, { ticks: 3 });

      expect(set).not.toHaveBeenCalled();
    });

    it('suppresses access logs when hasActiveInternetTraffic is false', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.8);
      const set = vi.fn();
      const nodes: Node[] = [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1' } }];
      const metrics = { p1: [{}] };

      // Even on tick 10, if hasActiveInternetTraffic is false, access logs are suppressed
      simulateAllResourceLogs(nodes, metrics, set, { ticks: 10, hasActiveInternetTraffic: false });

      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('log deduplication helpers', () => {
    it('parseLogLine separates timestamp and core message, and detects repeat count', () => {
      const line1 = '[2026-11-18T13:20:00.000Z] [kube-proxy] svc/web-service Direct routing';
      const parsed1 = parseLogLine(line1);
      expect(parsed1.timestamp).toBe('2026-11-18T13:20:00.000Z');
      expect(parsed1.coreMessage).toBe('[kube-proxy] svc/web-service Direct routing');
      expect(parsed1.count).toBe(1);

      const line2 = '[2026-11-18T13:20:10.000Z] [kube-proxy] svc/web-service Direct routing (x5)';
      const parsed2 = parseLogLine(line2);
      expect(parsed2.timestamp).toBe('2026-11-18T13:20:10.000Z');
      expect(parsed2.coreMessage).toBe('[kube-proxy] svc/web-service Direct routing');
      expect(parsed2.count).toBe(5);

      const line3 = 'pod/web status changed from Pending to Running';
      const parsed3 = parseLogLine(line3);
      expect(parsed3.timestamp).toBeNull();
      expect(parsed3.coreMessage).toBe('pod/web status changed from Pending to Running');
      expect(parsed3.count).toBe(1);
    });

    it('formatLogLineWithCount properly formats lines with or without count and timestamp', () => {
      expect(formatLogLineWithCount('My message', '13:00', 1)).toBe('[13:00] My message');
      expect(formatLogLineWithCount('My message', '13:05', 3)).toBe('[13:05] My message (x3)');
      expect(formatLogLineWithCount('My message', null, 2)).toBe('My message (x2)');
    });

    it('deduplicateOrAppendLogLine appends first line and overwrites identical line with newest timestamp and count', () => {
      const line1 = '[2026-11-18T13:20:00.000Z] [kube-proxy] svc/web-service Ingress on worker-1';
      const line2 = '[2026-11-18T13:20:05.000Z] [kube-proxy] svc/web-service Ingress on worker-1';
      const line3 = '[2026-11-18T13:20:10.000Z] [kube-proxy] svc/web-service Ingress on worker-1';
      const diffLine = '[2026-11-18T13:20:15.000Z] [kube-proxy] svc/api-service Extra hop';

      let logs: string[] = [];
      logs = deduplicateOrAppendLogLine(logs, line1);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toBe(line1);

      logs = deduplicateOrAppendLogLine(logs, line2);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toBe('[2026-11-18T13:20:05.000Z] [kube-proxy] svc/web-service Ingress on worker-1 (x2)');

      logs = deduplicateOrAppendLogLine(logs, line3);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toBe('[2026-11-18T13:20:10.000Z] [kube-proxy] svc/web-service Ingress on worker-1 (x3)');

      logs = deduplicateOrAppendLogLine(logs, diffLine);
      expect(logs).toHaveLength(2);
      expect(logs[0]).toContain('(x3)');
      expect(logs[1]).toBe(diffLine);
    });

    it('deduplicateOrAppendLogLines processes multiple lines sequentially', () => {
      const input = [
        '[12:00] Hello',
        '[12:01] Hello',
        '[12:02] World',
        '[12:03] World',
      ];
      const result = deduplicateOrAppendLogLines([], input);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('[12:01] Hello (x2)');
      expect(result[1]).toBe('[12:03] World (x2)');
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

  describe('edge cases for log deduplication, service logs, and simulateAllResourceLogs', () => {
    it('covers bracket index > 40 and repeat count boundaries in parseLogLine', () => {
      // closeBracketIdx > 40
      const longBracket = '[' + 'a'.repeat(45) + '] message';
      expect(parseLogLine(longBracket)).toEqual({
        timestamp: null,
        coreMessage: longBracket,
        count: 1,
      });

      // Repeat count suffix with parsedNum <= 1 or >= 1_000_000 or invalid number
      const x1 = parseLogLine('hello (x1)');
      expect(x1.count).toBe(1);
      expect(x1.coreMessage).toBe('hello (x1)');

      const xBig = parseLogLine('hello (x1000000)');
      expect(xBig.count).toBe(1);

      const xNaN = parseLogLine('hello (xABC)');
      expect(xNaN.count).toBe(1);

      // Ends with ')' but does not contain ' (x'
      const nonCountParen = parseLogLine('hello (world)');
      expect(nonCountParen.count).toBe(1);
      expect(nonCountParen.coreMessage).toBe('hello (world)');
    });

    it('covers deduplicateOrAppendLogLine fallback to lastParsed timestamp when newParsed has no timestamp', () => {
      const existing = ['[12:00:00] Task executed'];
      const updated = deduplicateOrAppendLogLine(existing, 'Task executed');
      expect(updated).toEqual(['[12:00:00] Task executed (x2)']);
    });

    it('covers createLogLineForResource returning null for Service when allNodes is missing', () => {
      const svcNode: Node = { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: {} };
      expect(createLogLineForResource(svcNode, undefined, undefined)).toBeNull();
    });

    it('covers simulateAllResourceLogs early return when no loggable nodes are present', () => {
      const set = vi.fn();
      const nsNode: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      simulateAllResourceLogs([nsNode], {}, set);
      expect(set).not.toHaveBeenCalled();
    });

    it('covers simulateAllResourceLogs activity log filtering with Service packet drop or node hop, sample tick, and non-crucial skip', () => {
      let state: any = { terminalLogs: {}, activityLogs: [] };
      const set = (updater: any) => {
        state = { ...state, ...updater(state) };
      };

      const droppedPod: Node = {
        id: 'p1',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { label: 'app', assignedNode: 'worker-2' },
      };

      const droppedSvc: Node = {
        id: 's-drop',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'NodePort', selector: 'app', entryNode: 'worker-1', externalTrafficPolicy: 'Local' },
      };

      // 1. Crucial log: Packet dropped (with ticks = 10 so allowAccessLogs is true)
      simulateAllResourceLogs([droppedSvc, droppedPod], {}, set, { ticks: 10 });
      expect(state.activityLogs.some((l: string) => l.includes('Packet dropped'))).toBe(true);

      // 2. Crucial log: Node Hop
      const hopSvc: Node = {
        id: 's-hop',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'NodePort', selector: 'app', entryNode: 'worker-1', externalTrafficPolicy: 'Cluster' },
      };
      simulateAllResourceLogs([hopSvc, droppedPod], {}, set, { ticks: 10 });
      expect(state.activityLogs.some((l: string) => l.includes('[Node Hop]'))).toBe(true);

      // 3. Direct local routing: not crucial
      const localPod: Node = {
        id: 'p-local',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { label: 'app-local', assignedNode: 'worker-1' },
      };
      const localSvc: Node = {
        id: 's-local',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'NodePort', selector: 'app-local', entryNode: 'worker-1' },
      };

      // 3a. Sample tick where ticks % 20 === 0 -> activity log added
      simulateAllResourceLogs([localSvc, localPod], {}, set, { ticks: 20 });
      expect(state.activityLogs.some((l: string) => l.includes('Direct local routing'))).toBe(true);

      // 3b. Non-sample tick (ticks = 10) -> not crucial and not sample tick -> svcActivity is null
      let state2: any = { terminalLogs: {}, activityLogs: [] };
      const set2 = (updater: any) => {
        state2 = { ...state2, ...updater(state2) };
      };
      simulateAllResourceLogs([localSvc, localPod], {}, set2, { ticks: 10 });
      expect(state2.terminalLogs['s-local']).toBeDefined();
      expect(state2.activityLogs).toHaveLength(0);
    });
  });
});
