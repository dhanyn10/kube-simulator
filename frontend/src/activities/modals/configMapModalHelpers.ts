import { K8sConfigMapItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';
import { KeyValueItem } from '@/components/Modals/KeyValueFormSection';
import { extractPodBaseName } from '@/activities/nodes/useBaseNode';
import { ComponentOption } from '@/components/Modals/ConfigMapComponentSection';
import { OverviewItem } from './attachedResourceOverviewHelpers';
import rawPredefinedKeys from './configMapPredefinedKeys.json';

export type ConfigRow = KeyValueItem;

export interface ValueSuggestionItem {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

export interface KeySuggestion {
  readonly key: string;
  readonly label: string;
  readonly valueSuggestions: readonly ValueSuggestionItem[];
  readonly hint: string;
}

export const PREDEFINED_KEYS: readonly KeySuggestion[] = rawPredefinedKeys;

const matchesQuery = (text: string, q: string): boolean => text.toLowerCase().includes(q);

/**
 * Finds predefined key info for a given key name.
 */
export const findActiveKeyInfo = (keyName: string): KeySuggestion | undefined => {
  const normalizedKey = keyName.trim().toUpperCase();
  return PREDEFINED_KEYS.find((pk) => pk.key === normalizedKey);
};

/**
 * Filters predefined keys matching a user search key string.
 */
export const filterKeysByQuery = (keyQuery: string): KeySuggestion[] => {
  const q = keyQuery.toLowerCase();
  return PREDEFINED_KEYS.filter((pk) => matchesQuery(pk.key, q));
};

/**
 * Filters value suggestions for a specific key info matching a user search value string.
 */
export const filterValuesByQuery = (
  keyInfo: KeySuggestion | undefined,
  valueQuery: string
): readonly ValueSuggestionItem[] => {
  if (!keyInfo) return [];
  const q = valueQuery.toLowerCase();
  return keyInfo.valueSuggestions.filter(
    (opt) => matchesQuery(opt.value, q) || matchesQuery(opt.description, q)
  );
};

/**
 * Constructs a standardized K8sConfigMapItem object.
 */
export const buildConfigMapItem = (
  initialId: string | undefined,
  rawName: string,
  configData: Array<{ key: string; value: string }>
): K8sConfigMapItem => {
  const suffix = crypto.randomUUID().split('-')[0];
  const id = initialId || `cm-${Date.now()}-${suffix}`;
  const trimmedName = rawName?.trim();
  const name = trimmedName ? sanitizeSlug(trimmedName) : id;
  return {
    id,
    name: name || id,
    configData,
  };
};

export interface PodReplicaGroupInfo {
  readonly isGroup: boolean;
  readonly groupKey: string;
  readonly groupLabel: string;
}

/**
 * Extracts baseName and podHash from a standard Kubernetes replica pod label
 * formatted as `${baseName}-${podHash}-${replicaSuffix}` without regex backtracking.
 */
export function extractPodHashFromLabel(label?: string): { baseName?: string; podHash?: string } {
  if (!label?.includes('-')) return {};
  const segments = label.split('-');
  if (segments.length >= 3) {
    const suffix = segments.at(-1);
    const hash = segments.at(-2);
    if (hash?.length === 5 && suffix?.length === 5) {
      return {
        baseName: segments.slice(0, -2).join('-'),
        podHash: hash,
      };
    }
  }
  return {};
}

/**
 * Evaluates whether a canvas node belongs to a pod replica group and extracts
 * its unique deduplication group key and display label.
 */
export function getPodReplicaGroupInfo(node: any): PodReplicaGroupInfo {
  if (node?.type === 'Pod') {
    let podHash = node.data?.podHash;
    let baseName = node.data?.baseName;

    if (!podHash && typeof node.data?.label === 'string') {
      const extracted = extractPodHashFromLabel(node.data.label);
      if (extracted.podHash) {
        baseName = baseName || extracted.baseName;
        podHash = extracted.podHash;
      }
    }

    if (podHash) {
      const fallbackBase = node.data ? extractPodBaseName(node.data) : undefined;
      const resolvedBase = baseName || fallbackBase || 'pod';
      return {
        isGroup: true,
        groupKey: `pod-group:${resolvedBase}-${podHash}`,
        groupLabel: `${resolvedBase}-${podHash}`,
      };
    }
  }

  return {
    isGroup: false,
    groupKey: node?.id || '',
    groupLabel: (node?.data?.label as string) || node?.id || '',
  };
}

export function resolveTargetOptionLabel(
  groupInfo: PodReplicaGroupInfo | null,
  targetNode: any,
  targetNodeLabel?: string,
  targetNodeId?: string | null
): string {
  if (groupInfo?.isGroup) {
    return groupInfo.groupLabel;
  }
  if (targetNode) {
    return (targetNode.data?.label as string) || targetNode.id;
  }
  return targetNodeLabel || targetNodeId || '';
}

export function getAvailableWorkloadComponents(nodes: any[]): ComponentOption[] {
  const list: ComponentOption[] = [];
  const seenKeys = new Set<string>();
  const allowedWorkloads = ['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Service', 'Ingress'];

  nodes
    .filter((n) => allowedWorkloads.includes(n.type || ''))
    .forEach((n) => {
      const groupInfo = getPodReplicaGroupInfo(n);
      if (!seenKeys.has(groupInfo.groupKey)) {
        seenKeys.add(groupInfo.groupKey);
        list.push({
          id: groupInfo.groupKey,
          label: groupInfo.groupLabel,
          type: n.type || 'Node',
        });
      }
    });

  return list;
}

export function appendTargetComponentOption(
  components: ComponentOption[],
  targetNodeId: string | null,
  targetNodeLabel: string | undefined,
  nodes: any[]
): ComponentOption[] {
  if (!targetNodeId || targetNodeId === 'cluster-storage') {
    return components;
  }
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  const groupInfo = targetNode ? getPodReplicaGroupInfo(targetNode) : null;
  const targetOptionId = groupInfo?.isGroup ? groupInfo.groupKey : targetNodeId;
  const targetOptionLabel = resolveTargetOptionLabel(
    groupInfo,
    targetNode,
    targetNodeLabel,
    targetNodeId
  );
  const targetType = targetNode?.type || 'Node';

  const alreadyPresent = components.some(
    (c) => c.id === targetOptionId || (groupInfo?.isGroup && c.label === groupInfo.groupLabel)
  );

  if (!alreadyPresent) {
    return [
      ...components,
      {
        id: targetOptionId,
        label: targetOptionLabel,
        type: targetType,
      },
    ];
  }
  return components;
}

export function extractUniqueRawItems<T extends { id: string; name: string }>(
  items: readonly OverviewItem[],
  currentId?: string | null
): T[] {
  const list: T[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    const raw = item.rawItem as T;
    if (raw && raw.id !== currentId && !seen.has(raw.name)) {
      seen.add(raw.name);
      list.push(raw);
    }
  });
  return list;
}
