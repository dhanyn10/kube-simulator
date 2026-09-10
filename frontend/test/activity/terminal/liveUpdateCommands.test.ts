import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '../../../src/store';
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
} from '../../../src/activity/terminal/liveUpdateCommands';

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

  it('dispatchLiveCommand opens terminal, switches tab to activity, and adds activity log', () => {
    dispatchLiveCommand('kubectl get pods');

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('activity');
    expect(state.activityLogs.some((line) => line.includes('kubectl get pods'))).toBe(true);
  });

  it('emitLiveScaleCommand dispatches scale command with previous replica count logged correctly', () => {
    // Add dummy deployment node to store
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

  it('emitLiveSetImageCommand dispatches set image command', () => {
    emitLiveSetImageCommand('web-dep', 'Deployment', 'nginx:alpine', 'nginx:latest');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl set image deployment/web-dep web-dep-container=nginx:alpine'))).toBe(true);
  });

  it('emitLiveSetResourcesCommand dispatches set resources command with cpu and memory', () => {
    emitLiveSetResourcesCommand('web-dep', 'Deployment', '200m', '512Mi');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl set resources deployment/web-dep --limits=cpu=200m,memory=512Mi'))).toBe(true);
  });

  it('emitLiveConfigMapCommand dispatches configmap creation command with target', () => {
    emitLiveConfigMapCommand('app-config', 'backend-api');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl create configmap app-config --from-literal=attachedTo=backend-api'))).toBe(true);
  });

  it('emitLiveSecretCommand dispatches secret creation command', () => {
    emitLiveSecretCommand('db-secret', 'Opaque', 'db-pod');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl create secret generic db-secret --from-literal=attachedTo=db-pod'))).toBe(true);
  });

  it('emitLiveHpaCommand dispatches autoscale command', () => {
    emitLiveHpaCommand('app-hpa', 'app-dep', 2, 8, 75);

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl autoscale deployment/app-dep --name=app-hpa --min=2 --max=8 --cpu-percent=75'))).toBe(true);
  });

  it('emitLiveRoleCommand dispatches role creation command', () => {
    emitLiveRoleCommand('pod-reader', 'my-namespace');

    const state = useFlowStore.getState();
    expect(state.activityLogs.some((line) => line.includes('kubectl create role pod-reader --verb=get,list,watch --resource=pods --attached-to=my-namespace'))).toBe(true);
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
