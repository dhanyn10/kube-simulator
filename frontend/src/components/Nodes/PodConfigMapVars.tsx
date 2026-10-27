import React, { memo } from 'react';
import { Settings } from 'lucide-react';
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

  const parent = data.parentId ? nodes.find((n) => n.id === data.parentId) : null;
  const effectiveDisplaySettings = data.displaySettings ?? parent?.data?.displaySettings;
  if (effectiveDisplaySettings?.configMapVars === false) return null;

  const directCMs = data.configMaps;
  let effectiveCMs = directCMs;
  if ((!effectiveCMs || effectiveCMs.length === 0) && parent?.data?.configMaps) {
    effectiveCMs = parent.data.configMaps;
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
        >
          <div className="flex items-center gap-1 min-w-0">
            <div className="relative group/cm-badge inline-flex items-center shrink-0">
              <button
                type="button"
                className={cn(
                  "p-0.5 rounded shrink-0 cursor-pointer transition-colors outline-none flex items-center justify-center",
                  colorMode === 'dark'
                    ? "bg-teal-950/80 text-teal-400 border border-teal-500/40 hover:bg-teal-900/80 hover:text-teal-300"
                    : "bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-100 hover:text-teal-800"
                )}
                aria-label={`Inspect ConfigMap ${entry.cmName}`}
                data-testid={`pod-cm-badge-${entry.key}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenInspect(entry.cmItem);
                }}
              >
                <Settings size={9} className="shrink-0" />
              </button>

              {/* Hover Card Popover */}
              <div
                role="tooltip"
                data-testid={`pod-cm-card-${entry.key}`}
                className={cn(
                  "absolute bottom-full left-0 mb-1.5 hidden group-hover/cm-badge:flex flex-col z-50 min-w-[130px] rounded-md shadow-xl border overflow-hidden pointer-events-none transition-all duration-150",
                  colorMode === 'dark'
                    ? "bg-slate-900 border-slate-700 text-slate-200 shadow-black/60"
                    : "bg-white border-slate-200 text-slate-800 shadow-slate-400/40"
                )}
              >
                {/* Card Header */}
                <div
                  className={cn(
                    "px-2 py-1 text-[8px] font-bold tracking-wider flex items-center gap-1 border-b uppercase",
                    colorMode === 'dark'
                      ? "bg-slate-800/80 text-teal-400 border-slate-700"
                      : "bg-teal-50 text-teal-800 border-teal-100"
                  )}
                  data-testid="pod-cm-card-header"
                >
                  <Settings size={9} className="shrink-0" />
                  <span>ConfigMap</span>
                </div>

                {/* Card Body */}
                <div className="px-2 py-1.5 text-[8.5px] font-mono" data-testid="pod-cm-card-body">
                  <span className={cn("font-bold truncate select-all block", colorMode === 'dark' ? "text-slate-200" : "text-slate-700")}>
                    {entry.cmId}
                  </span>
                </div>
              </div>
            </div>

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
