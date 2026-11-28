import { describe, it, expect, vi } from 'vitest';
import { Node } from '@xyflow/react';
import {
  handleGetPods,
  handleGetDeployments,
  handleGetServices,
  handleGetNamespaces,
  handleGetStatefulSets,
  handleGetPvcs,
  handleGetCommands,
  handleLogsCommand,
  handleHistoryCommand,
  handleHelpCommand,
  handleDescribeCommand,
} from '@/activities/terminal/terminalHandlers';

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
        { id: 'rs-1', type: 'ReplicaSet', data: { label: 'web-rs' }, position: { x: 0, y: 0 } },
      ];

      handleGetPods(addActivityLog, nodes, true);

      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('NAME'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('web-pod'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('pod-2'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('web-rs'));
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

  describe('handleGetNamespaces', () => {
    it('logs when no namespaces exist', () => {
      const addActivityLog = vi.fn();
      handleGetNamespaces(addActivityLog, []);
      expect(addActivityLog).toHaveBeenCalledWith('No namespaces found on the canvas.');
    });

    it('logs namespaces with custom status and fallback to id and Active status', () => {
      const addActivityLog = vi.fn();
      const nodes: Node[] = [
        { id: 'ns-1', type: 'Namespace', data: { label: 'production', status: 'Terminating' }, position: { x: 0, y: 0 } },
        { id: 'ns-2', type: 'Namespace', data: {}, position: { x: 0, y: 0 } },
      ];

      handleGetNamespaces(addActivityLog, nodes);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('NAME'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('production'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('Terminating'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('ns-2'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('Active'));
    });
  });

  describe('handleGetStatefulSets', () => {
    it('logs when no statefulsets exist', () => {
      const addActivityLog = vi.fn();
      handleGetStatefulSets(addActivityLog, [], false);
      expect(addActivityLog).toHaveBeenCalledWith('No statefulsets found on the canvas.');
    });

    it('logs statefulsets in simulating and non-simulating modes with replicas and fallback id', () => {
      const addActivityLog = vi.fn();
      const nodes: Node[] = [
        { id: 'sts-1', type: 'StatefulSet', data: { label: 'db-cluster', replicas: 3 }, position: { x: 0, y: 0 } },
        { id: 'sts-2', type: 'StatefulSet', data: {}, position: { x: 0, y: 0 } },
      ];

      // Non-simulating mode
      handleGetStatefulSets(addActivityLog, nodes, false);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('0/3'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('sts-2'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('0/1'));

      addActivityLog.mockClear();

      // Simulating mode
      handleGetStatefulSets(addActivityLog, nodes, true);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('3/3'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('1/1'));
    });
  });

  describe('handleGetPvcs', () => {
    it('logs when no pvcs exist', () => {
      const addActivityLog = vi.fn();
      handleGetPvcs(addActivityLog, []);
      expect(addActivityLog).toHaveBeenCalledWith('No persistentvolumeclaims found on the canvas.');
    });

    it('logs pvcs with custom storageCapacity, size fallback, status, accessModes and fallback id', () => {
      const addActivityLog = vi.fn();
      const nodes: Node[] = [
        {
          id: 'pvc-1',
          type: 'PVC',
          data: { label: 'data-pvc', storageCapacity: '10Gi', pvcStatus: 'Bound', accessMode: ['ReadWriteOnce', 'ReadOnlyMany'] },
          position: { x: 0, y: 0 },
        },
        {
          id: 'pvc-2',
          type: 'PVC',
          data: { size: '5Gi', accessMode: 'ReadWriteOnce' as any },
          position: { x: 0, y: 0 },
        },
        {
          id: 'pvc-3',
          type: 'PVC',
          data: {},
          position: { x: 0, y: 0 },
        },
      ];

      handleGetPvcs(addActivityLog, nodes);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('NAME'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('data-pvc'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('10Gi'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('Bound'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('ReadWriteOnce,ReadOnlyMany'));

      // size fallback and non-array accessMode
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('pvc-2'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('5Gi'));

      // minimal defaults
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('pvc-3'));
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('-'));
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

    it('handles get namespace variants', () => {
      const addActivityLog = vi.fn();
      ['kubectl get namespaces', 'kubectl get namespace', 'kubectl get ns'].forEach((cmd) => {
        expect(handleGetCommands(cmd, addActivityLog, nodes, true)).toBe(true);
      });
    });

    it('handles get statefulset variants', () => {
      const addActivityLog = vi.fn();
      ['kubectl get statefulsets', 'kubectl get statefulset', 'kubectl get sts'].forEach((cmd) => {
        expect(handleGetCommands(cmd, addActivityLog, nodes, true)).toBe(true);
      });
    });

    it('handles get pvc variants', () => {
      const addActivityLog = vi.fn();
      ['kubectl get pvcs', 'kubectl get pvc'].forEach((cmd) => {
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

      // Test without prefix
      expect(handleLogsCommand('kubectl logs web-pod', addActivityLog, nodes, setTerminalSelectedResourceId, setTerminalActiveTab)).toBe(true);
      expect(setTerminalSelectedResourceId).toHaveBeenCalledWith('pod-1');
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

    it('handles pod describe timeout callback when hoveredAutocompletePodName matches target or changes before timeout', () => {
      vi.useFakeTimers();
      const addActivityLog = vi.fn();

      const podNodeNoData: Node[] = [
        {
          id: 'pod-bare',
          type: 'Pod',
          position: { x: 0, y: 0 },
        },
      ];

      expect(handleDescribeCommand('kubectl describe pod pod-bare', addActivityLog, podNodeNoData, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:         pod-bare');
      expect(addActivityLog).toHaveBeenCalledWith('Status:       Pending');
      expect(addActivityLog).toHaveBeenCalledWith('    Image:      nginx:latest');
      expect(addActivityLog).toHaveBeenCalledWith('      cpu:      500m');
      expect(addActivityLog).toHaveBeenCalledWith('      memory:   256Mi');

      // Test timer expiration when hovered state matches
      vi.advanceTimersByTime(3000);

      // Test timer expiration when hovered state changed beforehand
      handleDescribeCommand('kubectl describe pod pod-bare', addActivityLog, podNodeNoData, false);
      // Simulate hover change to something else
      const store = (globalThis as any).useFlowStore?.getState();
      if (store) store.setHoveredAutocompletePodName('other-pod');
      vi.advanceTimersByTime(3000);

      vi.useRealTimers();
    });

    it('describes namespace using namespace and ns aliases with custom and fallback properties', () => {
      const addActivityLog = vi.fn();
      const nsNodes: Node[] = [
        { id: 'ns-custom', type: 'Namespace', data: { label: 'kube-system', status: 'Terminating' }, position: { x: 0, y: 0 } },
        { id: 'ns-bare', type: 'Namespace', data: {}, position: { x: 0, y: 0 } },
      ];

      // Custom namespace
      expect(handleDescribeCommand('kubectl describe namespace kube-system', addActivityLog, nsNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               kube-system');
      expect(addActivityLog).toHaveBeenCalledWith('Status:             Terminating');

      addActivityLog.mockClear();

      // Bare namespace with ns alias
      expect(handleDescribeCommand('kubectl describe ns ns-bare', addActivityLog, nsNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               ns-bare');
      expect(addActivityLog).toHaveBeenCalledWith('Status:             Active');
    });

    it('describes service using service and svc aliases with custom and fallback properties', () => {
      const addActivityLog = vi.fn();
      const svcNodes: Node[] = [
        {
          id: 'svc-custom',
          type: 'Service',
          data: { label: 'my-lb', serviceType: 'LoadBalancer', port: 443, selector: 'app=web' },
          position: { x: 0, y: 0 },
        },
        { id: 'svc-bare', type: 'Service', data: {}, position: { x: 0, y: 0 } },
      ];

      // Custom service
      expect(handleDescribeCommand('kubectl describe service my-lb', addActivityLog, svcNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               my-lb');
      expect(addActivityLog).toHaveBeenCalledWith('Type:               LoadBalancer');
      expect(addActivityLog).toHaveBeenCalledWith('Port:               443/TCP');
      expect(addActivityLog).toHaveBeenCalledWith('Selector:           app=web');

      addActivityLog.mockClear();

      // Bare service with svc alias
      expect(handleDescribeCommand('kubectl describe svc svc-bare', addActivityLog, svcNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               svc-bare');
      expect(addActivityLog).toHaveBeenCalledWith('Type:               ClusterIP');
      expect(addActivityLog).toHaveBeenCalledWith('Port:               80/TCP');
      expect(addActivityLog).toHaveBeenCalledWith('Selector:           <none>');
    });

    it('describes ingress with custom and fallback properties', () => {
      const addActivityLog = vi.fn();
      const ingressNodes: Node[] = [
        {
          id: 'ing-custom',
          type: 'Ingress',
          data: { label: 'my-ingress', ingressHost: 'api.example.com', backendServiceName: 'api-service' },
          position: { x: 0, y: 0 },
        },
        { id: 'ing-bare', type: 'Ingress', data: {}, position: { x: 0, y: 0 } },
      ];

      // Custom ingress
      expect(handleDescribeCommand('kubectl describe ingress my-ingress', addActivityLog, ingressNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               my-ingress');
      expect(addActivityLog).toHaveBeenCalledWith('Host:               api.example.com');
      expect(addActivityLog).toHaveBeenCalledWith('BackendService:     api-service');

      addActivityLog.mockClear();

      // Bare ingress
      expect(handleDescribeCommand('kubectl describe ingress ing-bare', addActivityLog, ingressNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               ing-bare');
      expect(addActivityLog).toHaveBeenCalledWith('Host:               <none>');
      expect(addActivityLog).toHaveBeenCalledWith('BackendService:     <none>');
    });

    it('describes pvc with custom and fallback properties including size fallback', () => {
      const addActivityLog = vi.fn();
      const pvcNodes: Node[] = [
        {
          id: 'pvc-custom',
          type: 'PVC',
          data: {
            label: 'fast-pvc',
            storageClass: 'fast-ssd',
            storageCapacity: '50Gi',
            accessMode: ['ReadWriteOnce'],
            pvcStatus: 'Bound',
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'pvc-size-fallback',
          type: 'PVC',
          data: { size: '20Gi', accessMode: 'ReadWriteMany' as any },
          position: { x: 0, y: 0 },
        },
        { id: 'pvc-bare', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      ];

      // Custom PVC
      expect(handleDescribeCommand('kubectl describe pvc fast-pvc', addActivityLog, pvcNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               fast-pvc');
      expect(addActivityLog).toHaveBeenCalledWith('StorageClass:       fast-ssd');
      expect(addActivityLog).toHaveBeenCalledWith('Size:               50Gi');
      expect(addActivityLog).toHaveBeenCalledWith('AccessModes:        ReadWriteOnce');
      expect(addActivityLog).toHaveBeenCalledWith('Status:             Bound');

      addActivityLog.mockClear();

      // Size fallback and non-array accessMode
      expect(handleDescribeCommand('kubectl describe pvc pvc-size-fallback', addActivityLog, pvcNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Size:               20Gi');
      expect(addActivityLog).toHaveBeenCalledWith('AccessModes:        <none>');

      addActivityLog.mockClear();

      // Bare PVC
      expect(handleDescribeCommand('kubectl describe pvc pvc-bare', addActivityLog, pvcNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               pvc-bare');
      expect(addActivityLog).toHaveBeenCalledWith('StorageClass:       <none>');
      expect(addActivityLog).toHaveBeenCalledWith('Size:               <none>');
      expect(addActivityLog).toHaveBeenCalledWith('Status:             <none>');
    });

    it('describes hpa with custom and fallback properties', () => {
      const addActivityLog = vi.fn();
      const hpaNodes: Node[] = [
        {
          id: 'hpa-custom',
          type: 'HPA',
          data: {
            label: 'frontend-hpa',
            minReplicas: 2,
            maxReplicas: 20,
            targetCPU: 80,
            targetMemory: 75,
          },
          position: { x: 0, y: 0 },
        },
        { id: 'hpa-bare', type: 'HPA', data: {}, position: { x: 0, y: 0 } },
      ];

      // Custom HPA
      expect(handleDescribeCommand('kubectl describe hpa frontend-hpa', addActivityLog, hpaNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               frontend-hpa');
      expect(addActivityLog).toHaveBeenCalledWith('MinReplicas:        2');
      expect(addActivityLog).toHaveBeenCalledWith('MaxReplicas:        20');
      expect(addActivityLog).toHaveBeenCalledWith('TargetCPU:          80%');
      expect(addActivityLog).toHaveBeenCalledWith('TargetMemory:       75');

      addActivityLog.mockClear();

      // Bare HPA
      expect(handleDescribeCommand('kubectl describe hpa hpa-bare', addActivityLog, hpaNodes, false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:               hpa-bare');
      expect(addActivityLog).toHaveBeenCalledWith('MinReplicas:        1');
      expect(addActivityLog).toHaveBeenCalledWith('MaxReplicas:        10');
      expect(addActivityLog).toHaveBeenCalledWith('TargetCPU:          50%');
      expect(addActivityLog).toHaveBeenCalledWith('TargetMemory:       <none>');
    });

    it('describes pod using po alias and deployment using deployment alias', () => {
      const addActivityLog = vi.fn();
      expect(handleDescribeCommand('kubectl describe po web-pod', addActivityLog, nodes, true)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:         web-pod');

      addActivityLog.mockClear();
      expect(handleDescribeCommand('kubectl describe deployment dep-1', addActivityLog, nodes, true)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Name:         dep-1');
    });

    it('logs NotFound error for missing service, namespace, ingress, pvc, hpa', () => {
      const addActivityLog = vi.fn();
      expect(handleDescribeCommand('kubectl describe svc missing-svc', addActivityLog, [], false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): svc "missing-svc" not found');

      expect(handleDescribeCommand('kubectl describe ns missing-ns', addActivityLog, [], false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): ns "missing-ns" not found');

      expect(handleDescribeCommand('kubectl describe ingress missing-ing', addActivityLog, [], false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): ingress "missing-ing" not found');

      expect(handleDescribeCommand('kubectl describe pvc missing-pvc', addActivityLog, [], false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): pvc "missing-pvc" not found');

      expect(handleDescribeCommand('kubectl describe hpa missing-hpa', addActivityLog, [], false)).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith('Error from server (NotFound): hpa "missing-hpa" not found');
    });
  });
});
