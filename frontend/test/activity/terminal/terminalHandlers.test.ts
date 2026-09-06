import { describe, it, expect, vi } from 'vitest';
import { Node } from '@xyflow/react';
import {
  handleGetPods,
  handleGetDeployments,
  handleGetServices,
  handleGetCommands,
  handleLogsCommand,
  handleHistoryCommand,
  handleHelpCommand,
  handleDescribeCommand,
} from '../../../src/activity/terminal/terminalHandlers';

describe('terminalHandlers', () => {
  describe('handleGetPods', () => {
    it('logs when no workloads exist', () => {
      const addActivityLog = vi.fn();
      handleGetPods(addActivityLog, [], false);
      expect(addActivityLog).toHaveBeenCalledWith('No pods or workloads found on the canvas.');
    });

    it('logs pods and workloads with label, custom status, and fallback id', () => {
      const addActivityLog = vi.fn();
      const nodes: Node[] = [
        { id: 'pod-1', type: 'Pod', data: { label: 'web-pod', status: 'ready' }, position: { x: 0, y: 0 } },
        { id: 'pod-2', type: 'Pod', data: { status: 'pending' }, position: { x: 0, y: 0 } },
      ];

      handleGetPods(addActivityLog, nodes, true);

      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('NAME'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('web-pod'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('pod-2'));
    });
  });

  describe('handleGetDeployments', () => {
    it('logs when no deployments exist', () => {
      const addActivityLog = vi.fn();
      handleGetDeployments(addActivityLog, [], false);
      expect(addActivityLog).toHaveBeenCalledWith('No deployments found on the canvas.');
    });

    it('logs deployments in simulating and non-simulating modes', () => {
      const addActivityLog = vi.fn();
      const nodes: Node[] = [
        { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep', replicas: 3 }, position: { x: 0, y: 0 } },
        { id: 'dep-2', type: 'Deployment', data: {}, position: { x: 0, y: 0 } },
      ];

      // Non-simulating mode
      handleGetDeployments(addActivityLog, nodes, false);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('0/3'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('dep-2'));

      addActivityLog.mockClear();

      // Simulating mode
      handleGetDeployments(addActivityLog, nodes, true);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('3/3'));
    });
  });

  describe('handleGetServices', () => {
    it('logs when no services exist', () => {
      const addActivityLog = vi.fn();
      handleGetServices(addActivityLog, []);
      expect(addActivityLog).toHaveBeenCalledWith('No services found on the canvas.');
    });

    it('logs services with label, custom port, and fallback id', () => {
      const addActivityLog = vi.fn();
      const nodes: Node[] = [
        { id: 'svc-1', type: 'Service', data: { label: 'web-svc', port: 8080 }, position: { x: 0, y: 0 } },
        { id: 'svc-2', type: 'Service', data: {}, position: { x: 0, y: 0 } },
      ];

      handleGetServices(addActivityLog, nodes);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('web-svc'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('8080/TCP'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('svc-2'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('80/TCP'));
    });
  });

  describe('handleGetCommands', () => {
    const nodes: Node[] = [
      { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep' }, position: { x: 0, y: 0 } },
      { id: 'svc-1', type: 'Service', data: { label: 'app-svc' }, position: { x: 0, y: 0 } },
    ];

    it('handles get pods variants', () => {
      const addActivityLog = vi.fn();
      ['kubectl get pods', 'kubectl get pod', 'kubectl get pods -w', 'kubectl get pod -w'].forEach((cmd) => {
        expect(handleGetCommands(cmd, addActivityLog, nodes, true)).toBe(true);
      });
    });

    it('handles get deployment variants', () => {
      const addActivityLog = vi.fn();
      ['kubectl get deployments', 'kubectl get deployment', 'kubectl get deploy'].forEach((cmd) => {
        expect(handleGetCommands(cmd, addActivityLog, nodes, true)).toBe(true);
      });
    });

    it('handles get service variants', () => {
      const addActivityLog = vi.fn();
      ['kubectl get services', 'kubectl get service', 'kubectl get svc'].forEach((cmd) => {
        expect(handleGetCommands(cmd, addActivityLog, nodes, true)).toBe(true);
      });
    });

    it('returns false for non-matching commands', () => {
      const addActivityLog = vi.fn();
      expect(handleGetCommands('kubectl get configmaps', addActivityLog, nodes, true)).toBe(false);
    });
  });

  describe('handleLogsCommand', () => {
    const nodes: Node[] = [
      { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep' }, position: { x: 0, y: 0 } },
    ];

    it('returns false if command is not a logs command', () => {
      expect(handleLogsCommand('kubectl get pods', vi.fn(), nodes, vi.fn(), vi.fn())).toBe(false);
    });

    it('handles target prefixes (pod/, deployment/, deploy/) and switches tab on found resource', () => {
      const addActivityLog = vi.fn();
      const setTerminalSelectedResourceId = vi.fn();
      const setTerminalActiveTab = vi.fn();

      // Test with pod/ prefix
      expect(handleLogsCommand('kubectl logs pod/web-pod', addActivityLog, nodes, setTerminalSelectedResourceId, setTerminalActiveTab)).toBe(true);
      expect(setTerminalSelectedResourceId).toHaveBeenCalledWith('pod-1');
      expect(setTerminalActiveTab).toHaveBeenCalledWith('logs');

      // Test with deployment/ prefix
      expect(handleLogsCommand('kubectl logs deployment/api-dep', addActivityLog, nodes, setTerminalSelectedResourceId, setTerminalActiveTab)).toBe(true);
      expect(setTerminalSelectedResourceId).toHaveBeenCalledWith('dep-1');

      // Test with deploy/ prefix
      expect(handleLogsCommand('kubectl logs deploy/api-dep', addActivityLog, nodes, setTerminalSelectedResourceId, setTerminalActiveTab)).toBe(true);
    });

    it('logs NotFound error when target resource is missing', () => {
      const addActivityLog = vi.fn();
      expect(handleLogsCommand('kubectl logs non-existent-pod', addActivityLog, nodes, vi.fn(), vi.fn())).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): resource "non-existent-pod" not found');
    });
  });

  describe('handleHistoryCommand', () => {
    it('returns false for non-history command', () => {
      expect(handleHistoryCommand('help', [], vi.fn())).toBe(false);
    });

    it('logs message when command history is empty', () => {
      const addActivityLog = vi.fn();
      expect(handleHistoryCommand('history', [], addActivityLog)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('No command history recorded.');
    });

    it('logs padded history entries when history exists', () => {
      const addActivityLog = vi.fn();
      const entries = [
        { id: '1', timestamp: '2025-01-01 10:00:00', command: 'kubectl get pods' },
        { id: '2', timestamp: '2025-01-01 10:01:00', command: 'clear' },
      ];
      expect(handleHistoryCommand('history', entries, addActivityLog)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('kubectl get pods'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('clear'));
    });
  });

  describe('handleHelpCommand', () => {
    it('returns false for non-help command', () => {
      expect(handleHelpCommand('history', vi.fn())).toBe(false);
    });

    it('prints educational commands when function callback is passed', () => {
      const addActivityLog = vi.fn();
      expect(handleHelpCommand('help', addActivityLog)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Available educational Kubernetes commands:');
    });

    it('prints admin CLI commands when CommandContext with isAdminAuthenticated is true', () => {
      const addActivityLog = vi.fn();
      const ctx = {
        addActivityLog,
        getStoreState: () => ({ isAdminAuthenticated: true } as any),
      };
      expect(handleHelpCommand('help', ctx as any)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Admin CLI Commands:');
    });

    it('prints educational commands when CommandContext with isAdminAuthenticated is false', () => {
      const addActivityLog = vi.fn();
      const ctx = {
        addActivityLog,
        getStoreState: () => ({ isAdminAuthenticated: false } as any),
      };
      expect(handleHelpCommand('help', ctx as any)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Available educational Kubernetes commands:');
    });
  });

  describe('handleDescribeCommand', () => {
    const nodes: Node[] = [
      {
        id: 'pod-1',
        type: 'Pod',
        data: {
          label: 'web-pod',
          status: 'ready',
          image: 'nginx:alpine',
          cpuLimit: '250m',
          memoryLimit: '128Mi',
        },
        position: { x: 0, y: 0 },
      },
      {
        id: 'dep-1',
        type: 'Deployment',
        data: {}, // Minimal data to test fallbacks
        position: { x: 0, y: 0 },
      },
    ];

    it('returns false for non-describe command', () => {
      expect(handleDescribeCommand('kubectl get pods', vi.fn(), nodes, false)).toBe(false);
    });

    it('describes existing pod with custom and fallback properties', () => {
      const addActivityLog = vi.fn();
      expect(handleDescribeCommand('kubectl describe pod web-pod', addActivityLog, nodes, true)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:         web-pod');
      expect(addActivityLog).toHaveBeenCalledWith('    Image:      nginx:alpine');
      expect(addActivityLog).toHaveBeenCalledWith('      cpu:      250m');
      expect(addActivityLog).toHaveBeenCalledWith('      memory:   128Mi');
    });

    it('describes existing deployment with fallback properties in simulating vs non-simulating modes', () => {
      const addActivityLog = vi.fn();
      expect(handleDescribeCommand('kubectl describe deploy dep-1', addActivityLog, nodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:         dep-1');
      expect(addActivityLog).toHaveBeenCalledWith('Status:       Pending');

      addActivityLog.mockClear();

      expect(handleDescribeCommand('kubectl describe deploy dep-1', addActivityLog, nodes, true)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Status:       Running');
    });

    it('logs NotFound error when target resource does not exist', () => {
      const addActivityLog = vi.fn();
      expect(handleDescribeCommand('kubectl describe pod unknown-pod', addActivityLog, nodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): pod "unknown-pod" not found');
    });
  });
});
