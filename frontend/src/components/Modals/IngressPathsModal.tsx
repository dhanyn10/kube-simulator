import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Server } from 'lucide-react';
import { Modal } from './Modal';
import { IngressPathRule } from '@/types';
import { useFlowStore } from '@/store';
import { cn, safeRandom } from '@/lib/utils';

interface IngressPathsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly ingressNode: any;
  readonly onSave: (paths: IngressPathRule[]) => void;
}

interface PathRowItemProps {
  readonly row: IngressPathRule;
  readonly index: number;
  readonly colorMode: 'dark' | 'light';
  readonly availableServiceNames: string[];
  readonly canDelete: boolean;
  readonly onUpdate: (id: string, updates: Partial<IngressPathRule>) => void;
  readonly onDelete: (id: string) => void;
}

const PathRowItem: React.FC<PathRowItemProps> = ({
  row,
  index,
  colorMode,
  availableServiceNames,
  canDelete,
  onUpdate,
  onDelete,
}) => {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border flex flex-col sm:flex-row items-stretch sm:items-center gap-3 transition-colors",
        colorMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
      )}
    >
      <div className="flex-1 space-y-1">
        <label
          htmlFor={`path-input-${row.id}`}
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
        >
          Path #{index + 1}
        </label>
        <div className="relative">
          <input
            id={`path-input-${row.id}`}
            type="text"
            value={row.path}
            onChange={(e) => onUpdate(row.id, { path: e.target.value })}
            placeholder="/api"
            className={cn(
              "w-full px-3 py-1.5 rounded-md border text-xs font-mono transition-colors",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-rose-500"
                : "bg-white border-slate-300 text-slate-900 focus:border-rose-500"
            )}
          />
        </div>
      </div>

      <div className="flex-1 space-y-1">
        <label
          htmlFor={`service-select-${row.id}`}
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1"
        >
          <Server size={10} /> Target Service
        </label>
        <select
          id={`service-select-${row.id}`}
          value={row.serviceName || ''}
          onChange={(e) => onUpdate(row.id, { serviceName: e.target.value })}
          className={cn(
            "w-full px-3 py-1.5 rounded-md border text-xs font-mono transition-colors cursor-pointer",
            colorMode === 'dark'
              ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-rose-500"
              : "bg-white border-slate-300 text-slate-900 focus:border-rose-500"
          )}
        >
          {availableServiceNames.length === 0 ? (
            <option value="">No ClusterIP Services</option>
          ) : (
            availableServiceNames.map((svcName) => (
              <option key={`service-opt-${row.id}-${svcName}`} value={svcName}>
                {svcName}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="w-24 space-y-1">
        <label
          htmlFor={`port-input-${row.id}`}
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
        >
          Port
        </label>
        <input
          id={`port-input-${row.id}`}
          type="number"
          value={row.servicePort || 80}
          onChange={(e) => onUpdate(row.id, { servicePort: Number(e.target.value) || 80 })}
          className={cn(
            "w-full px-3 py-1.5 rounded-md border text-xs font-mono transition-colors",
            colorMode === 'dark'
              ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-rose-500"
              : "bg-white border-slate-300 text-slate-900 focus:border-rose-500"
          )}
        />
      </div>

      <div className="flex items-center sm:self-end sm:mb-1">
        <button
          type="button"
          disabled={!canDelete}
          onClick={() => onDelete(row.id)}
          aria-label={`Delete path ${row.path}`}
          className={cn(
            "p-2 rounded-md transition-colors",
            canDelete
              ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
              : "text-slate-600 opacity-40 cursor-not-allowed"
          )}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

export const IngressPathsModal: React.FC<IngressPathsModalProps> = ({
  isOpen,
  onClose,
  ingressNode,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);

  const selectedNamespaceId = ingressNode?.parentId || ingressNode?.data?.parentId || null;
  const inSameNamespace = (n: any) => {
    if (!selectedNamespaceId) {
      return !n.parentId || n.parentId === '';
    }
    return n.parentId === selectedNamespaceId;
  };

  const clusterIpServices = nodes.filter(
    (n) => n.type === 'Service' && (n.data?.serviceType || 'ClusterIP') === 'ClusterIP' && inSameNamespace(n)
  );

  const availableServiceNames = Array.from(
    new Set(
      clusterIpServices
        .map((n) => (n.data?.label as string) || n.id)
        .filter(Boolean)
    )
  );

  const getServicePortByName = (svcName: string): number => {
    const matched = clusterIpServices.find(
      (n) => ((n.data?.label as string) || n.id) === svcName
    );
    return Number(matched?.data?.port) || 80;
  };

  const [pathRules, setPathRules] = useState<IngressPathRule[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const existing = ingressNode?.data?.ingressPaths;
    if (Array.isArray(existing) && existing.length > 0) {
      setPathRules(existing);
    } else {
      const primaryPath = ingressNode?.data?.ingressPath || '/';
      const primarySvc = ingressNode?.data?.backendServiceName || availableServiceNames[0] || '';
      const primaryPort = Number(ingressNode?.data?.servicePort || getServicePortByName(primarySvc));
      setPathRules([
        {
          id: safeRandom().toString(36).slice(2, 9),
          path: primaryPath,
          serviceName: primarySvc,
          servicePort: primaryPort,
        },
      ]);
    }
  }, [isOpen, ingressNode]);

  if (!isOpen) return null;

  const handleUpdate = (id: string, updates: Partial<IngressPathRule>) => {
    const resolvedUpdates =
      updates.serviceName !== undefined && updates.servicePort === undefined
        ? { ...updates, servicePort: getServicePortByName(updates.serviceName) }
        : updates;
    setPathRules((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...resolvedUpdates } : item))
    );
  };

  const handleDelete = (id: string) => {
    setPathRules((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAdd = () => {
    const defaultSvc = availableServiceNames[0] || '';
    const defaultPort = getServicePortByName(defaultSvc);
    setPathRules((prev) => [
      ...prev,
      {
        id: safeRandom().toString(36).slice(2, 9),
        path: `/path-${prev.length + 1}`,
        serviceName: defaultSvc,
        servicePort: defaultPort,
      },
    ]);
  };

  const handleSave = () => {
    onSave(pathRules);
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          colorMode === 'dark'
            ? "border-slate-700 hover:bg-slate-800 text-rose-400"
            : "border-slate-300 hover:bg-slate-100 text-rose-600"
        )}
      >
        <Plus size={14} /> Add Path
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
            colorMode === 'dark'
              ? "border-slate-700 hover:bg-slate-800 text-slate-300"
              : "border-slate-300 hover:bg-slate-100 text-slate-700"
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all cursor-pointer"
        >
          Save Paths
        </button>
      </div>
    </div>
  );

  const host = ingressNode?.data?.ingressHost || 'example.local';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Ingress Routing Paths"
      subtitle={`Configure host and path rules for ${host}`}
      icon={Globe}
      iconColorClass="text-rose-400"
      widthClass="w-full max-w-2xl"
      maxHeightClass="h-[75vh]"
      footer={footer}
    >
      <div className="space-y-3 p-1">
        <div className="text-xs text-slate-400">
          Define multiple URL paths routed to specific backend ClusterIP services.
        </div>

        {pathRules.map((row, idx) => (
          <PathRowItem
            key={`ingress-path-${row.id}`}
            row={row}
            index={idx}
            colorMode={colorMode}
            availableServiceNames={availableServiceNames}
            canDelete={pathRules.length > 1}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </Modal>
  );
};
