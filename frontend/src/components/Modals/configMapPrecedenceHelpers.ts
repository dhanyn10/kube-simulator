import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { K8sConfigMapItem, K8sSecretItem } from '@/types';
import { saveConfigMapsToLocal } from '@/activities/modals/configMapStorageHelpers';
import { saveSecretsToLocal } from '@/activities/modals/secretStorageHelpers';

export interface KeyOverrideResult {
  isOverridden: boolean;
  overriddenByCmName?: string;
  overriddenByName?: string;
}

/**
 * Checks if a key in the resource item at `cmIndex` is overridden by any item below it in the list (index > cmIndex).
 * According to Kubernetes standards, variables in lower items take precedence over upper ones.
 *
 * @param key - The variable key to check.
 * @param cmIndex - Index of the current item in the precedence list.
 * @param allItems - Full list of items in top-to-bottom evaluation order.
 * @param profileName - Optional profile name to filter by.
 * @returns KeyOverrideResult with boolean and the name of the lower item that overrides it.
 */
export function checkIsKeyOverridden(
  key: string,
  cmIndex: number,
  allItems: readonly { name: string; rawItem?: any; profileName?: string }[],
  profileName?: string
): KeyOverrideResult {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return { isOverridden: false };
  }

  const normalizedProfile = profileName?.trim();

  // Iterate over items located AFTER cmIndex (lower down in precedence stack)
  for (let j = cmIndex + 1; j < allItems.length; j++) {
    const lowerItem = allItems[j];
    const lowerProfile = lowerItem.profileName?.trim();

    // If profileName is provided, only check items that match the same profile
    if (normalizedProfile && lowerProfile && normalizedProfile !== lowerProfile) {
      continue;
    }

    const dataArray = lowerItem.rawItem?.secretData || lowerItem.rawItem?.configData;
    if (Array.isArray(dataArray)) {
      const hasMatch = dataArray.some(
        (kv: { key?: string }) => typeof kv?.key === 'string' && kv.key.trim() === normalizedKey
      );
      if (hasMatch) {
        const foundName = lowerItem.name || lowerItem.rawItem?.name || `item-${j + 1}`;
        return {
          isOverridden: true,
          overriddenByCmName: foundName,
          overriddenByName: foundName,
        };
      }
    }
  }

  return { isOverridden: false };
}

/**
 * Immutably moves an item from `fromIndex` to `toIndex` within an array.
 *
 * @param items - Original array of items.
 * @param fromIndex - Source index.
 * @param toIndex - Destination index.
 * @returns New array with item moved.
 */
export function reorderItems<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

/**
 * Generic precedence synchronizer for ConfigMap or Secret order across nodes and local store.
 */
export type PrecedenceResourceType = 'ConfigMap' | 'Secret';
export type PrecedenceLogLevel = 'info' | 'warn' | 'error';

export interface SyncPrecedenceParams {
  resourceType: PrecedenceResourceType;
  reorderedItems: readonly OverviewItem[];
  nodes: any[];
  updateNodeData: (id: string, data: any) => void;
  savedItems: any[];
  setSavedItems: (items: any[]) => void;
  saveToLocal: (items: any[]) => Promise<boolean>;
  addLog?: (level: PrecedenceLogLevel, message: string, category?: string) => void;
}

export function syncResourcePrecedenceOrder(params: SyncPrecedenceParams): void {
  const {
    resourceType,
    reorderedItems,
    nodes,
    updateNodeData,
    savedItems,
    setSavedItems,
    saveToLocal,
    addLog,
  } = params;

  const dataProp = resourceType === 'Secret' ? 'secrets' : 'configMaps';

  const orderRank = new Map<string, number>();
  reorderedItems.forEach((item, index) => {
    orderRank.set(item.id, index);
    if (item.name) {
      orderRank.set(item.name, index);
    }
    if (item.rawItem?.id) {
      orderRank.set(item.rawItem.id, index);
    }
  });

  nodes.forEach((node) => {
    const list = node.data?.[dataProp];
    if (Array.isArray(list) && list.length > 1) {
      const sorted = [...list].sort((a: any, b: any) => {
        const rankA = orderRank.get(a.id) ?? orderRank.get(a.name) ?? 999;
        const rankB = orderRank.get(b.id) ?? orderRank.get(b.name) ?? 999;
        return rankA - rankB;
      });
      updateNodeData(node.id, { [dataProp]: sorted });
    }
  });

  if (Array.isArray(savedItems) && savedItems.length > 0) {
    const sortedSaved = [...savedItems].sort((a, b) => {
      const rankA = orderRank.get(a.id) ?? orderRank.get(a.name) ?? 999;
      const rankB = orderRank.get(b.id) ?? orderRank.get(b.name) ?? 999;
      return rankA - rankB;
    });
    setSavedItems(sortedSaved);
    void saveToLocal(sortedSaved);
  }

  addLog?.(
    'info',
    `[${resourceType} Precedence] Updated evaluation order for ${reorderedItems.length} ${resourceType}(s)`,
    'UI'
  );
}

/**
 * Synchronizes the updated ConfigMap order across canvas nodes and savedConfigMaps.
 */
export function syncConfigMapPrecedenceOrder(
  reorderedItems: readonly OverviewItem[],
  nodes: any[],
  updateNodeData: (id: string, data: any) => void,
  savedConfigMaps: K8sConfigMapItem[],
  setSavedConfigMaps: (cms: K8sConfigMapItem[]) => void,
  addLog?: (level: 'info' | 'warn' | 'error', message: string, category?: string) => void
): void {
  syncResourcePrecedenceOrder({
    resourceType: 'ConfigMap',
    reorderedItems,
    nodes,
    updateNodeData,
    savedItems: savedConfigMaps,
    setSavedItems: setSavedConfigMaps,
    saveToLocal: saveConfigMapsToLocal,
    addLog,
  });
}

/**
 * Synchronizes the updated Secret order across canvas nodes and savedSecrets.
 */
export function syncSecretPrecedenceOrder(
  reorderedItems: readonly OverviewItem[],
  nodes: any[],
  updateNodeData: (id: string, data: any) => void,
  savedSecrets: K8sSecretItem[],
  setSavedSecrets: (secrets: K8sSecretItem[]) => void,
  addLog?: (level: 'info' | 'warn' | 'error', message: string, category?: string) => void
): void {
  syncResourcePrecedenceOrder({
    resourceType: 'Secret',
    reorderedItems,
    nodes,
    updateNodeData,
    savedItems: savedSecrets,
    setSavedItems: setSavedSecrets,
    saveToLocal: saveSecretsToLocal,
    addLog,
  });
}
