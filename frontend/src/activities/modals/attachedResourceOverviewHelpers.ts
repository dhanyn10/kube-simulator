import { LucideIcon, Settings, Lock, ShieldCheck, Activity, Layers } from 'lucide-react';
import { Node } from '@xyflow/react';
import { K8sResourceType, K8sConfigMapItem, K8sSecretItem } from '@/types';
import { getCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import { getPodReplicaGroupInfo } from './configMapModalHelpers';

/** Represents an extracted attached resource item paired with its host canvas node metadata. */
export interface OverviewItem {
  id: string;
  name: string;
  rawItem: any;
  ownerNode: {
    id: string;
    label: string;
    type: string;
  };
  profileName?: string;
}

/** Mapping of attached resource types to their property keys in Node data. */
export const RESOURCE_TYPE_KEY_MAP: Record<string, string> = {
  ConfigMap: 'configMaps',
  Secret: 'secrets',
  Role: 'roles',
  HPA: 'hpas',
  ResourceLimit: 'resourceLimits',
};

/**
 * Scans all canvas nodes to extract all attached child resource items of the given type,
 * and includes unattached persisted ConfigMaps if resourceType is ConfigMap.
 *
 * @param nodes - Array of all canvas nodes.
 * @param resourceType - K8s resource type (e.g. 'ConfigMap', 'Secret', 'Role', 'HPA', 'ResourceLimit').
 * @param savedConfigMaps - Optional array of locally stored ConfigMaps to include if not on canvas.
 * @returns Array of overview items with owner node details.
 */
export const extractAllOverviewItems = (
  nodes: Node[],
  resourceType: K8sResourceType,
  savedResources?: (K8sConfigMapItem | K8sSecretItem)[],
  currentProfileName?: string
): OverviewItem[] => {
  const key = RESOURCE_TYPE_KEY_MAP[resourceType];
  if (!key) return [];

  const items: OverviewItem[] = [];
  const foundIds = new Set<string>();
  const seenCompositeKeys = new Set<string>();
  const activeProfile = (currentProfileName && currentProfileName !== 'Default Profile')
    ? currentProfileName
    : getCurrentSessionAutosaveKey();

  nodes.forEach((node) => {
    const parentNode = node.parentId ? nodes.find((p) => p.id === node.parentId) : null;
    const parentList = parentNode ? parentNode.data?.[key] : null;

    const list = node.data?.[key];
    if (Array.isArray(list)) {
      list.forEach((item: any, idx: number) => {
        const itemId = item.id || `${node.id}-${key}-${idx}`;
        const itemName = item.name || '';

        // If child node inside a controller and parent already has this attached resource, skip child replica duplicate
        if (
          Array.isArray(parentList) &&
          parentList.some((pItem: any) => pItem.id === itemId || (itemName && pItem.name === itemName))
        ) {
          return;
        }

        const groupInfo = getPodReplicaGroupInfo(node);
        const componentLabel = groupInfo.isGroup ? groupInfo.groupLabel : ((node.data?.label as string) || node.id);
        const resolvedProfile = (item.profileName && item.profileName !== 'Default Profile')
          ? item.profileName
          : activeProfile;

        const compositeKey = `${itemId}::${componentLabel}::${resolvedProfile}`;
        if (seenCompositeKeys.has(compositeKey)) {
          return;
        }
        seenCompositeKeys.add(compositeKey);
        foundIds.add(itemId);
        if (item.name) foundIds.add(item.name);

        items.push({
          id: itemId,
          name: item.name || 'Unnamed',
          rawItem: item,
          ownerNode: {
            id: node.id,
            label: componentLabel,
            type: node.type || 'Node',
          },
          profileName: resolvedProfile,
        });
      });
    }
  });

  if ((resourceType === 'ConfigMap' || resourceType === 'Secret') && Array.isArray(savedResources)) {
    savedResources.forEach((savedItem: any) => {
      if (!foundIds.has(savedItem.id) && !foundIds.has(savedItem.name)) {
        const isAttached = Boolean(savedItem.resourceName);
        const componentLabel = savedItem.resourceName || (isAttached ? 'saved-resource' : 'Cluster (Local Storage)');
        const resolvedProfile = (savedItem.profileName && savedItem.profileName !== 'Default Profile')
          ? savedItem.profileName
          : activeProfile;

        const compositeKey = `${savedItem.id}::${componentLabel}::${resolvedProfile}`;
        if (seenCompositeKeys.has(compositeKey)) {
          return;
        }
        seenCompositeKeys.add(compositeKey);
        foundIds.add(savedItem.id);
        if (savedItem.name) foundIds.add(savedItem.name);

        items.push({
          id: savedItem.id,
          name: savedItem.name || 'Unnamed',
          rawItem: savedItem,
          ownerNode: {
            id: isAttached ? (savedItem.resourceName || 'saved-resource') : 'cluster-storage',
            label: componentLabel,
            type: savedItem.resourceType || (isAttached ? 'Resource' : resourceType),
          },
          profileName: resolvedProfile,
        });
      }
    });
  }

  return items;
};

const checkItemMatchesQuery = (item: OverviewItem, query: string, resourceType: K8sResourceType): boolean => {
  if (item.id.toLowerCase().includes(query)) return true;
  if (item.name.toLowerCase().includes(query)) return true;
  if (item.ownerNode.label.toLowerCase().includes(query)) return true;
  if (item.ownerNode.type.toLowerCase().includes(query)) return true;
  if (item.profileName?.toLowerCase().includes(query)) return true;

  if (resourceType === 'ConfigMap' && Array.isArray(item.rawItem.configData)) {
    return item.rawItem.configData.some(
      (cd: { key: string; value: string }) =>
        cd.key.toLowerCase().includes(query) || String(cd.value).toLowerCase().includes(query)
    );
  }
  if (resourceType === 'Secret' && Array.isArray(item.rawItem.secretData)) {
    return item.rawItem.secretData.some((sd: { key: string }) => sd.key.toLowerCase().includes(query));
  }
  if (resourceType === 'Role' && Array.isArray(item.rawItem.assignedUsers)) {
    return item.rawItem.assignedUsers.some((u: string) => u.toLowerCase().includes(query));
  }
  return false;
};

/**
 * Filters overview items matching a user search query against names, owner nodes, and key-values.
 *
 * @param items - List of extracted overview items.
 * @param search - Search query string.
 * @param resourceType - Attached resource type.
 * @returns Filtered overview items.
 */
export const filterOverviewItems = (
  items: OverviewItem[],
  search: string,
  resourceType: K8sResourceType
): OverviewItem[] => {
  const query = search.trim().toLowerCase();
  if (!query) return items;

  return items.filter((item) => checkItemMatchesQuery(item, query, resourceType));
};

/** Modal header and appearance configuration metadata. */
export interface ResourceOverviewMeta {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColorClass: string;
  badgeBgColorClass: string;
  emptyMessage: string;
  resourceKey: string;
  logResourceName: string;
}

/**
 * Returns UI styling, icon, and text metadata for a given attached resource type.
 *
 * @param type - Resource type clicked.
 * @param count - Count of active items currently found.
 * @returns Metadata object.
 */
export const getResourceOverviewMeta = (type: K8sResourceType, count: number): ResourceOverviewMeta => {
  const pluralSuffix = count === 1 ? '' : 's';

  if (type === 'ConfigMap') {
    return {
      title: 'Cluster ConfigMaps Overview',
      subtitle: `${count} ConfigMap${pluralSuffix} configured across cluster nodes`,
      icon: Settings,
      iconColorClass: 'text-teal-400',
      badgeBgColorClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      emptyMessage: 'No ConfigMaps currently configured in the cluster. Drag & drop ConfigMap from the left sidebar onto a workload card (Pod, Deployment, etc.) to attach one.',
      resourceKey: 'configMaps',
      logResourceName: 'ConfigMap',
    };
  }
  if (type === 'Secret') {
    return {
      title: 'Cluster Secrets Overview',
      subtitle: `${count} Secret${pluralSuffix} configured across cluster nodes`,
      icon: Lock,
      iconColorClass: 'text-amber-400',
      badgeBgColorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      emptyMessage: 'No Secrets currently configured in the cluster. Drag & drop Secret from the left sidebar onto a workload card to attach one.',
      resourceKey: 'secrets',
      logResourceName: 'Secret',
    };
  }
  if (type === 'Role') {
    return {
      title: 'Cluster RBAC Roles & RoleBindings Overview',
      subtitle: `${count} Role${pluralSuffix} configured across cluster nodes`,
      icon: ShieldCheck,
      iconColorClass: 'text-indigo-400',
      badgeBgColorClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      emptyMessage: 'No RBAC Roles currently configured in the cluster. Drag & drop Role from the left sidebar onto a workload card to attach one.',
      resourceKey: 'roles',
      logResourceName: 'Role',
    };
  }
  if (type === 'HPA') {
    return {
      title: 'Cluster Horizontal Pod Autoscalers Overview',
      subtitle: `${count} HPA${pluralSuffix} configured across cluster nodes`,
      icon: Activity,
      iconColorClass: 'text-purple-400',
      badgeBgColorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      emptyMessage: 'No HPAs currently configured in the cluster. Drag & drop HPA from the left sidebar onto a Deployment to attach auto-scaling.',
      resourceKey: 'hpas',
      logResourceName: 'HPA',
    };
  }

  return {
    title: 'Cluster Resource Limits Overview',
    subtitle: `${count} Resource Limit${pluralSuffix} configured across cluster nodes`,
    icon: Layers,
    iconColorClass: 'text-blue-400',
    badgeBgColorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    emptyMessage: 'No Resource Limits currently configured in the cluster. Drag & drop Resource Limit from the left sidebar onto a workload card to attach limits.',
    resourceKey: 'resourceLimits',
    logResourceName: 'Resource Limit',
  };
};
