import { describe, it, expect } from 'vitest';
import {
  getLogLineColorClass,
  formatLogLineContent,
  getPodDisplayStatus,
  formatCommandTimestamp,
  makeDivider,
  generateLogFilename,
  findNodeByTargetName,
  extractAttachedResources,
  exportLogFile,
  printNodeEnvironment,
  printContainerEnv,
} from '@/activities/terminal/terminalLogUtils';
import { Node } from '@xyflow/react';

describe('terminalLogUtils', () => {
  describe('getLogLineColorClass', () => {
    it('returns neutral bold colors for CLI table column headers', () => {
      const headerLine = 'NAME                                   READY   STATUS              RESTARTS   AGE';
      expect(getLogLineColorClass(headerLine, 'dark')).toContain('text-white font-bold');
      expect(getLogLineColorClass(headerLine, 'light')).toContain('text-slate-900 font-bold');

      const headerLine2 = 'CURRENT  NAME                 CLUSTER          AUTHINFO             NAMESPACE';
      expect(getLogLineColorClass(headerLine2, 'dark')).toContain('text-white font-bold');
      expect(getLogLineColorClass(headerLine2, 'light')).toContain('text-slate-900 font-bold');

      // Test a line containing 'NAME' but without any secondary header keywords (e.g., READY, STATUS, etc.)
      const nameOnlyLine = 'My container NAME is web-app';
      expect(getLogLineColorClass(nameOnlyLine, 'dark')).toBe('text-slate-300');
    });

    it('returns orange/amber for negative status transitions and warnings', () => {
      const negativeLine1 = 'Pod web-app status changed: Running -> Pending';
      expect(getLogLineColorClass(negativeLine1, 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass(negativeLine1, 'light')).toContain('text-amber-600');

      const warnLine = '[WARN] Memory usage high';
      expect(getLogLineColorClass(warnLine, 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass(warnLine, 'light')).toContain('text-amber-600');
    });

    it('returns green/emerald for positive status transitions and successful commands', () => {
      const positiveLine1 = 'Pod web-app status changed: Pending -> Running';
      expect(getLogLineColorClass(positiveLine1, 'dark')).toContain('text-emerald-400');
      expect(getLogLineColorClass(positiveLine1, 'light')).toContain('text-emerald-600');

      const successTagLine = '[SUCCESS] Deployment updated';
      expect(getLogLineColorClass(successTagLine, 'dark')).toContain('text-emerald-400');

      const readyNonHeaderLine = 'Pod status is READY';
      expect(getLogLineColorClass(readyNonHeaderLine, 'dark')).toContain('text-emerald-400');

      const successLine = 'Switched to context "dev-user".';
      expect(getLogLineColorClass(successLine, 'dark')).toContain('text-emerald-400');
      expect(getLogLineColorClass(successLine, 'light')).toContain('text-emerald-600');

      const runningOnlyLine = 'Container status is Running';
      expect(getLogLineColorClass(runningOnlyLine, 'dark')).toContain('text-emerald-400');
    });

    it('handles isHeaderLine dashed lines starting with --- or === returning false for header check', () => {
      const dashedDivider = '----------------------------------------';
      expect(getLogLineColorClass(dashedDivider, 'dark')).toBe('text-slate-500 font-bold');
    });

    it('returns rose/red for error messages and failed executions', () => {
      const errorLine = 'Error from server (NotFound): pod "nginx" not found';
      expect(getLogLineColorClass(errorLine, 'dark')).toContain('text-rose-400');
      expect(getLogLineColorClass(errorLine, 'light')).toContain('text-rose-600');

      const fatalLine = '[FATAL] CrashLoopBackOff detected';
      expect(getLogLineColorClass(fatalLine, 'dark')).toContain('text-rose-400');
      expect(getLogLineColorClass(fatalLine, 'light')).toContain('text-rose-600');
    });

    it('returns cyan for command execution lines', () => {
      const cmdLine = '$ kubectl get pods';
      expect(getLogLineColorClass(cmdLine, 'dark')).toContain('text-cyan-400');
      expect(getLogLineColorClass(cmdLine, 'light')).toContain('text-cyan-600');

      const cmdLine2 = '> kubectl describe pod';
      expect(getLogLineColorClass(cmdLine2, 'dark')).toContain('text-cyan-400');
    });

    it('returns purple for resource lines and slate for divider lines', () => {
      const podLine = 'POD: web-pod-1';
      expect(getLogLineColorClass(podLine, 'dark')).toContain('text-purple-400');

      const dividerLine = '========================================';
      expect(getLogLineColorClass(dividerLine, 'dark')).toContain('text-slate-500 font-bold');
    });

    it('identifies event header line with TYPE REASON AGE', () => {
      const eventHeader = 'TYPE      REASON              AGE   FROM';
      expect(getLogLineColorClass(eventHeader, 'dark')).toContain('text-white font-bold');
    });
  });

  describe('formatLogLineContent', () => {
    it('renders simple span when search query is empty', () => {
      const el = formatLogLineContent('test log line', 'dark', '') as React.ReactElement;
      expect(el.type).toBe('span');
      expect(el.props.children).toBe('test log line');
    });

    it('highlights search query matches and handles special regex characters', () => {
      const el = formatLogLineContent('test [log] line', 'dark', '[log]') as React.ReactElement;
      expect(el.type).toBe('span');
      expect(el.props.children).toHaveLength(3);
    });
  });

  describe('utility functions and exportLogFile', () => {
    it('handles exportLogFile with empty or null logs array', () => {
      const spy = vi.spyOn(document.body, 'appendChild');

      exportLogFile([], 'test.log');
      exportLogFile(null as any, 'test.log');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
    it('computes pod display status correctly', () => {
      expect(getPodDisplayStatus('ready', true)).toEqual({ ready: '1/1', displayStatus: 'Running' });
      expect(getPodDisplayStatus('pending', false)).toEqual({ ready: '0/1', displayStatus: 'Pending' });
    });

    it('formats timestamp and dividers correctly', () => {
      const date = new Date(2025, 0, 15, 10, 30, 45);
      expect(formatCommandTimestamp(date)).toBe('2025-01-15 10:30:45');
      expect(makeDivider('=', 10)).toBe('==========');
    });

    it('generates filename correctly', () => {
      const fn = generateLogFilename('My Project!', 'activity');
      expect(fn).toContain('activity-history-my-project');
    });

    it('finds node by target name and filterType array or single filterType', () => {
      const nodes: Node[] = [
        { id: 'node-1', position: { x: 0, y: 0 }, data: { label: 'WebPod' }, type: 'pod' },
        { id: 'node-2', position: { x: 0, y: 0 }, data: { label: 'WebSvc' }, type: 'service' },
        { id: 'node-3', position: { x: 0, y: 0 }, data: { podHash: 'abc12' }, type: 'Pod' },
        { id: 'node-4', position: { x: 0, y: 0 }, data: {}, type: 'Pod' },
      ];
      expect(findNodeByTargetName(nodes, 'webpod', ['deployment'])).toBeUndefined();
      expect(findNodeByTargetName(nodes, 'webpod', ['pod', 'service'])).toEqual(nodes[0]);
      expect(findNodeByTargetName(nodes, 'webpod', 'pod')).toEqual(nodes[0]);
      expect(findNodeByTargetName(nodes, 'unknown')).toBeUndefined();
      expect(findNodeByTargetName(nodes, 'my-app-abc12-replica1')).toEqual(nodes[2]);
    });

    it('extracts attached resources using node id fallback when label is missing', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          position: { x: 0, y: 0 },
          data: { label: 'WebPod', secrets: [{ name: 'sec-1' }] },
          type: 'pod',
        },
        {
          id: 'node-2',
          position: { x: 0, y: 0 },
          data: { secrets: [{ name: 'sec-2' }] },
          type: 'pod',
        },
        {
          id: 'node-3',
          position: { x: 0, y: 0 },
          data: null as any,
          type: 'pod',
        },
      ];
      const extracted = extractAttachedResources(nodes, 'secrets');
      expect(extracted).toEqual([
        { item: { name: 'sec-1' }, ownerLabel: 'WebPod' },
        { item: { name: 'sec-2' }, ownerLabel: 'node-2' },
      ]);
    });

    it('handles default parameters and fallback conditions across utils', () => {
      expect(formatCommandTimestamp()).toBeDefined();
      expect(makeDivider()).toHaveLength(50);

      expect(getPodDisplayStatus(undefined, true)).toEqual({ ready: '1/1', displayStatus: 'Running' });
      expect(getPodDisplayStatus(undefined, false)).toEqual({ ready: '0/1', displayStatus: 'Pending' });

      expect(generateLogFilename('!!!', 'logs', '!!!')).toContain('resource-logs_');
      expect(generateLogFilename(null, 'logs', 'my-pod')).toContain('resource-logs-my-pod_');
      expect(generateLogFilename(null, undefined)).toContain('resource-logs_');

      expect(getLogLineColorClass('   ', 'dark')).toBe('text-slate-300');
      expect(getLogLineColorClass('=== Header ===', 'dark')).toBe('text-slate-500 font-bold');
      expect(getLogLineColorClass('warning: high memory', 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass('Waiting for container', 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass('Terminated with code 0', 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass('ready -> pending', 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass('0/1 ready', 'dark')).toContain('text-amber-400');
      expect(getLogLineColorClass('Normal log message', 'dark')).toBe('text-slate-300');

      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const removeSpy = vi.spyOn(HTMLAnchorElement.prototype, 'remove').mockImplementation(() => {});
      exportLogFile(['log line 1', 'log line 2'], 'output.log');
      expect(appendSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      appendSpy.mockRestore();
      clickSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('printNodeEnvironment', () => {
    it('prints <none> when data is undefined or contains no configMaps and secrets', () => {
      const logs: string[] = [];
      const addLog = (line: string) => logs.push(line);

      printNodeEnvironment(undefined, addLog);
      expect(logs).toEqual(['    Environment:  <none>']);

      logs.length = 0;
      printNodeEnvironment({ configMaps: [], secrets: [] }, addLog);
      expect(logs).toEqual(['    Environment:  <none>']);

      logs.length = 0;
      printNodeEnvironment({ configMaps: 'not-array' as any, secrets: null as any }, addLog);
      expect(logs).toEqual(['    Environment:  <none>']);
    });

    it('prints <none> when configMaps and secrets exist but have empty or missing data', () => {
      const logs: string[] = [];
      const addLog = (line: string) => logs.push(line);

      printNodeEnvironment(
        {
          configMaps: [{ name: 'cm-empty', configData: [] }, { name: 'cm-undef' }],
          secrets: [{ name: 'sec-empty', secretData: [] }, { name: 'sec-undef' }],
        },
        addLog
      );
      expect(logs).toEqual(['    Environment:  <none>']);
    });

    it('prints formatted environment lines for both configMaps and secrets', () => {
      const logs: string[] = [];
      const addLog = (line: string) => logs.push(line);

      printNodeEnvironment(
        {
          configMaps: [
            { name: 'app-cfg', configData: [{ key: 'API_URL' }, { key: 'PORT' }] },
            { name: 'extra-cfg', configData: undefined },
          ],
          secrets: [
            { name: 'app-sec', secretData: [{ key: 'DB_PASS' }] },
            { name: 'extra-sec' },
          ],
        },
        addLog
      );

      expect(logs).toEqual([
        '    Environment:',
        "      API_URL:  <set to the key 'API_URL' of config map 'app-cfg'>  Optional: false",
        "      PORT:  <set to the key 'PORT' of config map 'app-cfg'>  Optional: false",
        "      DB_PASS:  <set to the key 'DB_PASS' in secret 'app-sec'>  Optional: false",
      ]);
    });
  });

  describe('printContainerEnv', () => {
    it('prints all container environment variables with custom label, image, configMaps, and secrets', () => {
      const logs: string[] = [];
      const addLog = (line: string) => logs.push(line);

      const node: Node = {
        id: 'node-pod-1',
        position: { x: 0, y: 0 },
        data: {
          label: 'my-custom-pod',
          image: 'redis:alpine',
          configMaps: [
            { name: 'redis-conf', configData: [{ key: 'MAX_CLIENTS', value: '10000' }] },
            { name: 'empty-conf', configData: undefined },
          ],
          secrets: [
            { name: 'redis-auth', secretData: [{ key: 'AUTH_KEY', value: 's3cr3t' }] },
            { name: 'empty-sec' },
          ],
        },
      };

      printContainerEnv(node, addLog);

      expect(logs).toContain('HOSTNAME=my-custom-pod');
      expect(logs).toContain('IMAGE=redis:alpine');
      expect(logs).toContain('MAX_CLIENTS=10000');
      expect(logs).toContain('AUTH_KEY=s3cr3t');
      expect(logs).toContain('KUBERNETES_SERVICE_PORT=443');
    });

    it('falls back to node.id, default image, and handles non-array or missing configMaps/secrets', () => {
      const logs: string[] = [];
      const addLog = (line: string) => logs.push(line);

      const minimalNode: Node = {
        id: 'pod-fallback-id',
        position: { x: 0, y: 0 },
        data: {},
      };

      printContainerEnv(minimalNode, addLog);

      expect(logs).toContain('HOSTNAME=pod-fallback-id');
      expect(logs).toContain('IMAGE=nginx:latest');
      expect(logs).toContain('SHLVL=1');
      expect(logs).toContain('HOME=/root');
      expect(logs).toContain('TERM=xterm');
    });

    it('handles node with completely missing data object', () => {
      const logs: string[] = [];
      const addLog = (line: string) => logs.push(line);

      const noDataNode = {
        id: 'node-no-data',
        position: { x: 0, y: 0 },
      } as Node;

      printContainerEnv(noDataNode, addLog);

      expect(logs).toContain('HOSTNAME=node-no-data');
      expect(logs).toContain('IMAGE=nginx:latest');
    });
  });
});
