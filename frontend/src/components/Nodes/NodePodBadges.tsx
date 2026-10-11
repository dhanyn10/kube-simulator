import { getPodBadgeVisibility } from '@/activities/nodes';

interface NodePodBadgesProps {
  data: any;
}

export const NodePodBadges = ({ data }: NodePodBadgesProps) => {
  const { showRuntime, showWebserver, hasAnyBadge } = getPodBadgeVisibility(data);

  if (!hasAnyBadge) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0 max-w-full overflow-hidden">
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
