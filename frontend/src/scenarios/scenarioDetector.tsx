import React from 'react';
import {
  LucideIcon,
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
import { cn } from '@/lib/utils';

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

interface BadgeStyle {
  dark: string;
  light: string;
}

const PALETTE: Record<string, BadgeStyle> = {
  blue: { dark: 'bg-blue-500/10 text-blue-400 border-blue-500/30', light: 'bg-blue-50 text-blue-700 border-blue-200' },
  cyan: { dark: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', light: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  emerald: { dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber: { dark: 'bg-amber-500/10 text-amber-400 border-amber-500/30', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  orange: { dark: 'bg-orange-500/10 text-orange-400 border-orange-500/30', light: 'bg-orange-50 text-orange-700 border-orange-200' },
  rose: { dark: 'bg-rose-500/10 text-rose-400 border-rose-500/30', light: 'bg-rose-50 text-rose-700 border-rose-200' },
  roseLight: { dark: 'bg-rose-400/10 text-rose-300 border-rose-400/30', light: 'bg-rose-50 text-rose-700 border-rose-200' },
  fuchsia: { dark: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30', light: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  purple: { dark: 'bg-purple-500/10 text-purple-400 border-purple-500/30', light: 'bg-purple-50 text-purple-700 border-purple-200' },
  violet: { dark: 'bg-violet-500/10 text-violet-400 border-violet-500/30', light: 'bg-violet-50 text-violet-700 border-violet-200' },
  indigo: { dark: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', light: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  teal: { dark: 'bg-teal-500/10 text-teal-400 border-teal-500/30', light: 'bg-teal-50 text-teal-700 border-teal-200' },
  slate: { dark: 'bg-slate-500/10 text-slate-400 border-slate-500/30', light: 'bg-slate-100 text-slate-600 border-slate-200' },
};

interface ResourceConfig {
  order: number;
  icon: LucideIcon;
  color: keyof typeof PALETTE;
}

const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  Internet: { order: 1, icon: Globe, color: 'blue' },
  Namespace: { order: 2, icon: Folder, color: 'emerald' },
  Ingress: { order: 3, icon: Route, color: 'rose' },
  Service: { order: 4, icon: Network, color: 'amber' },
  Deployment: { order: 5, icon: Layers, color: 'violet' },
  StatefulSet: { order: 6, icon: Database, color: 'indigo' },
  ReplicaSet: { order: 7, icon: Layers, color: 'blue' },
  Pod: { order: 8, icon: Box, color: 'cyan' },
  HPA: { order: 9, icon: Activity, color: 'fuchsia' },
  ResourceLimit: { order: 10, icon: Gauge, color: 'purple' },
  ConfigMap: { order: 11, icon: Settings, color: 'teal' },
  Secret: { order: 12, icon: Lock, color: 'roseLight' },
  PVC: { order: 13, icon: HardDrive, color: 'orange' },
  Role: { order: 14, icon: ShieldCheck, color: 'indigo' },
};

const ATTACHED_RESOURCE_FIELDS: Record<string, string> = {
  hpas: 'HPA',
  configMaps: 'ConfigMap',
  secrets: 'Secret',
  roles: 'Role',
  resourceLimits: 'ResourceLimit',
};

const scanAttachedItems = (
  nodeData: Record<string, any> | undefined,
  addResource: (type: string, isItem: boolean) => void
) => {
  if (!nodeData) return;

  for (const [key, type] of Object.entries(ATTACHED_RESOURCE_FIELDS)) {
    const list = nodeData[key];
    if (Array.isArray(list)) {
      list.forEach(() => addResource(type, true));
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
    const orderA = RESOURCE_CONFIG[a.name]?.order ?? 99;
    const orderB = RESOURCE_CONFIG[b.name]?.order ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return { resources, totalCards, totalItems };
};

/**
 * Returns Tailwind CSS badge classes corresponding to each resource type and colorMode.
 */
export const getResourceBadgeClasses = (resourceName: string, colorMode: string = 'dark'): string => {
  const colorKey = RESOURCE_CONFIG[resourceName]?.color || 'slate';
  const style = PALETTE[colorKey] || PALETTE.slate;
  return colorMode === 'dark' ? style.dark : style.light;
};

/**
 * Returns a React Lucide icon component matching the resource type.
 */
export const getResourceIcon = (resourceName: string, size: number = 11): React.ReactElement => {
  const IconComponent = RESOURCE_CONFIG[resourceName]?.icon || Box;
  return <IconComponent size={size} />;
};

export interface ResourceBadgeProps {
  readonly resource: DetectedResource;
  readonly colorMode?: string;
  readonly size?: 'sm' | 'md';
}

export const ResourceBadge: React.FC<ResourceBadgeProps> = ({
  resource,
  colorMode = 'dark',
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const iconSize = isSm ? 10 : 11;
  const textSizeClass = isSm ? 'text-[9px]' : 'text-[10px]';
  const title = resource.subtypes && resource.subtypes.length > 0
    ? `${resource.name} (${resource.subtypes.join(', ')})`
    : resource.name;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold border transition-all shadow-xs",
        textSizeClass,
        getResourceBadgeClasses(resource.name, colorMode)
      )}
    >
      {getResourceIcon(resource.name, iconSize)}
      <span>{resource.name}</span>
    </span>
  );
};

export interface ResourceBadgeListProps {
  readonly resources: readonly DetectedResource[];
  readonly colorMode?: string;
  readonly size?: 'sm' | 'md';
  readonly testId?: string;
  readonly prefixKey: string;
  readonly className?: string;
}

export const ResourceBadgeList: React.FC<ResourceBadgeListProps> = ({
  resources,
  colorMode = 'dark',
  size = 'md',
  testId,
  prefixKey,
  className,
}) => {
  if (!resources || resources.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center",
        size === 'sm' ? "gap-1" : "gap-1.5",
        className
      )}
      data-testid={testId}
    >
      {resources.map((res) => (
        <ResourceBadge
          key={`${prefixKey}-res-${res.name}`}
          resource={res}
          colorMode={colorMode}
          size={size}
        />
      ))}
    </div>
  );
};
