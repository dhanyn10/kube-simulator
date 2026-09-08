/**
 * Hook and helpers for RBAC Role Configuration.
 */

import { useFlowStore } from '@/store';
import { K8sRoleRule, K8sResourceType } from '@/types';

export const AVAILABLE_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'];
export const AVAILABLE_RESOURCES = ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'persistentvolumeclaims'];

export const RESOURCE_TYPE_MAP: Record<string, K8sResourceType> = {
  pods: 'Pod',
  deployments: 'Deployment',
  services: 'Service',
  configmaps: 'ConfigMap',
  secrets: 'Secret',
  persistentvolumeclaims: 'PVC',
};

export const getVerbButtonStyles = (isSelected: boolean | undefined, colorMode: 'dark' | 'light'): string => {
  if (isSelected) {
    return "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold";
  }
  if (colorMode === 'dark') {
    return "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600";
  }
  return "bg-white border-slate-300 text-slate-600 hover:border-slate-400";
};

export const useRoleConfigHandler = (nodeId: string, rules: K8sRoleRule[]) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setEdges = useFlowStore((state) => state.setEdges);
  const addLog = useFlowStore((state) => state.addLog);

  const handleDisconnectResource = (res: string) => {
    const k8sKind = RESOURCE_TYPE_MAP[res];

    const connectedEdgeIds = new Set<string>();
    edges.forEach((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const targetNode = nodes.find((n) => n.id === e.target);
      let otherNode = null;
      if (e.source === nodeId) {
        otherNode = targetNode;
      } else if (e.target === nodeId) {
        otherNode = sourceNode;
      }

      if (!otherNode) return;

      if (res === 'pods') {
        if (otherNode.type === 'Pod' || otherNode.type === 'Deployment') {
          connectedEdgeIds.add(e.id);
        }
      } else if (res === 'deployments') {
        if (otherNode.type === 'Deployment') {
          connectedEdgeIds.add(e.id);
        }
      } else if (k8sKind && otherNode.type === k8sKind) {
        connectedEdgeIds.add(e.id);
      }
    });

    if (connectedEdgeIds.size > 0) {
      const nextEdges = edges.filter((e) => !connectedEdgeIds.has(e.id));
      setEdges(nextEdges);

      const newRules = rules.map((rule) => ({
        ...rule,
        resources: (rule.resources || []).filter((r) => r !== res),
      }));
      updateNodeData(nodeId, { rules: newRules });

      addLog('info', `[Canvas Action] Disconnected Role from ${res}`, 'UI');
    } else {
      const newRules = rules.map((rule) => ({
        ...rule,
        resources: (rule.resources || []).filter((r) => r !== res),
      }));
      updateNodeData(nodeId, { rules: newRules });
    }
  };

  const handleAddRule = () => {
    const newRules = [
      ...rules,
      {
        apiGroups: [''],
        resources: [],
        verbs: ['get', 'list']
      }
    ];
    updateNodeData(nodeId, { rules: newRules });
  };

  const handleRemoveRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    updateNodeData(nodeId, { rules: newRules });
  };

  const handleToggleVerb = (ruleIndex: number, verb: string) => {
    const newRules = [...rules];
    const currentVerbs = newRules[ruleIndex].verbs || [];
    if (currentVerbs.includes(verb)) {
      newRules[ruleIndex].verbs = currentVerbs.filter(v => v !== verb);
    } else {
      newRules[ruleIndex].verbs = [...currentVerbs, verb];
    }
    updateNodeData(nodeId, { rules: newRules });
  };

  return {
    handleDisconnectResource,
    handleAddRule,
    handleRemoveRule,
    handleToggleVerb,
  };
};
