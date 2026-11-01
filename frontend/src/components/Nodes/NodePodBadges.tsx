import { getPodBadgeVisibility } from '@/activities/nodes';
import { getAssignedWorker, WORKER_NODES } from '@/lib/workerNodeHelpers';
import { cn } from '@/lib/utils';

interface NodePodBadgesProps {
  data: any;
  nodeId?: string;
}

export const NodePodBadges = ({ data, nodeId }: NodePodBadgesProps) => {
  const { showRuntime, showWebserver, showNodeBadge, hasAnyBadge } = getPodBadgeVisibility(data);

  if (!hasAnyBadge) return null;

  const assignedWorker = getAssignedWorker(data, nodeId);
  const workerInfo = WORKER_NODES[assignedWorker];

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0 max-w-full overflow-hidden">
      {showNodeBadge && (
        <span
          className={cn(
            'min-w-0 max-w-full truncate text-[8px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wider whitespace-nowrap inline-flex items-center gap-1',
            workerInfo.badgeBg,
            workerInfo.badgeText,
            workerInfo.badgeBorder
          )}
          title={`Worker Node: ${workerInfo.name} (${workerInfo.ip})`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          {workerInfo.name}
        </span>
      )}
      {showRuntime && (
        <span className="min-w-0 max-w-full truncate text-[7px] px-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase font-bold whitespace-nowrap">
          {data.runtime}
        </span>
      )}
      {showWebserver && (
        <span className="min-w-0 max-w-full truncate text-[7px] px-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 uppercase font-bold whitespace-nowrap">
          {data.webserver}
        </span>
      )}
    </div>
  );
};
