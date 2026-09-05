import React, { useEffect } from 'react';
import { GetSystemResources } from '@wailsjs/go/main/App.js';
import { EventsOn } from '@wailsjs/runtime';
import { useFlowStore } from '../store';
import { K8sRoleItem, K8sConfigMapItem, K8sSecretItem, K8sHpaItem } from '../types';
import { logger } from '../lib/logger';

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
      Promise.all([
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
        GetSystemResources()
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
  };

  const handleSecretSave = (secretItem: K8sSecretItem) => {
    if (!secretModalTargetNode) return;
    const target = nodes.find((n) => n.id === secretModalTargetNode.id);
    if (!target) return;

    const existingSecrets = target.data.secrets || [];
    const existingIndex = existingSecrets.findIndex((s: K8sSecretItem) => s.id === secretItem.id);
    let updatedSecrets: K8sSecretItem[];

    if (existingIndex >= 0) {
      updatedSecrets = [...existingSecrets];
      updatedSecrets[existingIndex] = secretItem;
    } else {
      updatedSecrets = [...existingSecrets, secretItem];
    }

    updateNodeData(target.id, { secrets: updatedSecrets });
    useFlowStore.getState().addLog('info', `[Secret Attached] Attached Secret "${secretItem.name}" to card ${secretModalTargetNode.label}`, 'UI');
    setSecretModalTargetNode(null);

    useFlowStore.setState({
      configuringNodeId: target.id,
      configuringEdgeId: null,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
    });
  };

  const handleConfigMapSave = (cmItem: K8sConfigMapItem) => {
    if (!configMapModalTargetNode) return;
    const target = nodes.find((n) => n.id === configMapModalTargetNode.id);
    if (!target) return;

    const existingCMs = target.data.configMaps || [];
    const existingIndex = existingCMs.findIndex((c: K8sConfigMapItem) => c.id === cmItem.id);
    let updatedCMs: K8sConfigMapItem[];

    if (existingIndex >= 0) {
      updatedCMs = [...existingCMs];
      updatedCMs[existingIndex] = cmItem;
    } else {
      updatedCMs = [...existingCMs, cmItem];
    }

    updateNodeData(target.id, { configMaps: updatedCMs });
    useFlowStore.getState().addLog('info', `[ConfigMap Attached] Attached ConfigMap "${cmItem.name}" to card ${configMapModalTargetNode.label}`, 'UI');
    setConfigMapModalTargetNode(null);

    useFlowStore.setState({
      configuringNodeId: target.id,
      configuringEdgeId: null,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
    });
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
    handleRoleSave,
    handleConfigMapSave,
    handleSecretSave,
    handleHpaSave,
  };
}
