import { K8sConfigMapItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';
import { KeyValueItem } from '@/components/Modals/KeyValueFormSection';
import { extractPodBaseName } from '@/activities/nodes/useBaseNode';
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
