import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useFlowStore } from '@/store';
import {
  dispatchLiveCommand,
  emitLiveScaleCommand,
  emitLiveSetImageCommand,
  emitLiveSetResourcesCommand,
  emitLiveConfigMapCommand,
  emitLiveSecretCommand,
  emitLiveHpaCommand,
  emitLiveRoleCommand,
  emitLiveNodeCreatedCommand,
  emitLiveNodeDeletedCommand,
  emitLiveEdgeCreatedCommand,
  emitLiveEdgeDeletedCommand,
} from '@/activities/terminal/liveUpdateCommands';

describe('liveUpdateCommands', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      isTerminalOpen: false,
      terminalActiveTab: 'logs',
      activityLogs: [],
    });
  });

  afterEach(() => {
    delete (globalThis as any).go;
  });

  it('dispatchLiveCommand opens terminal, switches tab to activity, and adds activity log', () => {
    dispatchLiveCommand('kubectl get pods');

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('activity');
    expect(state.activityLogs.some((line) => line.includes('kubectl get pods'))).toBe(true);
  });

  it('dispatchLiveCommand handles terminal already open and already on activity tab', () => {
    useFlowStore.setState({
      isTerminalOpen: true,
      terminalActiveTab: 'activity',
    });

    dispatchLiveCommand('kubectl get pods');

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('activity');
  });

  it('dispatchLiveCommand executes WriteLog on Wails app when present and catches errors', async () => {
    const mockWriteLog = vi.fn().mockRejectedValue(new Error('WriteLog failed'));
    (globalThis as any).go = {
      main: {
        App: {
          WriteLog: mockWriteLog,
        },
      },
    };

    dispatchLiveCommand('kubectl get pods');

    expect(mockWriteLog).toHaveBeenCalledWith('kubeconsole', 'info', expect.stringContaining('$ kubectl get pods'));
  });

  it('emitLiveScaleCommand dispatches scale command with previous replica count logged correctly', () => {
    useFlowStore.setState({
      nodes: [
        {
          id: 'dep-1',
          type: 'Deployment',
          position: { x: 0, y: 0 },
          data: { label: 'web-dep', replicas: 3 },
        },
      ],
    });

    emitLiveScaleCommand('web-dep', 'Deployment', 4, 3);

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl scale deployment/web-dep --replicas=4'))).toBe(true);
    expect(state.activityLogs.some((line) => line.includes('[scale] Scaling replicas from 3 to 4...'))).toBe(true);
  });

  it('emitLiveScaleCommand dispatches scale command for replicaset', () => {
    useFlowStore.setState({
      nodes: [
        {
          id: 'rs-1',
          type: 'ReplicaSet',
          position: { x: 0, y: 0 },
          data: { label: 'web-rs', replicas: 4 },
        },
      ],
    });

    emitLiveScaleCommand('web-rs', 'ReplicaSet', 3, 4);

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl scale replicaset/web-rs --replicas=3'))).toBe(true);
    expect(state.activityLogs.some((line) => line.includes('[scale] Scaling replicas from 4 to 3...'))).toBe(true);
  });

  it('emitLiveSetImageCommand dispatches set image command for Pod vs Deployment', () => {
    emitLiveSetImageCommand('web-pod', 'Pod', 'nginx:alpine', 'nginx:latest');
    const state1 = useFlowStore.getState();
    expect(state1.activityLogs.some((line) => line.includes('kubectl set image pod/web-pod web-pod-container=nginx:alpine'))).toBe(true);

    emitLiveSetImageCommand('web-dep', 'Deployment', 'nginx:alpine', 'nginx:latest');
    const state2 = useFlowStore.getState();
    expect(state2.activityLogs.some((line) => line.includes('kubectl set image deployment/web-dep web-dep-container=nginx:alpine'))).toBe(true);
  });

  it('emitLiveSetResourcesCommand handles cpu, memory, and empty limits', () => {
    emitLiveSetResourcesCommand('web-dep', 'Deployment', '200m', '512Mi');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('--limits=cpu=200m,memory=512Mi'))).toBe(true);

    emitLiveSetResourcesCommand('web-pod', 'Pod', '100m');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('--limits=cpu=100m'))).toBe(true);

    emitLiveSetResourcesCommand('web-pod', 'Pod', undefined, '256Mi');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('--limits=memory=256Mi'))).toBe(true);

    emitLiveSetResourcesCommand('web-pod', 'Pod');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl set resources pod/web-pod'))).toBe(true);
  });

  it('emitLiveConfigMapCommand dispatches configmap creation command with and without target', () => {
    emitLiveConfigMapCommand('app-config', 'backend-api');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create configmap app-config --from-literal=attachedTo=backend-api'))).toBe(true);

    emitLiveConfigMapCommand('global-config');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create configmap global-config'))).toBe(true);
  });

  it('emitLiveSecretCommand dispatches secret creation command with custom types and targets', () => {
    emitLiveSecretCommand('db-secret', 'Opaque', 'db-pod');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create secret generic db-secret --from-literal=attachedTo=db-pod'))).toBe(true);

    emitLiveSecretCommand('tls-secret', 'kubernetes.io/tls', 'web-ingress');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create secret generic tls-secret --type=kubernetes.io/tls --from-literal=attachedTo=web-ingress'))).toBe(true);

    emitLiveSecretCommand('standalone-secret', 'Opaque');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create secret generic standalone-secret'))).toBe(true);
  });

  it('emitLiveHpaCommand dispatches autoscale command', () => {
    emitLiveHpaCommand('app-hpa', 'app-dep', 2, 8, 75);

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl autoscale deployment/app-dep --name=app-hpa --min=2 --max=8 --cpu-percent=75'))).toBe(true);
  });

  it('emitLiveRoleCommand dispatches role creation command with and without target', () => {
    emitLiveRoleCommand('pod-reader', 'my-namespace');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create role pod-reader --verb=get,list,watch --resource=pods --attached-to=my-namespace'))).toBe(true);

    emitLiveRoleCommand('global-reader');
    expect(useFlowStore.getState().activityLogs.some((line) => line.includes('kubectl create role global-reader --verb=get,list,watch --resource=pods'))).toBe(true);
  });

  it('emitLiveNodeCreatedCommand and emitLiveNodeDeletedCommand dispatch create and delete commands', () => {
    emitLiveNodeCreatedCommand('Service', 'my-svc');
    emitLiveNodeDeletedCommand('Service', 'my-svc');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl create service my-svc'))).toBe(true);
    expect(state.activityLogs.some((line) => line.includes('kubectl delete service my-svc'))).toBe(true);
  });

  it('emitLiveEdgeCreatedCommand and emitLiveEdgeDeletedCommand dispatch expose and delete service commands', () => {
    emitLiveEdgeCreatedCommand('web-dep', 'api-svc');
    emitLiveEdgeDeletedCommand('web-dep', 'api-svc');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl expose deployment/web-dep --name=api-svc-svc'))).toBe(true);
    expect(state.activityLogs.some((line) => line.includes('kubectl delete service api-svc-svc'))).toBe(true);
  });
});
