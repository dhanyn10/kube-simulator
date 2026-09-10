import { Node } from '@xyflow/react';
import { useFlowStore } from '../../store';
import { CommandContext, executeKubectlCommand } from './useTerminalCommandSubmit';

// Flag to prevent recursive dispatch loops when terminal commands themselves modify store
let isDispatchingLiveCommand = false;

/**
 * Dispatches a live imperative command directly into Kube Console.
 * Automatically opens the terminal panel and executes the command.
 *
 * @param cmd - The kubectl imperative command string to execute
 * @param overrides - Optional previous values to accurately log state transitions
 */
export const dispatchLiveCommand = (
  cmd: string,
  overrides?: { prevReplicas?: number; prevImage?: string }
): void => {
  if (isDispatchingLiveCommand) return;
  isDispatchingLiveCommand = true;

  try {
    const store = useFlowStore.getState();

    // 1. Ensure Kube Console is visible
    if (!store.isTerminalOpen) {
      store.setTerminalOpen(true);
    }
    if (store.terminalActiveTab !== 'activity') {
      store.setTerminalActiveTab('activity');
    }

    // 2. Log prompt in activity logs
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    store.addActivityLog(`$ ${cmd}`);

    const wailsApp = globalThis.go?.main?.App as unknown as {
      WriteLog?: (cat: string, level: string, msg: string) => Promise<void>;
    };
    if (wailsApp?.WriteLog) {
      wailsApp.WriteLog('kubeconsole', 'info', `${timestamp} $ ${cmd}`).catch(() => {});
    }

    // 3. Build CommandContext and execute
    const ctx: CommandContext = {
      nodes: store.nodes,
      isSimulating: store.isSimulating,
      addActivityLog: store.addActivityLog,
      deleteNodes: store.deleteNodes,
      updateNodeData: store.updateNodeData,
      getStoreState: () => useFlowStore.getState(),
      setStoreState: (partial) => useFlowStore.setState(partial),
      overridePrevReplicas: overrides?.prevReplicas,
      overridePrevImage: overrides?.prevImage,
    };

    executeKubectlCommand(
      cmd,
      ctx,
      store.setTerminalSelectedResourceId,
      store.setTerminalActiveTab,
      []
    );
  } finally {
    isDispatchingLiveCommand = false;
  }
};

/**
 * Emits live scale command for Deployment or ReplicaSet.
 */
export const emitLiveScaleCommand = (
  nodeLabel: string,
  nodeType: string,
  replicas: number,
  prevReplicas?: number
): void => {
  const kind = nodeType.toLowerCase() === 'replicaset' ? 'replicaset' : 'deployment';
  dispatchLiveCommand(`kubectl scale ${kind}/${nodeLabel} --replicas=${replicas}`, { prevReplicas });
};

/**
 * Emits live set image command for Deployment, ReplicaSet, or Pod.
 */
export const emitLiveSetImageCommand = (
  nodeLabel: string,
  nodeType: string,
  image: string,
  prevImage?: string
): void => {
  const kind = nodeType.toLowerCase() === 'pod' ? 'pod' : 'deployment';
  const containerName = `${nodeLabel}-container`;
  dispatchLiveCommand(`kubectl set image ${kind}/${nodeLabel} ${containerName}=${image}`, { prevImage });
};

/**
 * Emits live set resources command for Deployment or Pod.
 */
export const emitLiveSetResourcesCommand = (
  nodeLabel: string,
  nodeType: string,
  cpu?: string,
  memory?: string
): void => {
  const kind = nodeType.toLowerCase() === 'pod' ? 'pod' : 'deployment';
  const limits: string[] = [];
  if (cpu) limits.push(`cpu=${cpu}`);
  if (memory) limits.push(`memory=${memory}`);
  const limitsStr = limits.length > 0 ? `--limits=${limits.join(',')}` : '';
  dispatchLiveCommand(`kubectl set resources ${kind}/${nodeLabel} ${limitsStr}`.trim());
};

/**
 * Emits live command for ConfigMap creation/attach.
 */
export const emitLiveConfigMapCommand = (
  cmName: string,
  targetLabel?: string
): void => {
  if (targetLabel) {
    dispatchLiveCommand(`kubectl create configmap ${cmName} --from-literal=attachedTo=${targetLabel}`);
  } else {
    dispatchLiveCommand(`kubectl create configmap ${cmName}`);
  }
};

/**
 * Emits live command for Secret creation/attach.
 */
export const emitLiveSecretCommand = (
  secretName: string,
  type = 'Opaque',
  targetLabel?: string
): void => {
  const secretTypeArg = type !== 'Opaque' ? ` --type=${type}` : '';
  if (targetLabel) {
    dispatchLiveCommand(`kubectl create secret generic ${secretName}${secretTypeArg} --from-literal=attachedTo=${targetLabel}`);
  } else {
    dispatchLiveCommand(`kubectl create secret generic ${secretName}${secretTypeArg}`);
  }
};

/**
 * Emits live command for HPA creation/attach.
 */
export const emitLiveHpaCommand = (
  hpaName: string,
  targetLabel: string,
  minReplicas = 1,
  maxReplicas = 10,
  cpuPercent = 80
): void => {
  dispatchLiveCommand(
    `kubectl autoscale deployment/${targetLabel} --name=${hpaName} --min=${minReplicas} --max=${maxReplicas} --cpu-percent=${cpuPercent}`
  );
};

/**
 * Emits live command for Role creation/attach.
 */
export const emitLiveRoleCommand = (
  roleName: string,
  targetLabel?: string
): void => {
  if (targetLabel) {
    dispatchLiveCommand(`kubectl create role ${roleName} --verb=get,list,watch --resource=pods --attached-to=${targetLabel}`);
  } else {
    dispatchLiveCommand(`kubectl create role ${roleName} --verb=get,list,watch --resource=pods`);
  }
};

/**
 * Emits live command when a new K8s resource node is added to canvas.
 */
export const emitLiveNodeCreatedCommand = (
  nodeType: string,
  nodeLabel: string
): void => {
  const kind = nodeType.toLowerCase();
  dispatchLiveCommand(`kubectl create ${kind} ${nodeLabel}`);
};

/**
 * Emits live command when a K8s resource node is deleted.
 */
export const emitLiveNodeDeletedCommand = (
  nodeType: string,
  nodeLabel: string
): void => {
  const kind = nodeType.toLowerCase();
  dispatchLiveCommand(`kubectl delete ${kind} ${nodeLabel}`);
};

/**
 * Emits live command when an edge connection is added.
 */
export const emitLiveEdgeCreatedCommand = (
  sourceLabel: string,
  targetLabel: string
): void => {
  dispatchLiveCommand(`kubectl expose deployment/${sourceLabel} --name=${targetLabel}-svc`);
};

/**
 * Emits live command when an edge connection is deleted.
 */
export const emitLiveEdgeDeletedCommand = (
  sourceLabel: string,
  targetLabel: string
): void => {
  dispatchLiveCommand(`kubectl delete service ${targetLabel}-svc`);
};
