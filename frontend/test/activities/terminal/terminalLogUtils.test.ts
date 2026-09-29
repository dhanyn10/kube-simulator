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
      ];
      expect(findNodeByTargetName(nodes, 'webpod', ['deployment'])).toBeUndefined();
      expect(findNodeByTargetName(nodes, 'webpod', ['pod', 'service'])).toEqual(nodes[0]);
      expect(findNodeByTargetName(nodes, 'webpod', 'pod')).toEqual(nodes[0]);
      expect(findNodeByTargetName(nodes, 'unknown')).toBeUndefined();
    });

    it('extracts attached resources', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          position: { x: 0, y: 0 },
          data: { label: 'WebPod', secrets: [{ name: 'sec-1' }] },
          type: 'pod',
        },
      ];
      const extracted = extractAttachedResources(nodes, 'secrets');
      expect(extracted).toEqual([{ item: { name: 'sec-1' }, ownerLabel: 'WebPod' }]);
    });
  });
});
