import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { K8sConfigMapItem } from '@/types';
import { saveConfigMapsToLocal } from '@/activities/modals/configMapStorageHelpers';

export interface KeyOverrideResult {
  isOverridden: boolean;
  overriddenByCmName?: string;
}

/**
 * Checks if a key in the ConfigMap at `cmIndex` is overridden by any ConfigMap below it in the list (index > cmIndex).
 * According to Kubernetes standards, variables in lower ConfigMaps take precedence over upper ones.
 *
 * @param key - The variable key to check.
 * @param cmIndex - Index of the current ConfigMap in the precedence list.
 * @param allItems - Full list of ConfigMap items in top-to-bottom evaluation order.
 * @returns KeyOverrideResult with boolean and the name of the lower ConfigMap that overrides it.
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

  // Iterate over ConfigMaps located AFTER cmIndex (lower down in precedence stack)
  for (let j = cmIndex + 1; j < allItems.length; j++) {
    const lowerCm = allItems[j];
    const lowerProfile = lowerCm.profileName?.trim();

    // If profileName is provided, only check ConfigMaps that match the same profile
    if (normalizedProfile && lowerProfile && normalizedProfile !== lowerProfile) {
      continue;
    }

    const configData = lowerCm.rawItem?.configData;
    if (Array.isArray(configData)) {
      const match = configData.find(
        (kv: { key?: string }) => typeof kv?.key === 'string' && kv.key.trim() === normalizedKey
      );
      if (match) {
        return {
          isOverridden: true,
          overriddenByCmName: lowerCm.name || lowerCm.rawItem?.name || `cm-${j + 1}`,
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
 * Synchronizes the updated ConfigMap order across canvas nodes and savedConfigMaps.
 *
 * @param reorderedItems - Overview items in the newly established order.
 * @param nodes - Canvas nodes.
 * @param updateNodeData - Callback to update node data.
 * @param savedConfigMaps - Current locally saved ConfigMaps.
 * @param setSavedConfigMaps - Callback to update savedConfigMaps in store.
 * @param addLog - Callback to emit activity log.
 */
export function syncConfigMapPrecedenceOrder(
  reorderedItems: readonly OverviewItem[],
  nodes: any[],
  updateNodeData: (id: string, data: any) => void,
  savedConfigMaps: K8sConfigMapItem[],
  setSavedConfigMaps: (cms: K8sConfigMapItem[]) => void,
  addLog?: (level: 'info' | 'warn' | 'error', message: string, category?: string) => void
): void {
  // 1. Create order rank map for fast sorting
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

  // 2. Reorder configMaps in affected canvas nodes
  nodes.forEach((node) => {
    const list = node.data?.configMaps;
    if (Array.isArray(list) && list.length > 1) {
      const sorted = [...list].sort((a: K8sConfigMapItem, b: K8sConfigMapItem) => {
        const rankA = orderRank.get(a.id) ?? orderRank.get(a.name) ?? 999;
        const rankB = orderRank.get(b.id) ?? orderRank.get(b.name) ?? 999;
        return rankA - rankB;
      });
      updateNodeData(node.id, { configMaps: sorted });
    }
  });

  // 3. Reorder savedConfigMaps
  if (Array.isArray(savedConfigMaps) && savedConfigMaps.length > 0) {
    const sortedSaved = [...savedConfigMaps].sort((a, b) => {
      const rankA = orderRank.get(a.id) ?? orderRank.get(a.name) ?? 999;
      const rankB = orderRank.get(b.id) ?? orderRank.get(b.name) ?? 999;
      return rankA - rankB;
    });
    setSavedConfigMaps(sortedSaved);
    void saveConfigMapsToLocal(sortedSaved);
  }

  addLog?.(
    'info',
    `[ConfigMap Precedence] Updated evaluation order for ${reorderedItems.length} ConfigMap(s)`,
    'UI'
  );
}
