import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { Modal } from './Modal';
import { K8sSecretItem } from '@/types';
import { useFlowStore } from '@/store';
import { getActiveProfileName } from '@/store/useFlowStore';
import { cn, sanitizeSlug } from '@/lib/utils';
import { KeyValueFormSection } from './KeyValueFormSection';
import { useSecretModal } from '@/activities/modals/useSecretModal';
import {
  buildSecretItem,
  findAllAttachedSecretComponents,
  syncNodesSecret,
  mergeAttachedSecretComponents,
  removeSecretFromNodeOrStore,
  getAvailableWorkloadComponents,
  appendTargetComponentOption,
  extractUniqueRawItems,
} from '@/activities/modals/secretModalHelpers';
import {
  OverviewItem,
  extractAllOverviewItems,
  filterOverviewItems,
} from '@/activities/modals/attachedResourceOverviewHelpers';
import { getPodReplicaGroupInfo } from '@/activities/modals/configMapModalHelpers';
import { ConfigMapComponentSection, ComponentOption } from './ConfigMapComponentSection';
import { SecretImportDataDropdown } from './SecretImportDataDropdown';
import { SecretListView } from './SecretListView';
import { ResourcePrecedenceView } from './ResourcePrecedenceView';
import { ResourceModalFooter } from './ResourceModalFooter';
import { useOutsideMouseDown } from '@/hooks/useOutsideMouseDown';

export type SecretModalMode = 'form' | 'list' | 'profile';

export interface SecretModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly targetNodeLabel?: string;
  readonly initialSecret?: K8sSecretItem | null;
  readonly initialViewMode?: 'form' | 'list';
  readonly onSave: (secretItem: K8sSecretItem) => void;
}

export { findAllAttachedSecretComponents, syncNodesSecret, mergeAttachedSecretComponents, removeSecretFromNodeOrStore };


export const SecretModal: React.FC<SecretModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialSecret,
  initialViewMode,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const isDark = colorMode === 'dark';
  const nodes = useFlowStore((state) => state.nodes);
  const currentProject = useFlowStore((state) => state.currentProject);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);
  const savedSecrets = useFlowStore((state) => state.savedSecrets);
  const deleteSavedSecret = useFlowStore((state) => state.deleteSavedSecret);

  const [mode, setMode] = useState<SecretModalMode>('form');
  const [activeItem, setActiveItem] = useState<K8sSecretItem | null>(initialSecret || null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const {
    secretId,
    secretName,
    setSecretName,
    secretType,
    setSecretType,
    dataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    loadSecret,
    getValidData,
  } = useSecretModal(isOpen, targetNodeId, initialSecret, onSave, onClose) as any;

  const [attachedComponents, setAttachedComponents] = useState<ComponentOption[]>([]);
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialViewMode === 'list') {
      setMode('list');
    } else {
      setMode('form');
    }
  }, [isOpen, initialViewMode, initialSecret?.id]);

  const currentProfileName = getActiveProfileName(currentProject);
  const allItems = useMemo(
    () => extractAllOverviewItems(nodes, 'Secret', savedSecrets, currentProfileName),
    [nodes, savedSecrets, currentProfileName]
  );
  const filteredItems = useMemo(
    () => filterOverviewItems(allItems, search, 'Secret'),
    [allItems, search]
  );

  const profileItems = useMemo(() => {
    const targetProfile = selectedProfile || currentProfileName;
    return allItems.filter((item) => {
      const pName = item.profileName && item.profileName !== 'Default Profile'
        ? item.profileName
        : currentProfileName;
      return pName === targetProfile;
    });
  }, [allItems, selectedProfile, currentProfileName]);

  const availableComponents = useMemo(() => getAvailableWorkloadComponents(nodes), [nodes]);

  const existingSecrets = useMemo(
    () => extractUniqueRawItems<K8sSecretItem>(allItems, activeItem?.id || initialSecret?.id || secretId),
    [allItems, activeItem?.id, initialSecret?.id, secretId]
  );

  useEffect(() => {
    if (!isOpen) return;
    const initialSecId = initialSecret?.id;
    const initialSecName = initialSecret?.name;
    const resName = initialSecret?.resourceName;
    const currentNodes = useFlowStore.getState().nodes;
    const initialComps = findAllAttachedSecretComponents(
      initialSecId,
      initialSecName,
      currentNodes,
      resName
    );

    const resolved = appendTargetComponentOption(
      initialComps,
      targetNodeId,
      targetNodeLabel,
      currentNodes
    );
    setAttachedComponents(resolved);
  }, [isOpen, initialSecret?.id, targetNodeId]);

  useOutsideMouseDown(importDropdownRef, isImportDropdownOpen, () => {
    setIsImportDropdownOpen(false);
  });

  if (!isOpen) return null;

  const handleEditFromList = (item: OverviewItem) => {
    loadSecret(item.rawItem);
    setActiveItem(item.rawItem);
    setSelectedProfile(null);
    const comps = findAllAttachedSecretComponents(
      item.rawItem.id,
      item.rawItem.name,
      nodes,
      item.rawItem.resourceName || (item.ownerNode.id !== 'cluster-storage' ? item.ownerNode.label : undefined)
    );
    setAttachedComponents(comps);
    setMode('form');
  };

  const handleAddNewFromList = () => {
    loadSecret(null);
    setActiveItem(null);
    setSelectedProfile(null);
    setAttachedComponents([]);
    setMode('form');
  };

  const handleDeleteFromList = (item: OverviewItem) => {
    removeSecretFromNodeOrStore(item, nodes, updateNodeData, addLog, deleteSavedSecret);
  };

  const handleRemoveComponent = (componentId: string) => {
    const targetSecId = activeItem?.id || initialSecret?.id || secretId;
    const oldSecName = initialSecret?.name || activeItem?.name;
    const targetNodes = nodes.filter((n) => {
      if (n.id === componentId) return true;
      const groupInfo = getPodReplicaGroupInfo(n);
      return groupInfo.isGroup && groupInfo.groupKey === componentId;
    });

    targetNodes.forEach((node) => {
      const currentList: K8sSecretItem[] = node.data?.secrets || [];
      const updatedList = currentList.filter(
        (s) => !(targetSecId && s.id === targetSecId) && !(secretName && s.name === secretName) && !(oldSecName && s.name === oldSecName)
      );
      updateNodeData(node.id, { secrets: updatedList });
      addLog(
        'info',
        `[Secret] Removed attached component '${node.data?.label || node.id}' from Secret '${secretName}'`,
        'UI'
      );
    });

    setAttachedComponents((prev) => prev.filter((c) => c.id !== componentId));
  };

  const handleAttachComponent = (comp: ComponentOption) => {
    const targetNodes = nodes.filter((n) => {
      if (n.id === comp.id) return true;
      const groupInfo = getPodReplicaGroupInfo(n);
      return groupInfo.isGroup && groupInfo.groupKey === comp.id;
    });
    if (targetNodes.length === 0) return;

    const primaryNode = targetNodes[0];
    const targetLabel = comp.label || (primaryNode.data?.label as string) || primaryNode.id;
    const targetType = primaryNode.type || comp.type || 'Node';

    const targetId = activeItem?.id || initialSecret?.id || secretId || `secret-${Date.now()}`;
    const validData = typeof getValidData === 'function' ? getValidData() : [];
    const updatedSec = buildSecretItem(targetId, secretName, secretType, validData);
    updatedSec.resourceName = targetLabel;
    updatedSec.resourceType = targetType;

    targetNodes.forEach((node) => {
      const currentList: K8sSecretItem[] = node.data?.secrets || [];
      const exists = currentList.some((s) => (targetId && s.id === targetId) || (secretName && s.name === secretName));
      const updatedList = exists
        ? currentList.map((s) => ((targetId && s.id === targetId) || (secretName && s.name === secretName) ? updatedSec : s))
        : [...currentList, updatedSec];
      updateNodeData(node.id, { secrets: updatedList });
    });

    setAttachedComponents((prev) => [...prev.filter((c) => c.id !== comp.id), comp]);
    addLog(
      'info',
      `[Secret] Attached Secret '${secretName}' to component '${targetLabel}'`,
      'UI'
    );
  };

  const handleUseExistingSecret = (sourceSec: K8sSecretItem) => {
    if (typeof loadSecret === 'function') {
      loadSecret(sourceSec);
    }
    const nextAttached = mergeAttachedSecretComponents(attachedComponents, sourceSec, nodes);
    setAttachedComponents(nextAttached);
    setIsImportDropdownOpen(false);
    addLog(
      'info',
      `[Secret] Selected existing Secret '${sourceSec.name}' for component '${targetNodeLabel || targetNodeId || 'canvas'}'`,
      'UI'
    );
  };

  const handleSaveModal = () => {
    const validData = dataItems
      .filter((item: any) => item.key.trim() !== '')
      .map((item: any) => ({ key: item.key.trim(), value: item.value }));
    const targetId = activeItem?.id || initialSecret?.id || secretId || `secret-${Date.now()}`;
    const trimmedName = secretName?.trim();
    const effectiveName = trimmedName ? sanitizeSlug(trimmedName) : targetId;
    const oldSecName = initialSecret?.name || activeItem?.name;

    const hasAttached = attachedComponents.length > 0;
    const targetResName = hasAttached ? attachedComponents.map((c) => c.label).join(', ') : '';
    const targetResType = hasAttached ? attachedComponents[0].type : undefined;

    const secretItem: K8sSecretItem = {
      ...buildSecretItem(targetId, effectiveName, secretType, validData),
      profileName: activeItem?.profileName || currentProfileName,
      resourceName: targetResName,
      resourceType: targetResType,
    };

    const attachedIds = new Set(attachedComponents.map((c) => c.id));
    syncNodesSecret(nodes, targetId, secretItem.name, oldSecName, secretItem, attachedIds, updateNodeData);

    onSave(secretItem);
    setActiveItem(null);
    setAttachedComponents([]);
    setMode('list');
  };

  const hasExistingItem = Boolean(activeItem || initialSecret);
  const modalTitle = mode === 'list'
    ? 'Cluster Secrets Overview'
    : mode === 'profile'
    ? `Secret Profile — ${selectedProfile || 'Canvas Profile'}`
    : (hasExistingItem ? 'Edit Secret' : 'Attach Secret');
  const modalSubtitle = mode === 'list'
    ? `${filteredItems.length} Secret${filteredItems.length === 1 ? '' : 's'} available across cluster`
    : mode === 'profile'
    ? `Canvas Profile: ${selectedProfile || 'Active'} • Evaluation Precedence Order`
    : (targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Sensitive Key-Value Data');

  const footer = (
    <ResourceModalFooter
      mode={mode}
      isDark={isDark}
      onAddNewFromList={handleAddNewFromList}
      onClose={onClose}
      onBackToMode={() => setMode('list')}
      onSave={handleSaveModal}
      addNewButtonLabel="+ Add Secret"
      saveButtonLabel={hasExistingItem ? 'Update Secret' : 'Attach Secret'}
      accentColor="rose"
      backButtonTestId="secret-back-button"
      closeButtonTestId="secret-list-close-button"
      profileBackButtonTestId="secret-footer-back-button"
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      icon={Lock}
      iconColorClass="text-rose-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
      footer={footer}
    >
      {mode === 'list' && (
        <SecretListView
          search={search}
          onSearchChange={setSearch}
          items={filteredItems}
          isDark={isDark}
          onEditItem={handleEditFromList}
          onDeleteItem={handleDeleteFromList}
          onSelectProfile={(pName) => {
            setSelectedProfile(pName);
            setMode('profile');
          }}
        />
      )}

      {mode === 'profile' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/40">
            <button
              type="button"
              data-testid="secret-profile-back-button"
              onClick={() => setMode('list')}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Secret list</span>
            </button>
            <span className="text-[11px] text-slate-400 font-mono">
              Profile: <strong className="text-rose-400">{selectedProfile}</strong>
            </span>
          </div>

          <ResourcePrecedenceView
            resourceType="Secret"
            accentColor="rose"
            profileName={selectedProfile || currentProfileName}
            items={profileItems}
            isDark={isDark}
            onEditItem={handleEditFromList}
            onDeleteItem={handleDeleteFromList}
            onAddNewItem={handleAddNewFromList}
          />
        </div>
      )}

      {mode === 'form' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/40">
            <button
              type="button"
              data-testid="secret-header-back-button"
              onClick={() => setMode('list')}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Secret list</span>
            </button>
          </div>

          {/* Tagify Related Component Section */}
          <ConfigMapComponentSection
            attachedComponents={attachedComponents}
            availableComponents={availableComponents}
            onRemoveComponent={handleRemoveComponent}
            onAttachComponent={handleAttachComponent}
            isDark={isDark}
            accentColor="indigo"
          />

          {hasExistingItem && (
            <div>
              <label htmlFor="secret-id-input" className="block text-xs font-semibold mb-1 text-slate-400">
                Secret ID
              </label>
              <input
                id="secret-id-input"
                data-testid="secret-id-input"
                type="text"
                value={activeItem?.id || secretId || initialSecret?.id}
                readOnly
                disabled
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none cursor-not-allowed opacity-75 select-none",
                  isDark
                    ? "bg-slate-900 border-slate-800 text-slate-400"
                    : "bg-slate-100 border-slate-200 text-slate-500"
                )}
              />
            </div>
          )}

          {/* Secret Name & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="secret-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
                Secret Name
              </label>
              <input
                id="secret-name-input"
                data-testid="secret-name-input"
                type="text"
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
                placeholder="e.g. app-secret"
                maxLength={63}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500/50 transition-all",
                  isDark
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                )}
              />
            </div>
            <div>
              <label htmlFor="secret-type-select" className="block text-xs font-semibold mb-1 text-slate-400">
                Secret Type
              </label>
              <select
                id="secret-type-select"
                data-testid="secret-type-select"
                value={secretType}
                onChange={(e) => setSecretType(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500/50 transition-all",
                  isDark
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                )}
              >
                <option value="Opaque">Opaque</option>
                <option value="kubernetes.io/service-account-token">Service Account Token</option>
                <option value="kubernetes.io/dockercfg">Docker Config</option>
                <option value="kubernetes.io/basic-auth">Basic Auth</option>
                <option value="kubernetes.io/ssh-auth">SSH Auth</option>
                <option value="kubernetes.io/tls">TLS</option>
              </select>
            </div>
          </div>

          {/* Key-Value Data Section with Use Existing dropdown */}
          <div className="space-y-3 pt-2 border-t border-slate-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Secret Data (Key - Value Pairs)</span>
              <div className="flex items-center gap-2">
                <SecretImportDataDropdown
                  isOpen={isImportDropdownOpen}
                  onToggleOpen={() => setIsImportDropdownOpen((prev) => !prev)}
                  existingSecrets={existingSecrets}
                  onImport={handleUseExistingSecret}
                  isDark={isDark}
                  dropdownRef={importDropdownRef}
                />
              </div>
            </div>

            <KeyValueFormSection
              items={dataItems}
              colorMode={colorMode}
              accentColor="indigo"
              onAddField={handleAddField}
              onRemoveField={handleRemoveField}
              onUpdateField={handleUpdateField}
              keyPlaceholder="KEY (e.g. DB_PASSWORD)"
              valuePlaceholder="Secret Value"
              valueInputType="text"
              sectionTitle=""
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
