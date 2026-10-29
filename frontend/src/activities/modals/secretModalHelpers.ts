import { K8sSecretItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';
import { ComponentOption } from '@/components/Modals/ConfigMapComponentSection';
import { getPodReplicaGroupInfo, PodReplicaGroupInfo } from './configMapModalHelpers';
import { OverviewItem } from './attachedResourceOverviewHelpers';
import { removeSecretFromLocal } from './secretStorageHelpers';

export type SecretModalViewMode = 'form' | 'list' | 'profile';
export type SecretLogLevel = 'info' | 'warn' | 'error';

export {
  resolveTargetOptionLabel,
  getAvailableWorkloadComponents,
  appendTargetComponentOption,
  extractUniqueRawItems,
} from './configMapModalHelpers';

/**
 * Constructs a standardized K8sSecretItem object with ID fallback.
 */
export function buildSecretItem(
  initialId: string | undefined,
  rawName: string,
  type: string | undefined,
  secretData: Array<{ key: string; value: string }>
): K8sSecretItem {
  const suffix = crypto.randomUUID().split('-')[0];
  const id = initialId || `secret-${Date.now()}-${suffix}`;
  const trimmedName = rawName?.trim();
  const name = trimmedName ? sanitizeSlug(trimmedName) : id;
  return {
    id,
    name: name || id,
    type: type || 'Opaque',
    secretData,
  };
}

function isNodeSecretAttached(
  node: any,
  secId: string | undefined,
  secName: string | undefined,
  resourceNames: readonly string[],
  groupInfo: PodReplicaGroupInfo
): boolean {
  const nodeLabel = (node.data?.label as string) || node.id;
  const hasSecretsArray = Array.isArray(node.data?.secrets);

  if (hasSecretsArray) {
    return node.data.secrets.some(
      (s: any) => (secId && s.id === secId) || (secName && s.name === secName)
    );
  }

  return resourceNames.some(
    (r) =>
      r === nodeLabel ||
      r === node.id ||
      (groupInfo.isGroup && (r === groupInfo.groupLabel || nodeLabel.startsWith(`${r}-`)))
  );
}

/**
 * Scans canvas nodes to find all attached components for a Secret,
 * collapsing pod replica groups sharing baseName and podHash into a single option.
 */
export function findAllAttachedSecretComponents(
  secId: string | undefined,
  secName: string | undefined,
  nodes: any[],
  resourceName?: string
): ComponentOption[] {
  if (!secId && !secName) return [];

  const results: ComponentOption[] = [];
  const foundKeys = new Set<string>();
  const resourceNames = resourceName
    ? resourceName.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  nodes.forEach((node) => {
    const groupInfo = getPodReplicaGroupInfo(node);
    if (foundKeys.has(groupInfo.groupKey)) return;

    if (isNodeSecretAttached(node, secId, secName, resourceNames, groupInfo)) {
      foundKeys.add(groupInfo.groupKey);
      results.push({
        id: groupInfo.groupKey,
        label: groupInfo.groupLabel,
        type: node.type || 'Node',
      });
    }
  });

  return results;
}

/**
 * Synchronizes attached Secrets across all canvas nodes and pod replica groups.
 */
export function syncNodesSecret(
  nodes: any[],
  targetId: string | undefined,
  secName: string,
  oldSecName: string | undefined,
  secretItem: K8sSecretItem,
  attachedIds: Set<string>,
  updateNodeData: (id: string, data: any) => void
) {
  nodes.forEach((node) => {
    const currentList: K8sSecretItem[] = node.data?.secrets || [];
    const isThisSec = (s: K8sSecretItem) =>
      Boolean((targetId && s.id === targetId) || (secName && s.name === secName) || (oldSecName && s.name === oldSecName));
    const hasThisSec = currentList.some(isThisSec);

    const groupInfo = getPodReplicaGroupInfo(node);
    const isAttached = attachedIds.has(node.id) || (groupInfo.isGroup && attachedIds.has(groupInfo.groupKey));

    if (isAttached) {
      const nextList = hasThisSec
        ? currentList.map((s) => (isThisSec(s) ? secretItem : s))
        : [...currentList, secretItem];
      updateNodeData(node.id, { secrets: nextList });
    } else if (hasThisSec) {
      updateNodeData(node.id, {
        secrets: currentList.filter((s) => !isThisSec(s)),
      });
    }
  });
}

/**
 * Merges current attached components with the attached components of a source Secret.
 */
export function mergeAttachedSecretComponents(
  currentAttached: readonly ComponentOption[],
  sourceSec: K8sSecretItem,
  nodes: any[]
): ComponentOption[] {
  const existingAttached = findAllAttachedSecretComponents(
    sourceSec.id,
    sourceSec.name,
    nodes,
    sourceSec.resourceName
  );
  const combined = [...currentAttached];
  existingAttached.forEach((comp) => {
    if (!combined.some((c) => c.id === comp.id)) {
      combined.push(comp);
    }
  });

  return combined;
}

/**
 * Removes a Secret from all nodes on the canvas.
 */
export function removeSecretFromNodeOrStore(
  item: OverviewItem,
  nodes: any[],
  updateNodeData: (id: string, data: any) => void,
  addLog: (level: SecretLogLevel, message: string, category?: string) => void,
  deleteSavedSecret?: (id: string) => void
): void {
  if (item.ownerNode.id !== 'cluster-storage') {
    nodes.forEach((node) => {
      const currentList: K8sSecretItem[] = node.data?.secrets || [];
      const isTargetSec = (s: K8sSecretItem) => s.id === item.rawItem.id || Boolean(item.name && s.name === item.name);
      if (currentList.some(isTargetSec)) {
        updateNodeData(node.id, {
          secrets: currentList.filter((s) => !isTargetSec(s)),
        });
        addLog(
          'info',
          `[Attached Resource] Removed Secret '${item.name}' from ${node.data?.label || node.id}`,
          'UI'
        );
      }
    });
  }
  void removeSecretFromLocal(item.rawItem.id);
  deleteSavedSecret?.(item.rawItem.id);
}

export interface DetachSecretParams {
  nodes: any[];
  componentId: string;
  targetSecId: string | undefined;
  secretName: string | undefined;
  oldSecName: string | undefined;
  updateNodeData: (id: string, data: any) => void;
  addLog?: (level: SecretLogLevel, message: string, category?: string) => void;
}

export function detachSecretComponent(params: DetachSecretParams): void {
  const { nodes, componentId, targetSecId, secretName, oldSecName, updateNodeData, addLog } = params;
  const targetNodes = nodes.filter((n) => {
    if (n.id === componentId) return true;
    const groupInfo = getPodReplicaGroupInfo(n);
    return groupInfo.isGroup && groupInfo.groupKey === componentId;
  });

  targetNodes.forEach((node) => {
    const currentList: K8sSecretItem[] = node.data?.secrets || [];
    const updatedList = currentList.filter(
      (s) =>
        !(targetSecId && s.id === targetSecId) &&
        !(secretName && s.name === secretName) &&
        !(oldSecName && s.name === oldSecName)
    );
    updateNodeData(node.id, { secrets: updatedList });
    addLog?.(
      'info',
      `[Secret] Removed attached component '${node.data?.label || node.id}' from Secret '${secretName}'`,
      'UI'
    );
  });
}

export interface AttachSecretParams {
  nodes: any[];
  comp: ComponentOption;
  targetId: string;
  secretName: string;
  secretType: string;
  validData: Array<{ key: string; value: string }>;
  updateNodeData: (id: string, data: any) => void;
  addLog?: (level: SecretLogLevel, message: string, category?: string) => void;
}

export function attachSecretComponent(params: AttachSecretParams): void {
  const { nodes, comp, targetId, secretName, secretType, validData, updateNodeData, addLog } = params;
  const targetNodes = nodes.filter((n) => {
    if (n.id === comp.id) return true;
    const groupInfo = getPodReplicaGroupInfo(n);
    return groupInfo.isGroup && groupInfo.groupKey === comp.id;
  });
  if (targetNodes.length === 0) return;

  const primaryNode = targetNodes[0];
  const targetLabel = comp.label || (primaryNode.data?.label as string) || primaryNode.id;
  const targetType = primaryNode.type || comp.type || 'Node';

  const updatedSec = buildSecretItem(targetId, secretName, secretType, validData);
  updatedSec.resourceName = targetLabel;
  updatedSec.resourceType = targetType;

  targetNodes.forEach((node) => {
    const currentList: K8sSecretItem[] = node.data?.secrets || [];
    const exists = currentList.some(
      (s) => (targetId && s.id === targetId) || (secretName && s.name === secretName)
    );
    const updatedList = exists
      ? currentList.map((s) =>
          (targetId && s.id === targetId) || (secretName && s.name === secretName) ? updatedSec : s
        )
      : [...currentList, updatedSec];
    updateNodeData(node.id, { secrets: updatedList });
  });

  addLog?.(
    'info',
    `[Secret] Attached Secret '${secretName}' to component '${targetLabel}'`,
    'UI'
  );
}

export function getSecretModalTitle(
  mode: SecretModalViewMode,
  hasExistingItem: boolean,
  selectedProfile?: string | null
): string {
  if (mode === 'list') {
    return 'Cluster Secrets Overview';
  }
  if (mode === 'profile') {
    return `Secret Profile — ${selectedProfile || 'Canvas Profile'}`;
  }
  return hasExistingItem ? 'Edit Secret' : 'Attach Secret';
}

export function getSecretModalSubtitle(
  mode: SecretModalViewMode,
  filteredCount: number,
  targetNodeLabel?: string,
  selectedProfile?: string | null
): string {
  if (mode === 'list') {
    const suffix = filteredCount === 1 ? '' : 's';
    return `${filteredCount} Secret${suffix} available across cluster`;
  }
  if (mode === 'profile') {
    return `Canvas Profile: ${selectedProfile || 'Active'} • Evaluation Precedence Order`;
  }
  if (targetNodeLabel) {
    return `Target card: ${targetNodeLabel}`;
  }
  return 'Configure Sensitive Key-Value Data';
}
