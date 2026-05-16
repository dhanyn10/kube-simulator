import React from 'react';
import { cn } from '../../lib/utils';

interface NodePodBadgesProps {
  data: any;
}

export const NodePodBadges = ({ data }: NodePodBadgesProps) => {
  if (data.type !== 'Pod') return null;

  const showRuntime = data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none';
  const showWebserver = data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none';

  if (!showRuntime && !showWebserver) return null;

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
