import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AttachedResourcesFooter } from './AttachedResourcesFooter';
import { K8sNodeData } from '@/types';
import { cn } from '@/lib/utils';
import { QuickConnectArrows } from './QuickConnectArrows';
import { NodeActionButtons, NodeRenameInput } from './NodeUI';
import { NodePodBadges } from './NodePodBadges';
import { ForbiddenOverlay } from './ForbiddenOverlay';
import { useBaseNodeHandler, getProgressSegmentStyles, getMegaCircleDashArray } from '@/activities/nodes';

/**
 * Sub-component for rendering pod status indicators (dot, pinging, or pending).
 */
const NodeStatusIndicator = ({ type, statusDotColor }: { type: string; statusDotColor: string }) => {
  if (type === 'Internet' || type === 'PVC') return null;
  return <div className={cn("w-1.5 h-1.5 rounded-full", statusDotColor)}></div>;
};

/**
 * Sub-component for rendering replica progress indicator bars and mega-pod circular gauges.
 * Highlights the specific segment corresponding to `hoveredPodIndex` in blue when targeted
 * via terminal autocomplete or CLI command execution.
 *
 * @param props - Component parameters including node ID, replicas count, color mode, and hover state.
 */
const ReplicaProgress = ({
  id,
  replicas,
  showDashedProgress,
  colorMode,
  progressEmptyBgClass,
  isAutocompleteHovered,
  hoveredPodIndex,
}: {
  id: string;
  replicas: number;
  showDashedProgress: boolean;
  colorMode: string;
  progressEmptyBgClass: string;
  isAutocompleteHovered?: boolean;
  hoveredPodIndex?: number | null;
}) => {
  if (!showDashedProgress) return null;

  const isMega = replicas === 100;
  const strokeDashArray = getMegaCircleDashArray(16, 10, 0.7);

  const activeBarClass = 'bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]';
  const highlightedBarClass = 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]';

  const activeCircleStrokeClass = 'text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  const highlightedCircleStrokeClass = 'text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';

  const activeCircleTextClass = 'absolute text-[8px] font-black text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]';
  const highlightedCircleTextClass = 'absolute text-[8px] font-black text-blue-500 drop-shadow-[0_0_3px_rgba(59,130,246,0.4)]';

  const circleBgClass = colorMode === 'dark' ? 'text-slate-700/50' : 'text-slate-200';

  const megaHighlightedGaugeIndex =
    hoveredPodIndex !== null && hoveredPodIndex !== undefined && hoveredPodIndex >= 0
      ? Math.floor(hoveredPodIndex / 10)
      : -1;

  return (
    <div className={cn("flex gap-0.5 w-full items-center pb-1", isMega ? "h-auto" : "h-1")}>
      {isMega ? (
        <div className="grid grid-cols-5 gap-x-2 gap-y-4 w-full py-4 px-1">
          {Array.from({ length: 10 }).map((_, i) => {
            const segmentId = `${id}-mega-progress-${i}`;
            const isGaugeHighlighted = Boolean(
              isAutocompleteHovered && (i === megaHighlightedGaugeIndex || megaHighlightedGaugeIndex === -1)
            );
            return (
              <div key={segmentId} className="flex flex-col items-center gap-1">
                <div className="relative flex items-center justify-center w-10 h-10">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" fill="transparent"
                      strokeDasharray={strokeDashArray}
                      className={circleBgClass}
                    />
                    <circle
                      cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2.5" fill="transparent"
                      strokeDasharray={strokeDashArray}
                      strokeDashoffset={0} strokeLinecap="round"
                      className={isGaugeHighlighted ? highlightedCircleStrokeClass : activeCircleStrokeClass}
                    />
                  </svg>
                  <span className={isGaugeHighlighted ? highlightedCircleTextClass : activeCircleTextClass}>10</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        Array.from({ length: 10 }).map((_, i) => {
          const isFilled = i < (replicas || 0);
          let isHighlighted = false;
          if (isFilled && isAutocompleteHovered) {
            if (hoveredPodIndex !== null && hoveredPodIndex !== undefined && hoveredPodIndex >= 0) {
              isHighlighted = i === hoveredPodIndex;
            } else {
              isHighlighted = true;
            }
          }

          const segClass = !isFilled
            ? progressEmptyBgClass
            : isHighlighted
            ? highlightedBarClass
            : activeBarClass;

          return (
            <div
              key={`${id}-progress-${i}`}
              className={cn("flex-1 h-1 rounded-sm transition-all", segClass)}
            />
          );
        })
      )}
    </div>
  );
};

export const BaseNode = memo(({ children, data, selected, title, icon: Icon, color, id, hideSettings, statusOverride }: {
  children?: React.ReactNode;
  data: K8sNodeData;
  selected?: boolean;
  title: string;
  icon: any;
  color: string;
  id: string;
  type: string;
  hideSettings?: boolean;
  statusOverride?: 'pending' | 'ready' | 'crashing';
}) => {
  const {
    colorMode,
    transitionClasses,
    isEditing,
    setIsEditing,
    editValue,
    setEditValue,
    inputRef,
    handleRename,
    onKeyDown,
    isPending,
    isReady,
    isCrashing,
    statusIconColor,
    statusTextColor,
    statusDotColor,
    containerClasses,
    progressEmptyBgClass,
    replicas,
    showDashedProgress,
    isAutocompleteHovered,
    hoveredPodIndex,
    borderColorHex,
    displayLabel,
  } = useBaseNodeHandler({ id, data, selected, color, statusOverride });

  return (
    <div className={cn(containerClasses, transitionClasses, "transition-[border-color,background-color,box-shadow] duration-200 relative")}>
      <ForbiddenOverlay nodeType={data.type || title} data={data} />
      {isAutocompleteHovered && (
        <svg className="traffic-line absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
          <rect
            x="0" y="0"
            width="100%"
            height="100%"
            rx="8"
            fill="none"
            stroke={borderColorHex}
            strokeWidth="2.5"
            strokeDasharray="6 4"
            className="traffic-line"
          />
        </svg>
      )}
      {replicas > 1 && (
        <div className={cn("absolute -right-1.5 -top-1.5 w-full h-full border-2 rounded-lg -z-10", colorMode === 'dark' ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-300")} />
      )}

      <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; border-color: rgba(239, 68, 68, 0.5); } 50% { opacity: 0.8; border-color: rgba(239, 68, 68, 1); } }
        @keyframes crash-blink { 0%, 100% { opacity: 1; transform: scale(1); background-color: rgba(220, 38, 38, 0.1); } 50% { opacity: 0.5; transform: scale(0.98); background-color: rgba(220, 38, 38, 0.4); } }
        .animate-pulse-slow { animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-crash-blink { animation: crash-blink 0.4s ease-in-out infinite; }
      `}</style>
      <QuickConnectArrows nodeId={id} color={color} />

      <div className="flex items-center justify-between gap-2 mb-2 shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {Icon && <Icon size={12} className={cn(statusIconColor)} />}
          <span className={cn("text-[8px] font-bold tracking-widest uppercase shrink-0", statusTextColor)}>
            {isCrashing ? 'Crashing' : title || data.type}
          </span>
          <NodeStatusIndicator type={data.type} statusDotColor={statusDotColor} />
          {replicas > 1 && (
            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0", colorMode === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-500 text-white")}>
              x{replicas}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPending && <AlertCircle size={10} className="text-red-500" />}
          {isReady && <CheckCircle2 size={10} className="text-emerald-500" />}
          <NodeActionButtons id={id} onDelete={data.onDelete} colorMode={colorMode} hideSettings={hideSettings} />
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
        <div className="flex flex-col gap-1.5 min-w-0">
          <NodeRenameInput
            isEditing={isEditing} setIsEditing={setIsEditing} editValue={editValue} setEditValue={setEditValue}
            inputRef={inputRef} handleRename={handleRename} onKeyDown={onKeyDown} colorMode={colorMode}
            label={displayLabel} className="w-full min-w-0 max-w-full"
          />

          <ReplicaProgress id={id} replicas={replicas} showDashedProgress={showDashedProgress} colorMode={colorMode} progressEmptyBgClass={progressEmptyBgClass} isAutocompleteHovered={isAutocompleteHovered} hoveredPodIndex={hoveredPodIndex} />
          <NodePodBadges data={data} />
        </div>
        <div className="flex-1 flex flex-col gap-1.5 shrink-0 min-w-0">{children}</div>

        <AttachedResourcesFooter data={data} />
      </div>

      <Handle type="target" position={Position.Top} id="top-t" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
      <Handle type="source" position={Position.Top} id="top-s" className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`)} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`)} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
      <Handle type="target" position={Position.Left} id="left-t" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
      <Handle type="source" position={Position.Left} id="left-s" className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`)} />
      <Handle type="target" position={Position.Right} id="right-t" className={cn("!w-2 !h-2 !border-none !opacity-0", `!bg-${color}-500`)} />
      <Handle type="source" position={Position.Right} id="right-s" className={cn("!w-2 !h-2 !border-none", `!bg-${color}-500`)} />
    </div>
  );
});
