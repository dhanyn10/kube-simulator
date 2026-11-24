import { Node } from '@xyflow/react';
import { safeRandom } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { CommandContext } from './terminalCommands';
import { CommandHistoryEntry, findNodeByTargetName, getPodDisplayStatus, printNodeEnvironment } from './terminalLogUtils';
import { APP_VERSION, getNextMinorVersion } from '@/constants/config';

/**
 * Handles the 'kubectl get pods' command by printing all workload pods present on the canvas.
 *
 * @param addActivityLog - Function callback to append a log line to terminal history.
 * @param nodes - Array of active React Flow canvas nodes.
 * @param isSimulating - Flag indicating whether simulation loop is actively running.
 */
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

/**
 * Handles the 'kubectl get deployments' command by printing all deployment workloads on the canvas.
 *
 * @param addActivityLog - Function callback to append a log line to terminal history.
 * @param nodes - Array of active React Flow canvas nodes.
 * @param isSimulating - Flag indicating whether simulation loop is actively running.
 */
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

/**
 * Handles the 'kubectl get namespaces' command by printing all Namespace resources on the canvas.
 */
export const handleGetNamespaces = (addActivityLog: (line: string) => void, nodes: Node[]) => {
  const namespaces = nodes.filter(n => n.type === 'Namespace');
  if (namespaces.length === 0) {
    addActivityLog('No namespaces found on the canvas.');
    return;
  }
  addActivityLog(`${'NAME'.padEnd(38)} STATUS`);
  namespaces.forEach((namespaceNode) => {
    const name = String(namespaceNode.data?.label || namespaceNode.id);
    addActivityLog(`${name.padEnd(38)} ${String(namespaceNode.data?.status || 'Active')}`);
  });
};

/**
 * Handles the 'kubectl get statefulsets' command by printing all StatefulSet workloads on the canvas.
 */
export const handleGetStatefulSets = (addActivityLog: (line: string) => void, nodes: Node[], isSimulating: boolean) => {
  const statefulSets = nodes.filter(n => n.type === 'StatefulSet');
  if (statefulSets.length === 0) {
    addActivityLog('No statefulsets found on the canvas.');
    return;
  }
  addActivityLog(`${"NAME".padEnd(30)} READY   UP-TO-DATE   AVAILABLE   AGE`);
  statefulSets.forEach((statefulSet) => {
    const name = (statefulSet.data?.label as string) || statefulSet.id;
    const replicas = (statefulSet.data?.replicas as number) || 1;
    const status = isSimulating ? `${replicas}/${replicas}` : `0/${replicas}`;
    addActivityLog(`${String(name).padEnd(30)} ${status.padEnd(7)} ${String(replicas).padEnd(12)} ${String(isSimulating ? replicas : 0).padEnd(11)} 2m`);
  });
};

/**
 * Handles the 'kubectl get pvcs' command by printing all PersistentVolumeClaims on the canvas.
 */
export const handleGetPvcs = (addActivityLog: (line: string) => void, nodes: Node[]) => {
  const pvcs = nodes.filter(n => n.type === 'PVC');
  if (pvcs.length === 0) {
    addActivityLog('No persistentvolumeclaims found on the canvas.');
    return;
  }
  addActivityLog(`${'NAME'.padEnd(38)} SIZE    STATUS    ACCESSMODES`);
  pvcs.forEach((pvc) => {
    const name = String(pvc.data?.label || pvc.id);
    const size = String(pvc.data?.storageCapacity || pvc.data?.size || '-');
    const status = String(pvc.data?.pvcStatus || '-');
    const modes = Array.isArray(pvc.data?.accessMode) ? pvc.data.accessMode.join(',') : '-';
    addActivityLog(`${String(name).padEnd(38)} ${size.padEnd(8)} ${status.padEnd(9)} ${modes}`);
  });
};

/**
 * Handles the 'kubectl get services' command by printing all service resources on the canvas.
 *
 * @param addActivityLog - Function callback to append a log line to terminal history.
 * @param nodes - Array of active React Flow canvas nodes.
 */
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

/**
 * Evaluates and dispatches 'kubectl get' sub-commands for pods, deployments, and services.
 *
 * @param cmdLower - Normalized lowercase CLI command string.
 * @param addActivityLog - Function callback to append log lines.
 * @param nodes - Array of active canvas nodes.
 * @param isSimulating - Flag indicating whether simulation loop is actively running.
 * @returns True if command was matched and handled; false otherwise.
 */
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

  const isNamespaceGet = ['kubectl get namespaces', 'kubectl get namespace', 'kubectl get ns'].includes(cmdLower);
  if (isNamespaceGet) {
    handleGetNamespaces(addActivityLog, nodes);
    return true;
  }

  const isStatefulSetGet = ['kubectl get statefulsets', 'kubectl get statefulset', 'kubectl get sts'].includes(cmdLower);
  if (isStatefulSetGet) {
    handleGetStatefulSets(addActivityLog, nodes, isSimulating);
    return true;
  }

  const isPvcGet = ['kubectl get pvcs', 'kubectl get pvc'].includes(cmdLower);
  if (isPvcGet) {
    handleGetPvcs(addActivityLog, nodes);
    return true;
  }

  return false;
};

/**
 * Sanitizes resource prefixes (e.g. 'pod/', 'deployment/', 'deploy/') from target log command resource strings.
 *
 * @param rawName - Raw resource target string.
 * @returns Cleaned resource target name.
 */
const cleanLogTargetName = (rawName: string): string => {
  const name = rawName.toLowerCase();
  if (name.startsWith('pod/')) return name.substring(4);
  if (name.startsWith('deployment/')) return name.substring(11);
  if (name.startsWith('deploy/')) return name.substring(7);
  return name;
};

/**
 * Handles 'kubectl logs <resource>' commands, switching the console output stream tab to live stdout logs.
 *
 * @param cmd - Raw input command string.
 * @param addActivityLog - Function callback to append log lines.
 * @param nodes - Array of active canvas nodes.
 * @param setTerminalSelectedResourceId - Callback to select target node ID for log streaming.
 * @param setTerminalActiveTab - Callback to switch terminal active tab view.
 * @returns True if command was matched and processed; false otherwise.
 */
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

/**
 * Handles the 'history' command by outputting past CLI execution commands with timestamps.
 *
 * @param cmdLower - Normalized lowercase command string.
 * @param historyEntries - Array of recorded command history entries.
 * @param addActivityLog - Function callback to append log lines.
 * @returns True if command was matched and handled; false otherwise.
 */
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

/**
 * Handles the 'help' command by printing educational Kubernetes CLI reference commands,
 * or Admin test CLI commands if secret dev mode is unlocked.
 *
 * @param cmdLower - Normalized lowercase command string.
 * @param addActivityLogOrCtx - Log callback function or execution command context.
 * @returns True if command was matched and handled; false otherwise.
 */
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
    const nextMinor = getNextMinorVersion(APP_VERSION);
    addActivityLog('Admin CLI Commands:');
    addActivityLog(`  try version update <version>          Simulate update notification button (e.g. try version update ${nextMinor})`);
    addActivityLog(`  try version current <version>         Simulate current application version (e.g. try version current ${APP_VERSION})`);
    addActivityLog('  try version clear                     Clear simulated current version');
    addActivityLog('  try clear                             Clear all simulated version settings');
    addActivityLog('  try status                            View secret mode status');
    addActivityLog('  logout / exit                         Exit Admin Mode and return to standard CLI');
    return true;
  }

  addActivityLog('Available educational Kubernetes commands:');
  addActivityLog('  kubectl config get-contexts           List available user context identities');
  addActivityLog('  kubectl config current-context        Show current active user identity');
  addActivityLog('  kubectl config use-context <user>     Switch active user context identity');
  addActivityLog('  kubectl config view                   View current kubeconfig digital credentials');
  addActivityLog('  kubectl get pods                      List all pods on the canvas');
  addActivityLog('  kubectl get deployments               List deployments on the canvas');
  addActivityLog('  kubectl get services                  List services on the canvas');
  addActivityLog('  kubectl get namespaces                List namespaces on the canvas');
  addActivityLog('  kubectl get statefulsets              List statefulsets on the canvas');
  addActivityLog('  kubectl get pvcs                      List persistentvolumeclaims on the canvas');
  addActivityLog('  kubectl get all                       List all resources on the canvas');
  addActivityLog('  kubectl scale deployment/<name>       Scale replicas of a deployment');
  addActivityLog('  kubectl set image deployment/<name>   Set container image (triggers Rolling Update)');
  addActivityLog('  kubectl rollout status deploy/<name>  Check progress of a rolling update');
  addActivityLog('  kubectl rollout history deploy/<name> View rollout revision history');
  addActivityLog('  kubectl rollout undo deploy/<name>    Rollback to the previous deployment revision');
  addActivityLog('  kubectl delete pod <name>             Delete pod (triggers replica controller self-healing)');
  addActivityLog('  kubectl delete deployment <name>       Delete deployment (or statefulset)');
  addActivityLog('  kubectl delete service <name>          Delete service');
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
  addActivityLog('  kubectl describe service <name>       Describe service type & port');
  addActivityLog('  kubectl describe namespace <name>     Describe namespace status');
  addActivityLog('  kubectl describe ingress <name>       Describe ingress host & backend');
  addActivityLog('  kubectl describe pvc <name>           Describe PVC storage details');
  addActivityLog('  kubectl describe hpa <name>           Describe HPA min/max/CPU target');
  addActivityLog('  kubectl exec <pod-name> -- env        Print container environment variables');
  addActivityLog('  history                               View command execution history with timestamps');
  addActivityLog('  clear                                 Clear the console log list');

  return true;
};

/**
 * Prints detailed resource specifications and scheduled events for a matched canvas node.
 *
 * @param foundNode - Matched node instance.
 * @param isSimulating - Flag indicating whether simulation loop is actively running.
 * @param addActivityLog - Function callback to append log lines.
 */
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
  printNodeEnvironment(foundNode.data, addActivityLog);
  addActivityLog(`Events:`);
  addActivityLog(`  Type    Reason     Age   From               Message`);
  addActivityLog(`  ----    ------     ----  ----               -------`);
  addActivityLog(`  Normal  Scheduled  1m    default-scheduler  Successfully assigned default/${name} to minikube-worker-1`);
  addActivityLog(`  Normal  Pulling    50s   kubelet            Pulling image "${image}"`);
  addActivityLog(`  Normal  Pulled     45s   kubelet            Successfully pulled image "${image}"`);
  addActivityLog(`  Normal  Created    44s   kubelet            Created container app-container`);
  addActivityLog(`  Normal  Started    44s   kubelet            Started container app-container`);
};

const printNamespaceDescription = (namespaceNode: Node, addActivityLog: (line: string) => void) => {
  const name = (namespaceNode.data?.label as string) || namespaceNode.id;
  addActivityLog(`Name:               ${name}`);
  addActivityLog(`Status:             ${String(namespaceNode.data?.status || 'Active')}`);
};

const printServiceDescription = (serviceNode: Node, addActivityLog: (line: string) => void) => {
  const name = (serviceNode.data?.label as string) || serviceNode.id;
  addActivityLog(`Name:               ${name}`);
  addActivityLog(`Type:               ${String(serviceNode.data?.serviceType || 'ClusterIP')}`);
  addActivityLog(`Port:               ${String(serviceNode.data?.port || 80)}/TCP`);
  addActivityLog(`Selector:           ${String((serviceNode.data as any)?.selector || '<none>')}`);
};

const printIngressDescription = (ingressNode: Node, addActivityLog: (line: string) => void) => {
  const name = (ingressNode.data?.label as string) || ingressNode.id;
  addActivityLog(`Name:               ${name}`);
  addActivityLog(`Host:               ${String((ingressNode.data as any)?.ingressHost || '<none>')}`);
  addActivityLog(`BackendService:     ${String((ingressNode.data as any)?.backendServiceName || '<none>')}`);
};

const printPvcDescription = (pvcNode: Node, addActivityLog: (line: string) => void) => {
  const name = (pvcNode.data?.label as string) || pvcNode.id;
  addActivityLog(`Name:               ${name}`);
  addActivityLog(`StorageClass:       ${String((pvcNode.data as any)?.storageClass || '<none>')}`);
  addActivityLog(`Size:               ${String((pvcNode.data as any)?.storageCapacity || (pvcNode.data as any)?.size || '<none>')}`);
  addActivityLog(`AccessModes:        ${Array.isArray((pvcNode.data as any)?.accessMode) ? (pvcNode.data as any).accessMode.join(',') : '<none>'}`);
  addActivityLog(`Status:             ${String((pvcNode.data as any)?.pvcStatus || '<none>')}`);
};

const printHpaDescription = (hpaNode: Node, addActivityLog: (line: string) => void) => {
  const name = (hpaNode.data?.label as string) || hpaNode.id;
  addActivityLog(`Name:               ${name}`);
  addActivityLog(`MinReplicas:        ${String((hpaNode.data as any)?.minReplicas || 1)}`);
  addActivityLog(`MaxReplicas:        ${String((hpaNode.data as any)?.maxReplicas || 10)}`);
  addActivityLog(`TargetCPU:          ${String((hpaNode.data as any)?.targetCPU || 50)}%`);
  addActivityLog(`TargetMemory:       ${String((hpaNode.data as any)?.targetMemory || '<none>')}`);
};

/**
 * Handles 'kubectl describe <pod|po|deploy|service|namespace|ingress|pvc|hpa> <name>' commands,
 * outputting specifications and event logs.
 *
 * @param cmd - Raw input command string.
 * @param addActivityLog - Function callback to append log lines.
 * @param nodes - Array of active canvas nodes.
 * @param isSimulating - Flag indicating whether simulation loop is actively running.
 * @returns True if command was matched and handled; false otherwise.
 */
export const handleDescribeCommand = (
  cmd: string,
  addActivityLog: (line: string) => void,
  nodes: Node[],
  isSimulating: boolean
): boolean => {
  const describeMatch = /^kubectl\s+describe\s+(pod|po|deploy(?:ment)?|service|svc|namespace|ns|ingress|pvc|hpa)\s+([-a-z0-9]+)/i.exec(cmd);
  if (!describeMatch) return false;

  const typeRaw = describeMatch[1].toLowerCase();
  const targetName = describeMatch[2].toLowerCase();

  const isPod = typeRaw === 'pod' || typeRaw === 'po';
  let nodeTypes: string[];
  if (isPod) {
    nodeTypes = ['Pod'];
  } else if (typeRaw === 'service' || typeRaw === 'svc') {
    nodeTypes = ['Service'];
  } else if (typeRaw === 'namespace' || typeRaw === 'ns') {
    nodeTypes = ['Namespace'];
  } else if (typeRaw === 'ingress') {
    nodeTypes = ['Ingress'];
  } else if (typeRaw === 'pvc') {
    nodeTypes = ['PVC'];
  } else if (typeRaw === 'hpa') {
    nodeTypes = ['HPA'];
  } else {
    nodeTypes = ['Deployment'];
  }

  const foundNode = findNodeByTargetName(nodes, targetName, nodeTypes);

  if (foundNode) {
    if (typeRaw === 'namespace' || typeRaw === 'ns') {
      printNamespaceDescription(foundNode, addActivityLog);
    } else if (typeRaw === 'service' || typeRaw === 'svc') {
      printServiceDescription(foundNode, addActivityLog);
    } else if (typeRaw === 'ingress') {
      printIngressDescription(foundNode, addActivityLog);
    } else if (typeRaw === 'pvc') {
      printPvcDescription(foundNode, addActivityLog);
    } else if (typeRaw === 'hpa') {
      printHpaDescription(foundNode, addActivityLog);
    } else {
      printNodeDescription(foundNode, isSimulating, addActivityLog);
    }

    if (isPod) {
      const setHoveredAutocompletePodName = useFlowStore.getState().setHoveredAutocompletePodName;
      const targetLabel = (foundNode.data?.label as string) || foundNode.id;
      setHoveredAutocompletePodName(targetLabel);

      setTimeout(() => {
        const currentHovered = useFlowStore.getState().hoveredAutocompletePodName;
        if (currentHovered === targetLabel) {
          setHoveredAutocompletePodName(null);
        }
      }, 3000);
    }
  } else {
    addActivityLog(`Error from server (NotFound): ${typeRaw} "${targetName}" not found`);
  }
  return true;
};
