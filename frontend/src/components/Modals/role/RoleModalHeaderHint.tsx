import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for RoleModalHeaderHint component.
 */
export interface RoleModalHeaderHintProps {
  readonly colorMode: string;
}

/**
 * RoleModalHeaderHint renders an educational banner explaining Role vs RoleBinding concepts.
 *
 * @param props RoleModalHeaderHintProps
 * @returns JSX Element
 */
export const RoleModalHeaderHint: React.FC<RoleModalHeaderHintProps> = ({ colorMode }) => (
  <div className={cn(
    "p-3 rounded-xl border flex items-start gap-2.5 text-xs mb-4",
    colorMode === 'dark'
      ? "bg-slate-900 border-slate-700 text-slate-200"
      : "bg-slate-100 border-slate-300 text-slate-900"
  )}>
    <ShieldCheck size={18} className={colorMode === 'dark' ? "text-slate-300 shrink-0 mt-0.5" : "text-slate-700 shrink-0 mt-0.5"} />
    <div className="space-y-1">
      <p className={cn("font-semibold text-[11px] uppercase tracking-wider", colorMode === 'dark' ? "text-slate-300" : "text-slate-800")}>
        💡 Concept: Role vs RoleBinding
      </p>
      <p className="leading-relaxed opacity-90 text-[11px]">
        In Kubernetes RBAC, a <strong>Role</strong> defines <em>WHAT</em> permissions are allowed (API Groups, Resources, Verbs), while a <strong>RoleBinding</strong> specifies <em>WHO</em> (IAM Users / Subjects) receives those permissions.
      </p>
    </div>
  </div>
);
