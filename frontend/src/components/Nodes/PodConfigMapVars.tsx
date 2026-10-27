import React, { memo } from 'react';
import { K8sNodeData, K8sConfigMapItem } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';

export interface PodConfigMapVarsProps {
  readonly data: K8sNodeData;
  readonly nodeId: string;
}

interface FlattenedConfigMapVar {
  cmId: string;
  cmName: string;
  key: string;
  value: string;
  cmItem: K8sConfigMapItem;
}

const getFlattenedConfigMapVars = (
  configMaps?: K8sConfigMapItem[]
): FlattenedConfigMapVar[] => {
  if (!configMaps || configMaps.length === 0) return [];
  const entries: FlattenedConfigMapVar[] = [];
  for (const cm of configMaps) {
    if (cm.configData && cm.configData.length > 0) {
      for (const item of cm.configData) {
        entries.push({
          cmId: cm.id || cm.name,
          cmName: cm.name,
          key: item.key,
          value: item.value,
          cmItem: cm,
        });
      }
    }
  }
  return entries;
};

export const PodConfigMapVars: React.FC<PodConfigMapVarsProps> = memo(({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const setConfigMapModalTargetNode = useFlowStore((state) => state.setConfigMapModalTargetNode);

  if (data.displaySettings?.configMapVars === false) return null;

  const directCMs = data.configMaps;
  let effectiveCMs = directCMs;
  if ((!effectiveCMs || effectiveCMs.length === 0) && data.parentId) {
    const parent = nodes.find((n) => n.id === data.parentId);
    if (parent?.data?.configMaps) {
      effectiveCMs = parent.data.configMaps;
    }
  }

  const entries = getFlattenedConfigMapVars(effectiveCMs);
  if (entries.length === 0) return null;

  const maxDisplay = 3;
  const displayedEntries = entries.slice(0, maxDisplay);
  const remainingCount = entries.length - maxDisplay;

  const handleOpenInspect = (cmItem: K8sConfigMapItem) => {
    const targetId = (!directCMs || directCMs.length === 0) && data.parentId ? data.parentId : nodeId;
    const targetLabel = (data.label as string) || nodeId;
    setConfigMapModalTargetNode({
      id: targetId,
      label: targetLabel,
      initialItem: cmItem,
    });
  };

  return (
    <div className="mt-1.5 pt-1.5 border-t border-slate-700/30 space-y-1" data-testid="pod-configmap-vars">
      {displayedEntries.map((entry, index) => (
        <div
          key={`pod-cm-var-${entry.cmId}-${entry.key}-${index}`}
          className="flex items-center justify-between text-[9px] font-mono gap-1"
          data-testid={`pod-cm-var-${entry.key}`}
          title={`ConfigMap: ${entry.cmName}`}
        >
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              className={cn(
                "text-[7px] font-bold px-1 py-0.5 rounded uppercase tracking-wider shrink-0 font-sans cursor-pointer transition-colors outline-none",
                colorMode === 'dark'
                  ? "bg-teal-950/80 text-teal-400 border border-teal-500/40 hover:bg-teal-900/80"
                  : "bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-100"
              )}
              title={`Source: ${entry.cmName} (Click to inspect)`}
              aria-label={`Inspect ConfigMap ${entry.cmName}`}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenInspect(entry.cmItem);
              }}
            >
              CM
            </button>
            <span
              className={cn("truncate min-w-0", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}
              title={entry.key}
            >
              {entry.key}:
            </span>
          </div>
          <span
            className={cn(
              "font-bold truncate text-right min-w-0 font-mono",
              colorMode === 'dark' ? "text-teal-400" : "text-teal-600"
            )}
            title={entry.value}
          >
            {entry.value}
          </span>
        </div>
      ))}

      {remainingCount > 0 && (
        <button
          type="button"
          data-testid="pod-cm-more-btn"
          className={cn(
            "text-[8px] italic cursor-pointer hover:underline text-left border-0 bg-transparent p-0 block",
            colorMode === 'dark' ? "text-teal-400/80 hover:text-teal-300" : "text-teal-600 hover:text-teal-700"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenInspect(entries[0].cmItem);
          }}
          title="View all ConfigMap variables"
        >
          + {remainingCount} more...
        </button>
      )}
    </div>
  );
});
