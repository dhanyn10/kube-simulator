import React from 'react';
import {
  Box,
  Layers,
  Network,
  Folder,
  Route,
  Globe,
  Activity,
  Database,
  HardDrive,
  Settings,
  Lock,
  ShieldCheck,
  Gauge,
} from 'lucide-react';

export interface DetectedResource {
  name: string;
  count: number;
  cardCount: number;
  itemCount: number;
  subtypes?: string[];
}

export interface ScenarioDetectionResult {
  resources: DetectedResource[];
  totalCards: number;
  totalItems: number;
}

const RESOURCE_ORDER = [
  'Internet',
  'Namespace',
  'Ingress',
  'Service',
  'Deployment',
  'StatefulSet',
  'ReplicaSet',
  'Pod',
  'HPA',
  'ResourceLimit',
  'ConfigMap',
  'Secret',
  'PVC',
  'Role',
];

const scanAttachedItems = (
  nodeData: Record<string, any> | undefined,
  addResource: (type: string, isItem: boolean) => void
) => {
  if (!nodeData) return;

  const itemArrays: Array<{ key: string; type: string }> = [
    { key: 'hpas', type: 'HPA' },
    { key: 'configMaps', type: 'ConfigMap' },
    { key: 'secrets', type: 'Secret' },
    { key: 'roles', type: 'Role' },
    { key: 'resourceLimits', type: 'ResourceLimit' },
  ];

  for (const { key, type } of itemArrays) {
    const list = nodeData[key];
    if (Array.isArray(list)) {
      for (const _ of list) {
        addResource(type, true);
      }
    }
  }

  if (Array.isArray(nodeData.attachedResources)) {
    for (const item of nodeData.attachedResources) {
      const itemType = item?.type || item?.resourceType;
      if (itemType) {
        addResource(String(itemType), true);
      }
    }
  }
};

/**
 * Detects all cards (nodes) and items (attached HPA, ConfigMap, Secret, Role, ResourceLimit)
 * configured within a given scenario.
 */
export const detectScenarioResources = (
  scenario?: { data?: { nodes?: any[] }; nodes?: any[] } | null
): ScenarioDetectionResult => {
  if (!scenario) {
    return { resources: [], totalCards: 0, totalItems: 0 };
  }

  const nodes = scenario.data?.nodes || scenario.nodes || [];
  const resourceMap = new Map<string, DetectedResource>();
  let totalCards = 0;
  let totalItems = 0;

  const addResource = (type: string, isItem: boolean, subtype?: string) => {
    if (!type || typeof type !== 'string') return;
    const existing = resourceMap.get(type) || {
      name: type,
      count: 0,
      cardCount: 0,
      itemCount: 0,
      subtypes: [],
    };

    existing.count += 1;
    if (isItem) {
      existing.itemCount += 1;
      totalItems += 1;
    } else {
      existing.cardCount += 1;
      totalCards += 1;
    }

    if (subtype && !existing.subtypes?.includes(subtype)) {
      existing.subtypes = [...(existing.subtypes || []), subtype];
    }

    resourceMap.set(type, existing);
  };

  for (const node of nodes) {
    addResource(node.type, false, node.data?.serviceType);
    scanAttachedItems(node.data, addResource);
  }

  const resources = Array.from(resourceMap.values()).sort((a, b) => {
    const idxA = RESOURCE_ORDER.indexOf(a.name);
    const idxB = RESOURCE_ORDER.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return { resources, totalCards, totalItems };
};

/**
 * Returns Tailwind CSS badge classes corresponding to each resource type and colorMode.
 */
export const getResourceBadgeClasses = (resourceName: string, colorMode: string = 'dark'): string => {
  const isDark = colorMode === 'dark';
  switch (resourceName) {
    case 'Deployment':
      return isDark ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' : 'bg-violet-50 text-violet-700 border-violet-200';
    case 'StatefulSet':
      return isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'ReplicaSet':
      return isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Pod':
      return isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Service':
      return isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Ingress':
      return isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200';
    case 'HPA':
      return isDark ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
    case 'ResourceLimit':
      return isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Internet':
      return isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PVC':
      return isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Namespace':
      return isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ConfigMap':
      return isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' : 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Secret':
      return isDark ? 'bg-rose-400/10 text-rose-300 border-rose-400/30' : 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Role':
      return isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return isDark ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

/**
 * Returns a React Lucide icon component matching the resource type.
 */
export const getResourceIcon = (resourceName: string, size: number = 11): React.ReactElement => {
  switch (resourceName) {
    case 'Deployment': return <Layers size={size} />;
    case 'StatefulSet': return <Database size={size} />;
    case 'ReplicaSet': return <Layers size={size} />;
    case 'Pod': return <Box size={size} />;
    case 'Service': return <Network size={size} />;
    case 'Ingress': return <Route size={size} />;
    case 'HPA': return <Activity size={size} />;
    case 'ResourceLimit': return <Gauge size={size} />;
    case 'Internet': return <Globe size={size} />;
    case 'PVC': return <HardDrive size={size} />;
    case 'Namespace': return <Folder size={size} />;
    case 'ConfigMap': return <Settings size={size} />;
    case 'Secret': return <Lock size={size} />;
    case 'Role': return <ShieldCheck size={size} />;
    default: return <Box size={size} />;
  }
};
