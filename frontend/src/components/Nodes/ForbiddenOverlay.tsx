import React from 'react';
import { Lock } from 'lucide-react';
import { useFlowStore } from '@/store';
import { isNodeAccessForbidden } from '@/activities/nodes/rbacNodeHelpers';
import { K8sNodeData } from '@/types';

export const ForbiddenOverlay = ({ nodeType, data }: { readonly nodeType?: string; readonly data?: K8sNodeData }) => {
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const nodes = useFlowStore((state) => state.nodes);

  const isForbidden = isNodeAccessForbidden(activeIdentity, iamUsers, nodeType, data, nodes);

  if (!isForbidden) return null;

  return (
    <div
      data-testid="forbidden-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-lg bg-red-950/45 backdrop-blur-[1.5px] border-2 border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-not-allowed p-2 transition-all duration-200 select-none pointer-events-auto"
      title={`Access Forbidden for user "${activeIdentity}"`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600/90 text-white font-bold text-[9px] tracking-wider uppercase shadow-md animate-pulse">
        <Lock size={12} className="text-white shrink-0" />
        <span>Access Forbidden</span>
      </div>
      <span className="mt-1 text-[8px] font-semibold text-red-200/90 text-center line-clamp-1 max-w-[90%]">
        User: {activeIdentity}
      </span>
    </div>
  );
};
