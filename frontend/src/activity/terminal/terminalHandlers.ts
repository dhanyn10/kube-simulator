import { Node } from '@xyflow/react';
import { safeRandom } from '../../lib/utils';
import { CommandContext } from './terminalCommands';
import { CommandHistoryEntry, findNodeByTargetName, getPodDisplayStatus } from './terminalLogUtils';

export const handleGetPods = (addActivityLog: (line: string) => void, nodes: Node[], isSimulating: boolean) => {
  const workloads = nodes.filter(n => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet');
  if (workloads.length === 0) {
    addActivityLog('No pods or workloads found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(38)} READY   STATUS              RESTARTS   AGE`);
  workloads.forEach(w => {
    const name = (w.data?.label as string) || w.id;
    const { ready, displayStatus } = getPodDisplayStatus(w.data?.status as string, isSimulating);
    addActivityLog(`${String(name).padEnd(38)} ${ready.padEnd(7)} ${displayStatus.padEnd(19)} 0          45s`);
  });
};

export const handleGetDeployments = (addActivityLog: (line: string) => void, nodes: Node[], isSimulating: boolean) => {
  const deploys = nodes.filter(n => n.type === 'Deployment');
  if (deploys.length === 0) {
    addActivityLog('No deployments found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(30)} READY   UP-TO-DATE   AVAILABLE   AGE`);
  deploys.forEach(d => {
    const name = (d.data?.label as string) || d.id;
    const replicas = (d.data?.replicas as number) || 1;
    const status = isSimulating ? `${replicas}/${replicas}` : `0/${replicas}`;
    addActivityLog(`${String(name).padEnd(30)} ${status.padEnd(7)} ${String(replicas).padEnd(12)} ${String(isSimulating ? replicas : 0).padEnd(11)} 2m`);
  });
};

export const handleGetServices = (addActivityLog: (line: string) => void, nodes: Node[]) => {
  const svcs = nodes.filter(n => n.type === 'Service');
  if (svcs.length === 0) {
    addActivityLog('No services found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(30)} TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)`);
  svcs.forEach(s => {
    const name = (s.data?.label as string) || s.id;
    const port = (s.data?.port as number) || 80;
    addActivityLog(`${String(name).padEnd(30)} ClusterIP   10.96.4.52   <none>        ${port}/TCP`);
  });
};

export const handleGetCommands = (
  cmdLower: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  isSimulating: boolean
): boolean => {
  const isPodGet = ['kubectl get pods', 'kubectl get pod', 'kubectl get pods -w', 'kubectl get pod -w'].includes(cmdLower);
  if (isPodGet) {
    handleGetPods(addActivityLog, nodes, isSimulating);
    return true;
  }

  const isDeployGet = ['kubectl get deployments', 'kubectl get deployment', 'kubectl get deploy'].includes(cmdLower);
  if (isDeployGet) {
    handleGetDeployments(addActivityLog, nodes, isSimulating);
    return true;
  }

  const isSvcGet = ['kubectl get services', 'kubectl get service', 'kubectl get svc'].includes(cmdLower);
  if (isSvcGet) {
    handleGetServices(addActivityLog, nodes);
    return true;
  }

  return false;
};

const cleanLogTargetName = (rawName: string): string => {
  const name = rawName.toLowerCase();
  if (name.startsWith('pod/')) return name.substring(4);
  if (name.startsWith('deployment/')) return name.substring(11);
  if (name.startsWith('deploy/')) return name.substring(7);
  return name;
};

const isLoggableNode = (n: Node, targetName: string): boolean => {
  if (!['Pod', 'Deployment', 'ReplicaSet'].includes(n.type)) return false;
  const label = n.data?.label ? String(n.data.label).toLowerCase() : '';
  return n.id.toLowerCase() === targetName || label === targetName;
};

export const handleLogsCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  setTerminalSelectedResourceId: (id: string | null) => void,
  setTerminalActiveTab: (tab: 'activity' | 'logs') => void
): boolean => {
  const logsMatch = /^kubectl\s+logs\s+([-a-z0-9/]+)/i.exec(cmd);
  if (!logsMatch) return false;

  const targetName = cleanLogTargetName(logsMatch[1]);
  const foundNode = findNodeByTargetName(nodes, targetName, ['Pod', 'Deployment', 'ReplicaSet']);

  if (foundNode) {
    setTerminalSelectedResourceId(foundNode.id);
    setTerminalActiveTab('logs');
    addActivityLog(`Switched console output stream to logs for resource: ${foundNode.type.toLowerCase()}/${targetName}`);
  } else {
    addActivityLog(`Error from server (NotFound): resource "${targetName}" not found`);
  }
  return true;
};

export const handleHistoryCommand = (
  cmdLower: string,
  historyEntries: CommandHistoryEntry[],
  addActivityLog: (line: string) => void
): boolean => {
  if (cmdLower !== 'history') return false;
  if (historyEntries.length === 0) {
    addActivityLog('No command history recorded.');
    return true;
  }
  historyEntries.forEach((entry) => {
    const paddedId = String(entry.id).padStart(5, ' ');
    addActivityLog(`${paddedId}  ${entry.timestamp}  ${entry.command}`);
  });
  return true;
};

export const handleHelpCommand = (cmdLower: string, addActivityLogOrCtx: ((line: string) => void) | CommandContext): boolean => {
  if (cmdLower !== 'help') return false;

  let addActivityLog: (line: string) => void;
  let isAdmin = false;

  if (typeof addActivityLogOrCtx === 'function') {
    addActivityLog = addActivityLogOrCtx;
  } else {
    addActivityLog = addActivityLogOrCtx.addActivityLog;
    const store = addActivityLogOrCtx.getStoreState();
    isAdmin = store.isAdminAuthenticated;
  }

  if (isAdmin) {
    addActivityLog('Admin CLI Commands:');
    addActivityLog('  try version update <version>          Simulate update notification button (e.g. try version update 0.4.0)');
    addActivityLog('  try version current <version>         Simulate current application version (e.g. try version current 0.3.0)');
    addActivityLog('  try version clear                     Clear simulated current version');
    addActivityLog('  try clear                             Clear all simulated version settings');
    addActivityLog('  try status                            View secret mode status');
    addActivityLog('  logout / exit                         Exit Admin Mode and return to standard CLI');
    return true;
  }

  addActivityLog('Available educational Kubernetes commands:');
  addActivityLog('  kubectl get pods                      List all pods on the canvas');
  addActivityLog('  kubectl get deployments               List deployments on the canvas');
  addActivityLog('  kubectl get services                  List services on the canvas');
  addActivityLog('  kubectl get all                       List all resources on the canvas');
  addActivityLog('  kubectl scale deployment/<name>       Scale replicas of a deployment');
  addActivityLog('  kubectl set image deployment/<name>   Set container image (triggers Rolling Update)');
  addActivityLog('  kubectl rollout status deploy/<name>  Check progress of a rolling update');
  addActivityLog('  kubectl rollout history deploy/<name> View rollout revision history');
  addActivityLog('  kubectl rollout undo deploy/<name>    Rollback to the previous deployment revision');
  addActivityLog('  kubectl delete pod <name>             Delete pod (triggers replica controller self-healing)');
  addActivityLog('  kubectl get roles                     List all roles on the canvas');
  addActivityLog('  kubectl get rolebindings              List role bindings on the canvas');
  addActivityLog('  kubectl describe role <name>          Describe role specifications & rules');
  addActivityLog('  kubectl get configmaps                List all configmaps on the canvas');
  addActivityLog('  kubectl describe cm <name>            Describe configmap specifications & data');
  addActivityLog('  kubectl get secrets                   List all secrets on the canvas');
  addActivityLog('  kubectl describe secret <name>        Describe secret specifications & data');
  addActivityLog('  kubectl logs <pod-name>               Stream live container stdout logs');
  addActivityLog('  kubectl describe deploy <name>        Describe deployment specifications');
  addActivityLog('  kubectl describe pod <name>           Describe pod specifications & events');
  addActivityLog('  history                               View command execution history with timestamps');
  addActivityLog('  clear                                 Clear the console log list');

  return true;
};

const isTargetNode = (n: Node, type: string, targetName: string): boolean => {
  const matchesType = n.type.toLowerCase() === type || (type === 'deploy' && n.type === 'Deployment');
  if (!matchesType) return false;
  const label = n.data?.label ? String(n.data.label).toLowerCase() : '';
  return n.id.toLowerCase() === targetName || label === targetName;
};

const printNodeDescription = (
  foundNode: Node,
  isSimulating: boolean,
  addActivityLog: (line: string) => void
) => {
  const name = (foundNode.data?.label as string) || foundNode.id;
  const status = (foundNode.data?.status as string) || (isSimulating ? 'Running' : 'Pending');
  const image = (foundNode.data?.image as string) || 'nginx:latest';
  const cpu = (foundNode.data?.cpuLimit as string) || '500m';
  const memory = (foundNode.data?.memoryLimit as string) || '256Mi';

  addActivityLog(`Name:         ${name}`);
  addActivityLog(`Namespace:    default`);
  addActivityLog(`Status:       ${status}`);
  addActivityLog(`IP:           10.244.0.${Math.floor(safeRandom() * 253) + 2}`);
  addActivityLog(`Containers:`);
  addActivityLog(`  app-container:`);
  addActivityLog(`    Image:      ${image}`);
  addActivityLog(`    Limits:`);
  addActivityLog(`      cpu:      ${cpu}`);
  addActivityLog(`      memory:   ${memory}`);
  addActivityLog(`Events:`);
  addActivityLog(`  Type    Reason     Age   From               Message`);
  addActivityLog(`  ----    ------     ----  ----               -------`);
  addActivityLog(`  Normal  Scheduled  1m    default-scheduler  Successfully assigned default/${name} to minikube-worker-1`);
  addActivityLog(`  Normal  Pulling    50s   kubelet            Pulling image "${image}"`);
  addActivityLog(`  Normal  Pulled     45s   kubelet            Successfully pulled image "${image}"`);
  addActivityLog(`  Normal  Created    44s   kubelet            Created container app-container`);
  addActivityLog(`  Normal  Started    44s   kubelet            Started container app-container`);
};

export const handleDescribeCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  isSimulating: boolean
): boolean => {
  const describeMatch = /^kubectl\s+describe\s+(pod|deploy(?:ment)?)\s+([-a-z0-9]+)/i.exec(cmd);
  if (!describeMatch) return false;

  const type = describeMatch[1].toLowerCase();
  const targetName = describeMatch[2].toLowerCase();

  const nodeTypes = type === 'pod' ? ['Pod'] : ['Deployment'];
  const foundNode = findNodeByTargetName(nodes, targetName, nodeTypes);

  if (foundNode) {
    printNodeDescription(foundNode, isSimulating, addActivityLog);
  } else {
    addActivityLog(`Error from server (NotFound): ${type} "${targetName}" not found`);
  }
  return true;
};
