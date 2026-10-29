import React, { useEffect } from 'react';
import { GetSystemResources } from '@wailsjs/go/main/App.js';
import { EventsOn } from '@wailsjs/runtime';
import { useFlowStore } from '@/store';
import { K8sRoleItem, K8sConfigMapItem, K8sSecretItem, K8sHpaItem, K8sResourceLimitItem } from '@/types';
import { logger } from '@/lib/logger';
import { persistConfigMapItem } from '@/activities/modals/configMapStorageHelpers';
import { persistSecretItem } from '@/activities/modals/secretStorageHelpers';
import { getActiveProfileName } from '@/store/useFlowStore';
import { extractPodBaseName } from '@/activities/nodes/useBaseNode';
import {
  emitLiveRoleCommand,
  emitLiveSecretCommand,
  emitLiveConfigMapCommand,
  emitLiveHpaCommand,
} from '@/activities/terminal/liveUpdateCommands';

export function useAppInit(
  isDetachedMode: boolean,
  loadSettingsJson: () => void,
  setGlobalEdgeColors: any,
  setSystemResources: any,
  setIsAboutDialogOpen: (open: boolean) => void
) {
  useEffect(() => {
    if (isDetachedMode) return;
    loadSettingsJson();

    if (globalThis.go?.main?.App?.GetSetting !== undefined) {
      void Promise.all([
        globalThis.go.main.App.GetSetting('globalEdgeColor'),
        globalThis.go.main.App.GetSetting('globalEdgeErrorColor'),
      ]).then(([color, errorColor]: [string, string]) => {
        if (color !== '' || errorColor !== '') {
          setGlobalEdgeColors(
            color || 'var(--color-mat-indigo)',
            errorColor || 'var(--color-mat-red)'
          );
        }
      });
    }

    const fetchResources = () => {
      if (globalThis.window?.go?.main?.App?.GetSystemResources !== undefined) {
        void GetSystemResources()
          .then((resources: any) => {
            if (resources) setSystemResources(resources);
          })
          .catch((err) => {
            if (!String(err).includes('not registered')) {
              logger.error('[App] Failed to fetch system resources:', err);
            }
          });
      }
    };

    fetchResources();
    const interval = setInterval(fetchResources, 1000);
    return () => clearInterval(interval);
  }, [isDetachedMode, loadSettingsJson, setGlobalEdgeColors, setSystemResources]);

  useEffect(() => {
    const unsubscribe = EventsOn('openAboutDialog', () => {
      setIsAboutDialogOpen(true);
    });
    return () => {
      unsubscribe();
    };
  }, [setIsAboutDialogOpen]);
}

function matchesAttachedName(name: string, targetLabel: string, target: any): boolean {
  if (name === targetLabel || name === target.id) return true;
  if (target.type === 'Pod' && target.data?.podHash) {
    const baseName = target.data.baseName || extractPodBaseName(target.data);
    const groupLabel = `${baseName}-${target.data.podHash}`;
    return name === groupLabel || targetLabel.startsWith(`${name}-`);
  }
  return false;
}

export function isNodeAttachedToConfigMap(
  target: any,
  targetNodeModal: { id: string; label?: string; initialViewMode?: string } | null,
  resourceName?: string
): boolean {
  if (!target || targetNodeModal?.id === 'cluster-storage') return false;
  if (typeof resourceName === 'string') {
    const targetLabel = (target.data?.label as string) || target.id || targetNodeModal.label;
    const attachedNames = resourceName.split(',').map((s) => s.trim()).filter(Boolean);
    return attachedNames.some((name) => matchesAttachedName(name, targetLabel, target));
  }
  return targetNodeModal?.initialViewMode !== 'list';
}

export function createEnrichedConfigMapItem(
  cmItem: K8sConfigMapItem,
  target: any,
  isTargetAttached: boolean,
  activeProfileName: string,
  targetLabel: string
): K8sConfigMapItem {
  const profileName = cmItem.profileName || activeProfileName;
  if (!isTargetAttached) {
    return {
      ...cmItem,
      profileName,
      resourceName: undefined,
      resourceType: undefined,
    };
  }
  return {
    ...cmItem,
    profileName,
    resourceName: cmItem.resourceName || targetLabel,
    resourceType: cmItem.resourceType || target?.type || 'Resource',
  };
}

export function attachConfigMapToNode(
  target: any,
  cmItem: K8sConfigMapItem,
  enrichedCmItem: K8sConfigMapItem,
  targetLabel: string,
  updateNodeData: (id: string, data: any) => void
) {
  const existingCMs = target.data?.configMaps || [];
  const existingIndex = existingCMs.findIndex(
    (c: K8sConfigMapItem) => c.id === cmItem.id || Boolean(cmItem.name && c.name === cmItem.name)
  );

  let updatedCMs: K8sConfigMapItem[];
  if (existingIndex >= 0) {
    updatedCMs = [...existingCMs];
    updatedCMs[existingIndex] = enrichedCmItem;
  } else {
    updatedCMs = [...existingCMs, enrichedCmItem];
  }

  updateNodeData(target.id, { configMaps: updatedCMs });
  useFlowStore.getState().addLog('info', `[ConfigMap Attached] Attached ConfigMap "${cmItem.name}" to card ${targetLabel}`, 'UI');

  useFlowStore.setState({
    configuringNodeId: target.id,
    configuringEdgeId: null,
    isRightSidebarVisible: true,
    isHistoryViewOpen: false,
  });

  emitLiveConfigMapCommand(cmItem.name, targetLabel);
}

export function detachConfigMapFromNode(
  target: any,
  cmItem: K8sConfigMapItem,
  targetLabel: string,
  updateNodeData: (id: string, data: any) => void
) {
  if (!target) return;
  const existingCMs = target.data?.configMaps || [];
  const filteredCMs = existingCMs.filter(
    (c: K8sConfigMapItem) => c.id !== cmItem.id && c.name !== cmItem.name
  );
  if (filteredCMs.length !== existingCMs.length) {
    updateNodeData(target.id, { configMaps: filteredCMs });
    useFlowStore.getState().addLog(
      'info',
      `[ConfigMap Removed] Removed ConfigMap "${cmItem.name}" from card ${targetLabel}`,
      'UI'
    );
  }
}
export function createEnrichedSecretItem(
  secretItem: K8sSecretItem,
  target: any,
  isTargetAttached: boolean,
  activeProfileName: string,
  targetLabel: string
): K8sSecretItem {
  const profileName = secretItem.profileName || activeProfileName;
  if (!isTargetAttached) {
    return {
      ...secretItem,
      profileName,
      resourceName: undefined,
      resourceType: undefined,
    };
  }
  return {
    ...secretItem,
    profileName,
    resourceName: secretItem.resourceName || targetLabel,
    resourceType: secretItem.resourceType || target?.type || 'Resource',
  };
}

export function attachSecretToNode(
  target: any,
  secretItem: K8sSecretItem,
  enrichedSecretItem: K8sSecretItem,
  targetLabel: string,
  updateNodeData: (id: string, data: any) => void
) {
  const existingSecrets = target.data?.secrets || [];
  const existingIndex = existingSecrets.findIndex(
    (s: K8sSecretItem) => s.id === secretItem.id || Boolean(secretItem.name && s.name === secretItem.name)
  );

  let updatedSecrets: K8sSecretItem[];
  if (existingIndex >= 0) {
    updatedSecrets = [...existingSecrets];
    updatedSecrets[existingIndex] = enrichedSecretItem;
  } else {
    updatedSecrets = [...existingSecrets, enrichedSecretItem];
  }

  updateNodeData(target.id, { secrets: updatedSecrets });
  useFlowStore.getState().addLog('info', `[Secret Attached] Attached Secret "${secretItem.name}" to card ${targetLabel}`, 'UI');

  useFlowStore.setState({
    configuringNodeId: target.id,
    configuringEdgeId: null,
    isRightSidebarVisible: true,
    isHistoryViewOpen: false,
  });

  emitLiveSecretCommand(secretItem.name, secretItem.type || 'Opaque', targetLabel);
}

export function detachSecretFromNode(
  target: any,
  secretItem: K8sSecretItem,
  targetLabel: string,
  updateNodeData: (id: string, data: any) => void
) {
  if (!target) return;
  const existingSecrets = target.data?.secrets || [];
  const filteredSecrets = existingSecrets.filter(
    (s: K8sSecretItem) => s.id !== secretItem.id && (!secretItem.name || s.name !== secretItem.name)
  );
  if (filteredSecrets.length !== existingSecrets.length) {
    updateNodeData(target.id, { secrets: filteredSecrets });
    useFlowStore.getState().addLog(
      'info',
      `[Secret Detached] Detached Secret "${secretItem.name}" from card ${targetLabel}`,
      'UI'
    );
  }
}


export function useAttachmentHandlers() {
  const nodes = useFlowStore((state) => state.nodes);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const roleModalTargetNode = useFlowStore((state) => state.roleModalTargetNode);
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const configMapModalTargetNode = useFlowStore((state) => state.configMapModalTargetNode);
  const setConfigMapModalTargetNode = useFlowStore((state) => state.setConfigMapModalTargetNode);
  const secretModalTargetNode = useFlowStore((state) => state.secretModalTargetNode);
  const setSecretModalTargetNode = useFlowStore((state) => state.setSecretModalTargetNode);
  const hpaModalTargetNode = useFlowStore((state) => state.hpaModalTargetNode);
  const setHpaModalTargetNode = useFlowStore((state) => state.setHpaModalTargetNode);
  const resourceLimitModalTargetNode = useFlowStore((state) => state.resourceLimitModalTargetNode);
  const setResourceLimitModalTargetNode = useFlowStore((state) => state.setResourceLimitModalTargetNode);

  const handleRoleSave = (roleItem: K8sRoleItem) => {
    if (!roleModalTargetNode) return;
    const target = nodes.find((n) => n.id === roleModalTargetNode.id);
    if (!target) return;

    const existingRoles = target.data.roles || [];
    const existingIndex = existingRoles.findIndex((r: K8sRoleItem) => r.id === roleItem.id);
    let updatedRoles: K8sRoleItem[];

    if (existingIndex >= 0) {
      updatedRoles = [...existingRoles];
      updatedRoles[existingIndex] = roleItem;
    } else {
      updatedRoles = [...existingRoles, roleItem];
    }

    updateNodeData(target.id, { roles: updatedRoles });
    useFlowStore.getState().addLog('info', `[Role Attached] Attached role "${roleItem.name}" to card ${roleModalTargetNode.label}`, 'UI');
    setRoleModalTargetNode(null);

    useFlowStore.setState({
      configuringNodeId: target.id,
      configuringEdgeId: null,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
    });

    // Auto-emit live kubectl command
    emitLiveRoleCommand(roleItem.name, roleModalTargetNode.label);
  };

  const handleSecretSave = (secretItem: K8sSecretItem) => {
    if (!secretModalTargetNode) return;
    const currentProject = useFlowStore.getState().currentProject;
    const activeProfileName = getActiveProfileName(currentProject);

    const target = nodes.find((n) => n.id === secretModalTargetNode.id) || null;
    const targetLabel = (target?.data?.label as string) || target?.id || secretModalTargetNode.label;
    const isTargetStillAttached = isNodeAttachedToConfigMap(target, secretModalTargetNode, secretItem.resourceName);

    const enrichedSecretItem = createEnrichedSecretItem(
      secretItem,
      target,
      isTargetStillAttached,
      activeProfileName,
      targetLabel
    );

    if (target && isTargetStillAttached) {
      attachSecretToNode(target, secretItem, enrichedSecretItem, targetLabel, updateNodeData);
    } else {
      detachSecretFromNode(target, secretItem, targetLabel, updateNodeData);
      useFlowStore.getState().addLog('info', `[Secret Saved] Saved Secret "${secretItem.name}" to local storage`, 'UI');
    }

    useFlowStore.getState().addOrUpdateSavedSecret(enrichedSecretItem);
    void persistSecretItem(enrichedSecretItem);
    setSecretModalTargetNode({ id: 'cluster-storage', label: 'Cluster Secrets', initialViewMode: 'list' });
  };

  const handleConfigMapSave = (cmItem: K8sConfigMapItem) => {
    if (!configMapModalTargetNode) return;
    const currentProject = useFlowStore.getState().currentProject;
    const activeProfileName = getActiveProfileName(currentProject);

    const target = nodes.find((n) => n.id === configMapModalTargetNode.id) || null;
    const targetLabel = (target?.data?.label as string) || target?.id || configMapModalTargetNode.label;
    const isTargetStillAttached = isNodeAttachedToConfigMap(target, configMapModalTargetNode, cmItem.resourceName);

    const enrichedCmItem = createEnrichedConfigMapItem(
      cmItem,
      target,
      isTargetStillAttached,
      activeProfileName,
      targetLabel
    );

    if (target && isTargetStillAttached) {
      attachConfigMapToNode(target, cmItem, enrichedCmItem, targetLabel, updateNodeData);
    } else {
      detachConfigMapFromNode(target, cmItem, targetLabel, updateNodeData);
      useFlowStore.getState().addLog('info', `[ConfigMap Saved] Saved ConfigMap "${cmItem.name}" to local storage`, 'UI');
    }

    useFlowStore.getState().addOrUpdateSavedConfigMap(enrichedCmItem);
    void persistConfigMapItem(enrichedCmItem);
    setConfigMapModalTargetNode({ id: 'cluster-storage', label: 'Cluster ConfigMaps', initialViewMode: 'list' });
  };

  const handleHpaSave = (hpaItem: K8sHpaItem) => {
    if (!hpaModalTargetNode) return;
    const target = nodes.find((n) => n.id === hpaModalTargetNode.id);
    if (!target) return;

    const existingHpas = target.data.hpas || [];
    const existingIndex = existingHpas.findIndex((h: K8sHpaItem) => h.id === hpaItem.id);
    let updatedHpas: K8sHpaItem[];

    if (existingIndex >= 0) {
      updatedHpas = [...existingHpas];
      updatedHpas[existingIndex] = hpaItem;
    } else {
      updatedHpas = [...existingHpas, hpaItem];
    }

    updateNodeData(target.id, { hpas: updatedHpas });
    useFlowStore.getState().addLog('info', `[HPA Attached] Attached HPA "${hpaItem.name}" to card ${hpaModalTargetNode.label}`, 'UI');
    setHpaModalTargetNode(null);

    useFlowStore.setState({
      configuringNodeId: target.id,
      configuringEdgeId: null,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
    });

    // Auto-emit live kubectl command
    emitLiveHpaCommand(
      hpaItem.name,
      hpaModalTargetNode.label,
      hpaItem.minReplicas || 1,
      hpaItem.maxReplicas || 10,
      hpaItem.targetCPUUtilizationPercentage || 80
    );
  };

  const handleResourceLimitSave = (resItem: K8sResourceLimitItem) => {
    if (!resourceLimitModalTargetNode) return;
    const target = nodes.find((n) => n.id === resourceLimitModalTargetNode.id);
    if (!target) return;

    const existingLimits = target.data.resourceLimits || [];
    const existingIndex = existingLimits.findIndex((r: K8sResourceLimitItem) => r.id === resItem.id);
    let updatedLimits: K8sResourceLimitItem[];

    if (existingIndex >= 0) {
      updatedLimits = [...existingLimits];
      updatedLimits[existingIndex] = resItem;
    } else {
      updatedLimits = [...existingLimits, resItem];
    }

    updateNodeData(target.id, {
      resourceLimits: updatedLimits,
      cpuRequest: resItem.cpuRequest,
      cpuLimit: resItem.cpuLimit,
      memoryRequest: resItem.memoryRequest,
      memoryLimit: resItem.memoryLimit,
    });
    useFlowStore.getState().addLog('info', `[Resource Limit Attached] Attached Resource Limit "${resItem.name}" to card ${resourceLimitModalTargetNode.label}`, 'UI');
    setResourceLimitModalTargetNode(null);

    useFlowStore.setState({
      configuringNodeId: target.id,
      configuringEdgeId: null,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
    });
  };

  return {
    roleModalTargetNode,
    setRoleModalTargetNode,
    configMapModalTargetNode,
    setConfigMapModalTargetNode,
    secretModalTargetNode,
    setSecretModalTargetNode,
    hpaModalTargetNode,
    setHpaModalTargetNode,
    resourceLimitModalTargetNode,
    setResourceLimitModalTargetNode,
    handleRoleSave,
    handleConfigMapSave,
    handleSecretSave,
    handleHpaSave,
    handleResourceLimitSave,
  };
}
