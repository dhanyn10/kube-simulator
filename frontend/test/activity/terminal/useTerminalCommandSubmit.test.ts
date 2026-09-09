import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  executeKubectlCommand,
  useTerminalCommandSubmit,
} from '@/activity/terminal/useTerminalCommandSubmit';
import { useFlowStore } from '@/store';
import { CommandContext } from '@/activity/terminal/terminalCommands';

describe('useTerminalCommandSubmit', () => {
  const setTerminalSelectedResourceId = vi.fn();
  const setTerminalActiveTab = vi.fn();
  const clearTerminalLogs = vi.fn();
  const setIsDropdownOpen = vi.fn();
  const setIsNavigatingHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        { id: 'pod-1', type: 'Pod', data: { label: 'web-pod', status: 'ready' }, position: { x: 0, y: 0 } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-dep', replicas: 2 }, position: { x: 0, y: 0 } },
        { id: 'role-1', type: 'Role', data: { label: 'web-role', roles: [{ name: 'reader' }] }, position: { x: 0, y: 0 } },
      ] as any,
      activityLogs: [],
      addActivityLog: vi.fn(),
      isAdminAuthenticated: false,
      isAwaitingAdminPassword: false,
      activeIdentity: 'system:admin',
    });
    delete (globalThis as any).go;
  });

  describe('executeKubectlCommand', () => {
    it('handles help command', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: [],
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      executeKubectlCommand('help', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('Available educational Kubernetes commands:'));
    });

    it('handles history command', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: [],
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      executeKubectlCommand('history', ctx, setTerminalSelectedResourceId, setTerminalActiveTab, [
        { id: '1', command: 'kubectl get pods', timestamp: '2026-03-30 10:00:00' },
      ]);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('kubectl get pods'));
    });

    it('handles kubectl config command', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: [],
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      executeKubectlCommand('kubectl config current-context', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith('system:admin');
    });

    it('handles admin command', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: [],
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      executeKubectlCommand('kubesim admin', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith('[Admin Authentication] Please enter admin password:');
    });

    it('handles RBAC check failure for restricted user', () => {
      useFlowStore.setState({ activeIdentity: 'dev-user-restricted' });
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: useFlowStore.getState().nodes,
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      executeKubectlCommand('kubectl delete pod web-pod', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith(
        expect.stringContaining('Error from server (Forbidden): pods is forbidden: User "dev-user-restricted"')
      );
    });

    it('handles operational command handlers (e.g. rollout status, get roles, describe role, get configmaps)', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: useFlowStore.getState().nodes,
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      // 1. Rollout status
      executeKubectlCommand('kubectl rollout status deployment/web-dep', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('successfully rolled out'));

      // 2. Get roles
      addActivityLog.mockClear();
      executeKubectlCommand('kubectl get roles', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalled();

      // 3. Describe role
      addActivityLog.mockClear();
      executeKubectlCommand('kubectl describe role web-role', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalled();
    });

    it('handles kubectl get, kubectl logs, and kubectl describe commands', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: useFlowStore.getState().nodes,
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      // 1. Get pods
      executeKubectlCommand('kubectl get pods', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('web-pod'));

      // 2. Logs
      executeKubectlCommand('kubectl logs web-pod', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(setTerminalSelectedResourceId).toHaveBeenCalledWith('pod-1');
      expect(setTerminalActiveTab).toHaveBeenCalledWith('logs');

      // 3. Describe pod
      addActivityLog.mockClear();
      executeKubectlCommand('kubectl describe pod web-pod', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('Name:         web-pod'));
    });

    it('handles unknown command and adds error message', () => {
      const addActivityLog = vi.fn();
      const ctx: CommandContext = {
        nodes: [],
        isSimulating: true,
        addActivityLog,
        getStoreState: () => useFlowStore.getState(),
        setStoreState: (p) => useFlowStore.setState(p),
        updateNodeData: vi.fn(),
      };

      executeKubectlCommand('kubectl nonexistentcommand', ctx, setTerminalSelectedResourceId, setTerminalActiveTab);
      expect(addActivityLog).toHaveBeenCalledWith(
        expect.stringContaining('kubectl-mock: command not found: "kubectl nonexistentcommand"')
      );
    });
  });

  describe('useTerminalCommandSubmit hook', () => {
    it('processCommandSubmit returns early on empty command', () => {
      const nodes = useFlowStore.getState().nodes;
      const { result } = renderHook(() =>
        useTerminalCommandSubmit(nodes, true, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab)
      );

      act(() => {
        result.current.processCommandSubmit('   ', setIsDropdownOpen, setIsNavigatingHistory);
      });

      expect(setIsDropdownOpen).toHaveBeenCalledWith(false);
      expect(setIsNavigatingHistory).toHaveBeenCalledWith(false);
      expect(clearTerminalLogs).not.toHaveBeenCalled();
    });

    it('processCommandSubmit executes kubectl command via processCommandSubmit and logs output', () => {
      const addActivityLog = vi.fn();
      useFlowStore.setState({ addActivityLog });

      const nodes = useFlowStore.getState().nodes;
      const { result } = renderHook(() =>
        useTerminalCommandSubmit(nodes, true, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab)
      );

      act(() => {
        result.current.processCommandSubmit('kubectl get pods', setIsDropdownOpen, setIsNavigatingHistory);
      });

      expect(addActivityLog).toHaveBeenCalledWith('$ kubectl get pods');
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('web-pod'));
    });

    it('processCommandSubmit handles "clear" command and resets state', () => {
      const nodes = useFlowStore.getState().nodes;
      const { result } = renderHook(() =>
        useTerminalCommandSubmit(nodes, true, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab)
      );

      act(() => {
        result.current.processCommandSubmit('clear', setIsDropdownOpen, setIsNavigatingHistory);
      });

      expect(clearTerminalLogs).toHaveBeenCalled();
      expect(result.current.commandHistory).toEqual(['clear']);
      expect(result.current.commandHistoryEntries).toHaveLength(1);
    });

    it('processCommandSubmit invokes Wails App.WriteLog when available (resolving and rejecting)', async () => {
      const writeLogMock = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).go = {
        main: {
          App: {
            WriteLog: writeLogMock,
          },
        },
      };

      const nodes = useFlowStore.getState().nodes;
      const { result } = renderHook(() =>
        useTerminalCommandSubmit(nodes, true, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab)
      );

      act(() => {
        result.current.processCommandSubmit('kubectl get pods', setIsDropdownOpen, setIsNavigatingHistory);
      });

      expect(writeLogMock).toHaveBeenCalledWith('kubeconsole', 'info', expect.stringContaining('$ kubectl get pods'));

      // Test WriteLog rejection handling
      writeLogMock.mockRejectedValue(new Error('WriteLog error'));
      act(() => {
        result.current.processCommandSubmit('kubectl get services', setIsDropdownOpen, setIsNavigatingHistory);
      });
      expect(writeLogMock).toHaveBeenCalledWith('kubeconsole', 'info', expect.stringContaining('$ kubectl get services'));
    });

    it('processCommandSubmit dedupes consecutive identical commands in history', () => {
      const nodes = useFlowStore.getState().nodes;
      const { result } = renderHook(() =>
        useTerminalCommandSubmit(nodes, true, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab)
      );

      act(() => {
        result.current.processCommandSubmit('kubectl get pods', setIsDropdownOpen, setIsNavigatingHistory);
      });

      act(() => {
        result.current.processCommandSubmit('kubectl get pods', setIsDropdownOpen, setIsNavigatingHistory);
      });

      expect(result.current.commandHistory).toEqual(['kubectl get pods']);
      expect(result.current.commandHistoryEntries).toHaveLength(2);
    });

    it('allows updating input and history index via state setters', () => {
      const nodes = useFlowStore.getState().nodes;
      const { result } = renderHook(() =>
        useTerminalCommandSubmit(nodes, true, clearTerminalLogs, setTerminalSelectedResourceId, setTerminalActiveTab)
      );

      act(() => {
        result.current.setCommandInput('hello');
        result.current.setHistoryIndex(0);
      });

      expect(result.current.commandInput).toBe('hello');
      expect(result.current.historyIndex).toBe(0);
    });
  });
});
