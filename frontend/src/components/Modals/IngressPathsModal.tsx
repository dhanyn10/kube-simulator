import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Server, AlertTriangle } from 'lucide-react';
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
  readonly isDuplicate: boolean;
  readonly onUpdate: (id: string, updates: Partial<IngressPathRule>) => void;
  readonly onDelete: (id: string) => void;
}

export const normalizeIngressPath = (rawPath: string): string => {
  const trimmed = rawPath.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export const resolveIngressClusterIpServices = (
  ingressNode: any,
  nodes: any[]
): { clusterIpServices: any[]; availableServiceNames: string[] } => {
  const selectedNamespaceId = ingressNode?.parentId || ingressNode?.data?.parentId || null;
  const clusterIpServices = nodes.filter((n) => {
    if (n.type !== 'Service' || (n.data?.serviceType || 'ClusterIP') !== 'ClusterIP') {
      return false;
    }
    if (!selectedNamespaceId) {
      return !n.parentId || n.parentId === '';
    }
    return n.parentId === selectedNamespaceId;
  });

  const availableServiceNames = Array.from(
    new Set(
      clusterIpServices
        .map((n) => (n.data?.label as string) || n.id)
        .filter(Boolean)
    )
  );

  return { clusterIpServices, availableServiceNames };
};

const getDuplicatePaths = (rules: IngressPathRule[]): Set<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const r of rules) {
    const normalized = normalizeIngressPath(r.path || '/');
    if (seen.has(normalized)) {
      duplicates.add(normalized);
    } else {
      seen.add(normalized);
    }
  }
  return duplicates;
};

const getInputThemeClass = (colorMode: 'dark' | 'light', isDuplicate = false): string => {
  if (isDuplicate) {
    return colorMode === 'dark'
      ? 'bg-slate-950 border-amber-500/80 text-amber-200 focus:border-amber-400'
      : 'bg-amber-50/40 border-amber-500 text-slate-900 focus:border-amber-600';
  }
  return colorMode === 'dark'
    ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-rose-500'
    : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500';
};

const PathRowItem: React.FC<PathRowItemProps> = ({
  row,
  index,
  colorMode,
  availableServiceNames,
  canDelete,
  isDuplicate,
  onUpdate,
  onDelete,
}) => {
  const currentPathType = row.pathType || 'Prefix';
  const nextPathType = currentPathType === 'Prefix' ? 'Exact' : 'Prefix';

  return (
    <div
      className={cn(
        "p-3 rounded-lg border flex flex-col sm:flex-row items-stretch sm:items-center gap-3 transition-colors",
        colorMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
      )}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`path-input-${row.id}`}
            className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          >
            Path #{index + 1}
          </label>
          <button
            type="button"
            onClick={() => onUpdate(row.id, { pathType: nextPathType })}
            aria-label={`Path type ${currentPathType} for path ${index + 1}`}
            title="Click to toggle between Prefix and Exact path matching"
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border transition-colors cursor-pointer",
              currentPathType === 'Exact'
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
            )}
          >
            {currentPathType}
          </button>
        </div>
        <div className="relative">
          <input
            id={`path-input-${row.id}`}
            type="text"
            value={row.path}
            onChange={(e) => onUpdate(row.id, { path: e.target.value })}
            onBlur={() => onUpdate(row.id, { path: normalizeIngressPath(row.path) })}
            placeholder="/api"
            className={cn(
              "w-full px-3 py-1.5 rounded-md border text-xs font-mono transition-colors",
              getInputThemeClass(colorMode, isDuplicate)
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
            getInputThemeClass(colorMode)
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
            getInputThemeClass(colorMode)
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

  const { clusterIpServices, availableServiceNames } = resolveIngressClusterIpServices(ingressNode, nodes);

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
          pathType: 'Prefix',
          serviceName: primarySvc,
          servicePort: primaryPort,
        },
      ]);
    }
  }, [isOpen, ingressNode]);

  if (!isOpen) return null;

  const duplicatePaths = getDuplicatePaths(pathRules);
  const hasDuplicates = duplicatePaths.size > 0;

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
        pathType: 'Prefix',
        serviceName: defaultSvc,
        servicePort: defaultPort,
      },
    ]);
  };

  const handleSave = () => {
    if (hasDuplicates) return;
    const normalizedRules = pathRules.map((rule) => ({
      ...rule,
      path: normalizeIngressPath(rule.path),
      pathType: rule.pathType || 'Prefix',
    }));
    onSave(normalizedRules);
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
          disabled={hasDuplicates}
          onClick={handleSave}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-md transition-all",
            hasDuplicates
              ? "bg-slate-700 opacity-50 cursor-not-allowed"
              : "bg-rose-600 hover:bg-rose-500 cursor-pointer"
          )}
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

        {hasDuplicates && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Duplicate path detected. Each path rule on the same host must be unique.</span>
          </div>
        )}

        {pathRules.map((row, idx) => (
          <PathRowItem
            key={`ingress-path-${row.id}`}
            row={row}
            index={idx}
            colorMode={colorMode}
            availableServiceNames={availableServiceNames}
            canDelete={pathRules.length > 1}
            isDuplicate={duplicatePaths.has(normalizeIngressPath(row.path || '/'))}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </Modal>
  );
};
