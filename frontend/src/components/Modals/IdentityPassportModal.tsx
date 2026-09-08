import React from 'react';
import { ShieldCheck, User, Key, CheckCircle2, Lock, FileText, BadgeCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { generateDigitalCertificate } from '../../lib/identityUtils';
import { cn } from '../../lib/utils';

export const IdentityPassportModal: React.FC = () => {
  const isOpen = useFlowStore((state) => state.isIdentityModalOpen);
  const setIsOpen = useFlowStore((state) => state.setIdentityModalOpen);
  const colorMode = useFlowStore((state) => state.colorMode);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const setActiveIdentity = useFlowStore((state) => state.setActiveIdentity);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const nodes = useFlowStore((state) => state.nodes);

  const isDark = colorMode === 'dark';
  const currentUserObj = iamUsers.find((u) => u.username === activeIdentity);
  const cert = generateDigitalCertificate(activeIdentity, currentUserObj);

  // Find attached roles on canvas for active user
  const attachedRoles = React.useMemo(() => {
    const list: Array<{ nodeLabel: string; roleName: string }> = [];
    for (const node of nodes) {
      if (Array.isArray(node.data?.roles)) {
        for (const r of node.data.roles) {
          if (r.assignedUsers?.includes(activeIdentity) || activeIdentity === 'system:admin') {
            list.push({ nodeLabel: node.data.label || node.id, roleName: r.name });
          }
        }
      }
    }
    return list;
  }, [nodes, activeIdentity]);

  const onClose = () => setIsOpen(false);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Digital Identity Passport & Certificate"
      subtitle="Kubernetes Authentication Verification (Who You Are)"
      icon={BadgeCheck}
      iconColorClass="text-emerald-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="max-h-[90vh] h-[80vh]"
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Top bar: Identity Selector */}
        <div className={cn('p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3', isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200')}>
          <div className="flex items-center gap-2">
            <User className="text-emerald-400" size={18} />
            <div>
              <span className={cn('text-xs font-semibold block', isDark ? 'text-slate-200' : 'text-slate-800')}>Active K8s Identity Context:</span>
              <span className="text-[11px] text-slate-400">Select active user/serviceaccount identity</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={activeIdentity}
              onChange={(e) => setActiveIdentity(e.target.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg border outline-none cursor-pointer transition-colors',
                isDark ? 'bg-slate-900 border-slate-700 text-emerald-400 focus:border-emerald-500' : 'bg-white border-slate-300 text-emerald-600 focus:border-emerald-500'
              )}
            >
              <option value="system:admin">system:admin (Cluster Administrator)</option>
              {iamUsers.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.username} ({u.accessType})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Passport Card Visual */}
        <div className={cn(
          'relative p-5 rounded-2xl border shadow-xl overflow-hidden transition-all',
          isDark
            ? 'bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900 border-emerald-500/30'
            : 'bg-gradient-to-br from-emerald-50/80 via-white to-slate-50 border-emerald-300'
        )}>
          {/* Background seal watermark */}
          <ShieldCheck size={180} className={cn('absolute -right-8 -bottom-8 opacity-5 pointer-events-none', isDark ? 'text-emerald-400' : 'text-emerald-700')} />

          {/* Passport Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <BadgeCheck size={22} />
              </div>
              <div>
                <h3 className={cn('text-sm font-bold tracking-wide uppercase', isDark ? 'text-slate-100' : 'text-slate-900')}>
                  KUBERNETES DIGITAL PASSPORT
                </h3>
                <p className="text-[10px] text-emerald-500 font-mono">CLIENT X.509 CERTIFICATE / BEARER TOKEN</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-[10px]">
              <CheckCircle2 size={12} className="animate-pulse" />
              {cert.status}
            </div>
          </div>

          {/* Grid Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Identity Username (CN)</span>
                <span className={cn('font-mono font-bold text-sm', isDark ? 'text-emerald-300' : 'text-emerald-700')}>{cert.user}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">X.509 Subject Distinguished Name</span>
                <span className="font-mono text-[11px] text-slate-300 block bg-slate-950/40 p-1.5 rounded border border-slate-800 break-all">{cert.subject}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Authentication Type</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Key size={13} className="text-amber-400" />
                  <span className="font-semibold text-amber-300">{cert.authType}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Cluster CA Issuer</span>
                <span className="font-mono text-[11px] text-slate-300 block bg-slate-950/40 p-1.5 rounded border border-slate-800 break-all">{cert.issuer}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Digital Signature & Fingerprint</span>
                <span className="font-mono text-[10px] text-emerald-400 block bg-slate-950/50 p-1.5 rounded border border-slate-800/80 break-all">{cert.tokenSignature}</span>
                <span className="font-mono text-[9px] text-slate-500 block mt-1">Serial: {cert.serialNumber}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Educational Concept Banner */}
        <div className={cn('p-3.5 rounded-xl border flex items-start gap-3', isDark ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900')}>
          <Lock className="text-indigo-400 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-1">
            <p className="font-bold">Bagaimana Kubernetes Memeriksa Identitas Ini?</p>
            <p className="text-[11px] leading-relaxed opacity-90">
              API Server tidak pernah meminta password. Setiap kali Anda menjalankan perintah <code className="px-1 py-0.5 rounded bg-indigo-500/20 font-mono text-[10px]">kubectl</code>, sistem langsung memverifikasi paspor/sertifikat digital di atas. Jika sah, K8s mengambil nama identitas (<code className="font-semibold text-emerald-400">{cert.user}</code>) dan mengecek file <strong>Role / RoleBinding</strong> yang terhubung.
            </p>
          </div>
        </div>

        {/* Attached Permissions & Roles Section */}
        <div className={cn('p-4 rounded-xl border flex-1 overflow-y-auto', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200')}>
          <h4 className={cn('text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
            <FileText size={14} className="text-emerald-400" />
            Effective Permissions & Canvas Role Bindings ({activeIdentity === 'system:admin' ? 'Full Access (*)' : attachedRoles.length})
          </h4>

          {activeIdentity === 'system:admin' ? (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck size={16} /> Cluster Administrator (system:masters)
              </p>
              <p className="text-[11px] text-slate-300">
                Identitas ini memiliki hak akses penuh tanpa batas ke seluruh API Group, resource, dan namespace cluster Kubernetes.
              </p>
            </div>
          ) : currentUserObj ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {currentUserObj.policies.map((p) => (
                  <span key={p.name} className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-300 text-[11px] font-medium">
                    {p.name}: {p.description}
                  </span>
                ))}
              </div>

              {attachedRoles.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Attached Canvas Node Roles:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {attachedRoles.map((r, i) => (
                      <span key={`${r.nodeLabel}-${r.roleName}-${i}`} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px]">
                        {r.roleName} <span className="text-slate-400">({r.nodeLabel})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Identitas ini belum memiliki IAM policy atau RoleBinding yang terikat.</p>
          )}
        </div>
      </div>
    </Modal>
  );
};
