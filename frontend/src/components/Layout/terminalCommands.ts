import { Node } from '@xyflow/react';
import { syncDeployment } from '../../store/nodeHelpers';

export interface CommandContext {
  nodes: Node[];
  isSimulating: boolean;
  updateNodeData: (id: string, data: any) => void;
  addActivityLog: (line: string) => void;
  deleteNodes: (nodes: Node[]) => void;
  getStoreState: () => any;
  setStoreState: (state: any) => void;
}

export const handleScaleCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+scale\s+(deploy(?:ment)?)\/([a-z0-9-]+)\s+--replicas=(\d+)/i.exec(cmd);
  if (!match) return false;

  const targetName = match[2].toLowerCase();
  const replicasNum = Number.parseInt(match[3], 10);

  const foundNode = ctx.nodes.find(n =>
    n.type === 'Deployment' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

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

  const foundNode = ctx.nodes.find(n =>
    n.type === 'Deployment' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

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
  const foundNode = ctx.nodes.find(n =>
    n.type === 'Deployment' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

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
  const foundNode = ctx.nodes.find(n =>
    n.type === 'Deployment' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

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
  const foundNode = ctx.nodes.find(n =>
    n.type === 'Deployment' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

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
  const foundNode = ctx.nodes.find(n =>
    n.type === 'Pod' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

  if (foundNode) {
    ctx.addActivityLog(`pod "${foundNode.data.label || foundNode.id}" deleted`);

    if (foundNode.parentId) {
      const parent = ctx.nodes.find(n => n.id === foundNode.parentId);
      if (parent && (parent.type === 'Deployment' || parent.type === 'ReplicaSet')) {
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
    const status = p.data.status || (ctx.isSimulating ? 'Running' : 'Pending');
    const ready = status === 'ready' || status === 'Running' ? '1/1' : '0/1';
    let displayStatus = status;
    if (status === 'ready') {
      displayStatus = 'Running';
    } else if (status === 'pending') {
      displayStatus = 'Pending';
    }
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
  if (hpas.length > 0) {
    ctx.addActivityLog(`\n${"NAME".padEnd(38)} REFERENCE               TARGETS         MINPODS   MAXPODS   REPLICAS   AGE`);
    hpas.forEach(h => {
      const name = h.data.label || h.id;
      ctx.addActivityLog(`horizontalpodautoscaler.autoscaling/${String(name).padEnd(2)} Deployment/api-dep     12%/50%         ${h.data.minReplicas || 1}         ${h.data.maxReplicas || 10}        3          5m`);
    });
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
  const foundNode = ctx.nodes.find(n =>
    n.type === 'Deployment' &&
    (n.id.toLowerCase() === targetName || (n.data.label && String(n.data.label).toLowerCase() === targetName))
  );

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
