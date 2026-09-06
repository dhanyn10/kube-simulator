import { Node } from '@xyflow/react';
import { syncDeployment } from '../../store/nodeHelpers';
import { extractAttachedResources, findNodeByTargetName, getPodDisplayStatus } from './terminalLogUtils';

export interface CommandContext {
  nodes: Node[];
  isSimulating: boolean;
  updateNodeData: (id: string, data: any) => void;
  addActivityLog: (line: string) => void;
  deleteNodes: (nodes: Node[]) => void;
  getStoreState: () => any;
  setStoreState: (state: any) => void;
}

const processAdminPasswordEntry = (cmd: string, ctx: CommandContext): boolean => {
  const enteredPassword = cmd.trim();
  const validPasswords = ['kubesim123', 'admin', 'admin123'];
  if (validPasswords.includes(enteredPassword)) {
    ctx.addActivityLog(`[Secret Mode Unlocked!] Admin privileges authenticated.`);
    ctx.addActivityLog(`Type "help" to view all available commands including secret CLI tools.`);
    ctx.setStoreState({ isAdminAuthenticated: true, isAwaitingAdminPassword: false });
  } else {
    ctx.addActivityLog(`[Access Denied] Incorrect password.`);
    ctx.setStoreState({ isAwaitingAdminPassword: false });
  }
  return true;
};

export const handleGetSecretsCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+get\s+(secrets?)\b/i.exec(cmd.trim());
  if (!match) return false;

  const attached = extractAttachedResources<any>(ctx.nodes, 'secrets');
  if (attached.length === 0) {
    ctx.addActivityLog('No secrets found on the canvas.');
    return true;
  }

  ctx.addActivityLog(`${"NAME".padEnd(30)} TYPE                      DATA   ATTACHED TO           CREATED AT`);
  attached.forEach(({ item: s, ownerLabel }) => {
    const dataCount = Array.isArray(s.secretData) ? s.secretData.length : 0;
    const type = s.type || 'Opaque';
    ctx.addActivityLog(`${String(s.name).padEnd(30)} ${String(type).padEnd(25)} ${String(dataCount).padEnd(6)} ${String(ownerLabel).padEnd(21)} 2m ago`);
  });
  return true;
};

export const handleDescribeSecretCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+describe\s+(secrets?)\s+([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  let foundSecret: { name: string; type: string; owner: string; secretData: any[] } | null = null;

  ctx.nodes.forEach((n) => {
    if (Array.isArray(n.data?.secrets)) {
      n.data.secrets.forEach((s: any) => {
        if (s.name.toLowerCase() === targetName || s.id?.toLowerCase() === targetName) {
          foundSecret = { name: s.name, type: s.type || 'Opaque', owner: n.data?.label || n.id, secretData: s.secretData || [] };
        }
      });
    }
  });

  if (foundSecret) {
    const sec = foundSecret as { name: string; type: string; owner: string; secretData: any[] };
    ctx.addActivityLog(`Name:         ${sec.name}`);
    ctx.addActivityLog(`Namespace:    default`);
    ctx.addActivityLog(`Type:         ${sec.type}`);
    ctx.addActivityLog(`Attached To:  ${sec.owner}`);
    ctx.addActivityLog(`Data`);
    ctx.addActivityLog(`====`);
    if (sec.secretData.length === 0) {
      ctx.addActivityLog(`<none>`);
    } else {
      sec.secretData.forEach((kv: any) => {
        const valSizeStr = kv.value ? `${kv.value.length} bytes` : '0 bytes';
        ctx.addActivityLog(`${kv.key}: ${valSizeStr}`);
      });
    }
  } else {
    ctx.addActivityLog(`Error from server (NotFound): secret "${targetName}" not found`);
  }
  return true;
};

export const handleGetConfigMapsCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+get\s+(configmaps?|cm)\b/i.exec(cmd.trim());
  if (!match) return false;

  const attached = extractAttachedResources<any>(ctx.nodes, 'configMaps');
  if (attached.length === 0) {
    ctx.addActivityLog('No configmaps found on the canvas.');
    return true;
  }

  ctx.addActivityLog(`${"NAME".padEnd(30)} DATA   ATTACHED TO           CREATED AT`);
  attached.forEach(({ item: cm, ownerLabel }) => {
    const dataCount = Array.isArray(cm.configData) ? cm.configData.length : 0;
    ctx.addActivityLog(`${String(cm.name).padEnd(30)} ${String(dataCount).padEnd(6)} ${String(ownerLabel).padEnd(21)} 2m ago`);
  });
  return true;
};

export const handleDescribeConfigMapCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+describe\s+(configmaps?|cm)\s+([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  let foundCM: { name: string; owner: string; configData: any[] } | null = null;

  ctx.nodes.forEach((n) => {
    if (Array.isArray(n.data?.configMaps)) {
      n.data.configMaps.forEach((cm: any) => {
        if (cm.name.toLowerCase() === targetName || cm.id?.toLowerCase() === targetName) {
          foundCM = { name: cm.name, owner: n.data?.label || n.id, configData: cm.configData || [] };
        }
      });
    }
  });

  if (foundCM) {
    const cm = foundCM as { name: string; owner: string; configData: any[] };
    ctx.addActivityLog(`Name:         ${cm.name}`);
    ctx.addActivityLog(`Namespace:    default`);
    ctx.addActivityLog(`Attached To:  ${cm.owner}`);
    ctx.addActivityLog(`Data`);
    ctx.addActivityLog(`====`);
    if (cm.configData.length === 0) {
      ctx.addActivityLog(`<none>`);
    } else {
      cm.configData.forEach((kv: any) => {
        ctx.addActivityLog(`${kv.key}:`);
        ctx.addActivityLog(`----`);
        ctx.addActivityLog(`${kv.value}`);
      });
    }
  } else {
    ctx.addActivityLog(`Error from server (NotFound): configmap "${targetName}" not found`);
  }
  return true;
};

const compareVersions = (v1: string, v2: string): number => {
  const clean1 = v1.replace(/^v/i, '').split('-');
  const clean2 = v2.replace(/^v/i, '').split('-');
  const p1 = clean1[0].split('.').map(n => Number.parseInt(n, 10) || 0);
  const p2 = clean2[0].split('.').map(n => Number.parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const val1 = p1[i] || 0;
    const val2 = p2[i] || 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
};

const processVersionUpdateCmd = (parts: string[], store: any, ctx: CommandContext): boolean => {
  const targetVersion = (parts[3] || '0.5.0').replace(/^v/i, '');
  const currentVersion = store.simulatedCurrentVersion || '0.4.0';

  if (compareVersions(targetVersion, currentVersion) <= 0) {
    ctx.addActivityLog(`[Dev-Mode Warning] Target update version (v${targetVersion}) cannot be equal or lower than current version (v${currentVersion}). Please reinstall application if you need to use previous version.`);
    ctx.addActivityLog(`Update simulation cancelled.`);
    return true;
  }

  const releaseUrl = 'https://github.com/dhanyn10/kube-simulator/releases';
  store.setSimulatedUpdateInfo({ latestVersion: targetVersion, releaseUrl });
  ctx.addActivityLog(`[Dev-Mode Activated] Simulated New Version v${targetVersion} Available!`);
  ctx.addActivityLog(`Check the top-right MenuBar for the new Update button.`);
  return true;
};

const processVersionCurrentCmd = (parts: string[], store: any, ctx: CommandContext): boolean => {
  const targetVersion = parts[3]?.replace(/^v/i, '') || null;
  const currentAssumed = store.simulatedCurrentVersion || '0.4.0';

  if (!targetVersion) {
    ctx.addActivityLog(`[Dev-Mode Status] Current assumed version: v${currentAssumed}`);
    return true;
  }

  const updateInfo = store.simulatedUpdateInfo;
  if (updateInfo && compareVersions(updateInfo.latestVersion, targetVersion) <= 0) {
    store.setSimulatedUpdateInfo(null);
  }

  store.setSimulatedCurrentVersion(targetVersion);
  ctx.addActivityLog(`[Dev-Mode Activated] Current version set to v${targetVersion}.`);
  return true;
};

const processAdminCommands = (cmd: string, cmdLower: string, ctx: CommandContext): boolean => {
  const store = ctx.getStoreState();
  const parts = cmd.trim().split(/\s+/);

  if (cmdLower === 'try version update' || cmdLower.startsWith('try version update ')) {
    return processVersionUpdateCmd(parts, store, ctx);
  }

  if (cmdLower === 'try version current' || cmdLower.startsWith('try version current ')) {
    return processVersionCurrentCmd(parts, store, ctx);
  }

  if (cmdLower === 'try version clear') {
    store.setSimulatedCurrentVersion(null);
    ctx.addActivityLog(`[Dev-Mode Deactivated] Cleared simulated current version.`);
    return true;
  }

  if (['try clear', 'try update clear', 'noupdate'].includes(cmdLower)) {
    store.setSimulatedUpdateInfo(null);
    store.setSimulatedCurrentVersion(null);
    ctx.addActivityLog(`[Dev-Mode Deactivated] Cleared all simulated version settings.`);
    return true;
  }

  if (cmdLower === 'try status') {
    const updateInfo = store.simulatedUpdateInfo;
    const currentVer = store.simulatedCurrentVersion || '0.4.0';
    const updateText = updateInfo ? 'v' + updateInfo.latestVersion : 'None';
    ctx.addActivityLog(`[Dev-Mode Status] Authenticated: true | Current Version: v${currentVer} | Simulated Update: ${updateText}`);
    return true;
  }

  ctx.addActivityLog(`Unknown command. Available admin commands: try version update <version>, try version current <version>, try version clear, try clear, try status, exit/logout`);
  return true;
};

export const handleAdminCommands = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const store = ctx.getStoreState();
  const isAdminAuth = store.isAdminAuthenticated;

  if (store.isAwaitingAdminPassword) {
    return processAdminPasswordEntry(cmd, ctx);
  }

  const cmdLower = cmd.trim().toLowerCase();

  if (cmdLower === 'kubesim admin') {
    if (isAdminAuth) {
      ctx.addActivityLog(`[Admin] Already authenticated in admin mode.`);
    } else {
      ctx.addActivityLog(`[Admin Authentication] Please enter admin password:`);
      ctx.setStoreState({ isAwaitingAdminPassword: true });
    }
    return true;
  }

  if (['exit', 'logout', 'admin logout'].includes(cmdLower) && isAdminAuth) {
    ctx.setStoreState({ isAdminAuthenticated: false });
    ctx.addActivityLog(`[Admin Session Closed] Logged out from admin mode. Returned to standard Kubernetes CLI mode.`);
    return true;
  }

  if (cmdLower.startsWith('try ')) {
    if (!isAdminAuth) {
      ctx.addActivityLog(`[Warning] Admin mode is inactive. Standard Kubernetes CLI tools cannot execute try commands.`);
      ctx.addActivityLog(`Please authenticate first via "kubesim admin".`);
      return true;
    }
    return processAdminCommands(cmd, cmdLower, ctx);
  }

  if (isAdminAuth) {
    ctx.addActivityLog(`[Warning] You are currently in Admin Mode. Standard Kubernetes user commands are disabled.`);
    ctx.addActivityLog(`Type "logout" or "exit" to leave Admin Mode and return to standard CLI.`);
    return true;
  }

  return false;
};

export const handleScaleCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+scale\s+(deploy(?:ment)?)\/([a-z0-9-]+)\s+--replicas=(\d+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const replicasNum = Number.parseInt(match[3], 10);

  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Deployment');

  if (foundNode) {
    const prevReplicas = foundNode.data.replicas || 0;
    ctx.updateNodeData(foundNode.id, { replicas: replicasNum });
    ctx.addActivityLog(`deployment.apps/${foundNode.data.label || foundNode.id} scaled`);
    ctx.addActivityLog(`[scale] Scaling replicas from ${prevReplicas} to ${replicasNum}...`);
  } else {
    ctx.addActivityLog(`Error from server (NotFound): deployment "${targetName}" not found`);
  }
  return true;
};

export const handleSetImageCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+set\s+image\s+(deploy(?:ment)?)\/([a-z0-9-]+)\s+(?:([a-z0-9-]+)=)?([a-z0-9./:]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const targetImage = match[4];

  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Deployment');

  if (foundNode) {
    const currentImage = foundNode.data.image || 'nginx:latest';
    const revisions = foundNode.data.rolloutRevisions || [currentImage];
    const newRevisions = [...revisions, targetImage];

    ctx.updateNodeData(foundNode.id, {
      rolloutTargetImage: targetImage,
      originalImage: currentImage,
      isRollingUpdate: true,
      rolloutStatus: `Updating 0/${foundNode.data.replicas || 1} replicas...`,
      rolloutRevisions: newRevisions,
    });

    ctx.addActivityLog(`deployment.apps/${foundNode.data.label || foundNode.id} image updated`);
    ctx.addActivityLog(`[rollout] Rolling update initiated: replacing ${currentImage} with ${targetImage}`);
  } else {
    ctx.addActivityLog(`Error from server (NotFound): deployment "${targetName}" not found`);
  }
  return true;
};

export const handleRolloutStatusCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+rollout\s+status\s+(deploy(?:ment)?)\/([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Deployment');

  if (foundNode) {
    if (foundNode.data.isRollingUpdate) {
      ctx.addActivityLog(`Waiting for deployment "${foundNode.data.label || foundNode.id}" rollout to finish: ${foundNode.data.rolloutStatus || 'Updating replicas...'}`);
    } else {
      ctx.addActivityLog(`deployment "${foundNode.data.label || foundNode.id}" successfully rolled out`);
    }
  } else {
    ctx.addActivityLog(`Error from server (NotFound): deployment "${targetName}" not found`);
  }
  return true;
};

export const handleRolloutHistoryCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+rollout\s+history\s+(deploy(?:ment)?)\/([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Deployment');

  if (foundNode) {
    const revisions = foundNode.data.rolloutRevisions || [foundNode.data.image || 'nginx:latest'];
    ctx.addActivityLog(`REVISION  CHANGE-CAUSE`);
    revisions.forEach((rev: string, index: number) => {
      ctx.addActivityLog(`${index + 1}         kubectl set image deployment/${foundNode.data.label || foundNode.id} to ${rev}`);
    });
  } else {
    ctx.addActivityLog(`Error from server (NotFound): deployment "${targetName}" not found`);
  }
  return true;
};

export const handleRolloutUndoCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+rollout\s+undo\s+(deploy(?:ment)?)\/([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Deployment');

  if (foundNode) {
    const revisions = foundNode.data.rolloutRevisions || [];
    if (revisions.length < 2) {
      ctx.addActivityLog(`[rollout] No previous revision found to rollback.`);
      return true;
    }
    const previousImage = revisions[revisions.length - 2];
    const newRevisions = [...revisions, previousImage];

    ctx.updateNodeData(foundNode.id, {
      rolloutTargetImage: previousImage,
      originalImage: foundNode.data.image,
      isRollingUpdate: true,
      rolloutStatus: `Updating 0/${foundNode.data.replicas || 1} replicas...`,
      rolloutRevisions: newRevisions,
    });

    ctx.addActivityLog(`deployment.apps/${foundNode.data.label || foundNode.id} rolled back to revision ${revisions.length - 1} (${previousImage})`);
  } else {
    ctx.addActivityLog(`Error from server (NotFound): deployment "${targetName}" not found`);
  }
  return true;
};

export const handleDeletePodCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+delete\s+(pod|pods)\s+([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Pod');

  if (foundNode) {
    ctx.addActivityLog(`pod "${foundNode.data.label || foundNode.id}" deleted`);

    if (foundNode.parentId) {
      const parent = ctx.nodes.find(n => n.id === foundNode.parentId);
      if (parent?.type === 'Deployment' || parent?.type === 'ReplicaSet') {
        ctx.addActivityLog(`[self-healing] ReplicaSet controller detected 1 terminated pod!`);
        ctx.addActivityLog(`[self-healing] Creating a new replacement pod automatically to satisfy desired replicas...`);

        const filteredNodes = ctx.nodes.filter(n => n.id !== foundNode.id);
        const store = ctx.getStoreState();
        const { updatedDeployment, laidOut } = syncDeployment(parent, filteredNodes, 0, () => store);

        const syncedLaidOut = laidOut.map(p => {
          const isNew = !filteredNodes.some(fn => fn.id === p.id);
          if (isNew) {
            return {
              ...p,
              data: {
                ...p.data,
                status: 'pending',
                pendingTicks: 0,
              }
            };
          }
          return p;
        });

        const finalNodes = [
          ...filteredNodes.filter(n => n.id !== parent.id && n.parentId !== parent.id),
          updatedDeployment,
          ...syncedLaidOut
        ];

        ctx.setStoreState({ nodes: finalNodes });
      } else {
        ctx.deleteNodes([foundNode]);
      }
    } else {
      ctx.deleteNodes([foundNode]);
    }
  } else {
    ctx.addActivityLog(`Error from server (NotFound): pod "${targetName}" not found`);
  }
  return true;
};

export const handleGetAllCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+get\s+all$/i.exec(cmd.trim());
  if (!match) return false;

  ctx.addActivityLog(`${"NAME".padEnd(38)} READY   STATUS              RESTARTS   AGE`);

  const pods = ctx.nodes.filter(n => n.type === 'Pod');
  pods.forEach(p => {
    const name = p.data.label || p.id;
    const { ready, displayStatus } = getPodDisplayStatus(p.data.status, ctx.isSimulating);
    ctx.addActivityLog(`pod/${String(name).padEnd(34)} ${ready.padEnd(7)} ${displayStatus.padEnd(19)} 0          1m`);
  });

  const deploys = ctx.nodes.filter(n => n.type === 'Deployment');
  if (deploys.length > 0) {
    ctx.addActivityLog(`\n${"NAME".padEnd(38)} READY   UP-TO-DATE   AVAILABLE   AGE`);
    deploys.forEach(d => {
      const name = d.data.label || d.id;
      const replicas = d.data.replicas || 1;
      const status = ctx.isSimulating ? `${replicas}/${replicas}` : `0/${replicas}`;
      ctx.addActivityLog(`deployment.apps/${String(name).padEnd(22)} ${status.padEnd(7)} ${String(replicas).padEnd(12)} ${String(ctx.isSimulating ? replicas : 0).padEnd(11)} 2m`);
    });
  }

  const svcs = ctx.nodes.filter(n => n.type === 'Service');
  if (svcs.length > 0) {
    ctx.addActivityLog(`\n${"NAME".padEnd(38)} TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)      AGE`);
    svcs.forEach(s => {
      const name = s.data.label || s.id;
      const port = s.data.port || 80;
      ctx.addActivityLog(`service/${String(name).padEnd(30)} ClusterIP   10.96.4.52   <none>        ${port}/TCP   3m`);
    });
  }

  const ingresses = ctx.nodes.filter(n => n.type === 'Ingress');
  if (ingresses.length > 0) {
    ctx.addActivityLog(`\n${"NAME".padEnd(38)} CLASS    HOSTS           ADDRESS   PORTS   AGE`);
    ingresses.forEach(i => {
      const name = i.data.label || i.id;
      const host = i.data.ingressHost || 'example.local';
      ctx.addActivityLog(`ingress.networking.k8s.io/${String(name).padEnd(12)} nginx    ${host.padEnd(15)}           80      4m`);
    });
  }

  const hpas = ctx.nodes.filter(n => n.type === 'HPA');
  const attachedHpas: { name: string; owner: string; min: number; max: number }[] = [];
  ctx.nodes.forEach(n => {
    if (Array.isArray(n.data?.hpas)) {
      n.data.hpas.forEach((h: any) => {
        attachedHpas.push({
          name: h.name,
          owner: n.data?.label || n.id,
          min: h.minReplicas || 1,
          max: h.maxReplicas || 10,
        });
      });
    }
  });

  if (hpas.length > 0 || attachedHpas.length > 0) {
    ctx.addActivityLog(`\n${"NAME".padEnd(38)} REFERENCE               TARGETS         MINPODS   MAXPODS   REPLICAS   AGE`);
    hpas.forEach(h => {
      const name = h.data.label || h.id;
      ctx.addActivityLog(`horizontalpodautoscaler.autoscaling/${String(name).padEnd(2)} Deployment/api-dep     12%/50%         ${h.data.minReplicas || 1}         ${h.data.maxReplicas || 10}        3          5m`);
    });
    attachedHpas.forEach(ah => {
      ctx.addActivityLog(`horizontalpodautoscaler.autoscaling/${String(ah.name).padEnd(2)} Deployment/${ah.owner.padEnd(10)} 12%/50%         ${ah.min}         ${ah.max}        3          5m`);
    });
  }

  return true;
};

export const handleGetRolesCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+get\s+(roles?|rolebindings?)\b/i.exec(cmd.trim());
  if (!match) return false;

  const attached = extractAttachedResources<any>(ctx.nodes, 'roles');
  const allRoles = attached.map(({ item: r, ownerLabel }) => ({
    name: r.name,
    assignedUser: r.assignedUser || 'admin-user',
    accessLevel: r.accessLevel || 'Full',
    owner: ownerLabel,
    rules: r.rules || [],
  }));

  const resType = match[1].toLowerCase();
  if (resType.startsWith('rolebinding')) {
    if (allRoles.length === 0) {
      ctx.addActivityLog('No rolebindings found on the canvas.');
      return true;
    }
    ctx.addActivityLog(`${"NAME".padEnd(30)} ROLE                  SUBJECT (IAM USER)    AGE`);
    allRoles.forEach((r) => {
      const bindingName = r.name + '-binding';
      ctx.addActivityLog(`${String(bindingName).padEnd(30)} ${String(r.name).padEnd(21)} User/${r.assignedUser.padEnd(20)} 2m`);
    });
    return true;
  }

  if (allRoles.length === 0) {
    ctx.addActivityLog('No roles found on the canvas.');
    return true;
  }
  ctx.addActivityLog(`${"NAME".padEnd(30)} ASSIGNED IAM USER    ACCESS LEVEL   ATTACHED TO           CREATED AT`);
  allRoles.forEach((r) => {
    ctx.addActivityLog(`${String(r.name).padEnd(30)} ${String(r.assignedUser).padEnd(20)} ${String(r.accessLevel).padEnd(14)} ${String(r.owner).padEnd(21)} 2m ago`);
  });
  return true;
};

export const handleDescribeRoleCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+describe\s+(roles?|rolebinding)\s+([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  let foundRole: { name: string; assignedUser: string; accessLevel: string; owner: string; rules: any[] } | null = null;

  ctx.nodes.forEach((n) => {
    if (Array.isArray(n.data?.roles)) {
      n.data.roles.forEach((r: any) => {
        if (r.name.toLowerCase() === targetName || r.id?.toLowerCase() === targetName) {
          foundRole = {
            name: r.name,
            assignedUser: r.assignedUser || 'admin-user',
            accessLevel: r.accessLevel || 'Full',
            owner: n.data?.label || n.id,
            rules: r.rules || [],
          };
        }
      });
    }
  });

  if (foundRole) {
    const role = foundRole as { name: string; assignedUser: string; accessLevel: string; owner: string; rules: any[] };
    ctx.addActivityLog(`Name:         ${role.name}`);
    ctx.addActivityLog(`Namespace:    default`);
    ctx.addActivityLog(`Assigned User:${role.assignedUser} (IAM User)`);
    ctx.addActivityLog(`Access Level: ${role.accessLevel}`);
    ctx.addActivityLog(`Attached To:  ${role.owner}`);
    ctx.addActivityLog(`PolicyRule:`);
    ctx.addActivityLog(`  Resources  Group  Verbs`);
    ctx.addActivityLog(`  ---------  -----  -----`);
    role.rules.forEach((rule: any) => {
      const res = (rule.resources || []).join(', ');
      const grp = (rule.apiGroups || ['']).join(', ') || '""';
      const vrb = (rule.verbs || []).join(', ');
      ctx.addActivityLog(`  ${res.padEnd(10)} ${grp.padEnd(6)} [${vrb}]`);
    });
  } else {
    ctx.addActivityLog(`Error from server (NotFound): role "${targetName}" not found`);
  }
  return true;
};

export const handleDescribeDeploymentCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+describe\s+(deploy(?:ment)?)\s+([a-z0-9-]+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const foundNode = findNodeByTargetName(ctx.nodes, targetName, 'Deployment');

  if (foundNode) {
    const name = foundNode.data.label || foundNode.id;
    const replicas = foundNode.data.replicas || 1;
    const image = foundNode.data.image || 'nginx:latest';
    const cpu = foundNode.data.cpuLimit || '500m';
    const memory = foundNode.data.memoryLimit || '256Mi';

    ctx.addActivityLog(`Name:                   ${name}`);
    ctx.addActivityLog(`Namespace:              default`);
    ctx.addActivityLog(`CreationTimestamp:      Mon, 01 Jan 2026 00:00:00 +0000`);
    ctx.addActivityLog(`Labels:                 app=${name}`);
    ctx.addActivityLog(`Selector:               app=${name}`);
    ctx.addActivityLog(`Replicas:               ${replicas} desired | ${replicas} updated | ${replicas} total | ${ctx.isSimulating ? replicas : 0} available`);
    ctx.addActivityLog(`StrategyType:           RollingUpdate`);
    ctx.addActivityLog(`RollingUpdateStrategy:  25% max unavailable, 25% max surge`);
    ctx.addActivityLog(`Pod Template:`);
    ctx.addActivityLog(`  Labels:  app=${name}`);
    ctx.addActivityLog(`  Containers:`);
    ctx.addActivityLog(`   app-container:`);
    ctx.addActivityLog(`    Image:        ${image}`);
    ctx.addActivityLog(`    Limits:`);
    ctx.addActivityLog(`      cpu:        ${cpu}`);
    ctx.addActivityLog(`      memory:     ${memory}`);
    ctx.addActivityLog(`Events:`);
    ctx.addActivityLog(`  Type    Reason             Age   From                   Message`);
    ctx.addActivityLog(`  ----    ------             ----  ----                   -------`);
    ctx.addActivityLog(`  Normal  ScalingReplicaSet  2m    deployment-controller  Scaled up replica set ${name}-7b64 to ${replicas}`);
  } else {
    ctx.addActivityLog(`Error from server (NotFound): deployment "${targetName}" not found`);
  }
  return true;
};
