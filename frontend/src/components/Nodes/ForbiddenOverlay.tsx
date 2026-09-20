import React from 'react';
import { Lock } from 'lucide-react';
import { useFlowStore } from '@/store';
import { isNodeAccessForbidden } from '@/activities/nodes/rbacNodeHelpers';
import { K8sNodeData } from '@/types';

/**
 * Renders a visual forbidden overlay on non-accessible canvas node cards when the active IAM identity
 * lacks required permissions.
 */
export const ForbiddenOverlay = ({ nodeType, data }: { readonly nodeType?: string; readonly data?: K8sNodeData }) => {
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const nodes = useFlowStore((state) => state.nodes);

  const isForbidden = isNodeAccessForbidden(activeIdentity, iamUsers, nodeType, data, nodes);

  if (!isForbidden) return null;

  return (
    <section
      aria-label={`Access Restricted for user ${activeIdentity}`}
      data-testid="forbidden-overlay"
      className="absolute inset-0 z-50 flex items-start justify-end p-1.5 rounded-lg bg-slate-950/20 backdrop-grayscale backdrop-contrast-50 border border-slate-500/30 cursor-not-allowed transition-all duration-200 select-none pointer-events-auto outline-none"
      title={`Restricted Access for user "${activeIdentity}"`}
    >
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/80 font-semibold text-[8px] tracking-tight uppercase shadow-sm">
        <Lock size={10} className="text-amber-400 shrink-0" />
        <span>Restricted</span>
      </div>
    </section>
  );
};
