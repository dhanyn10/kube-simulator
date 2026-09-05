import React from 'react';
import { Activity } from 'lucide-react';
import { AttachedResourceListModal } from './AttachedResourceListModal';
import { K8sHpaItem } from '../../types';

interface HPAListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeLabel?: string;
  hpas: K8sHpaItem[];
  onEditHpa: (hpa: K8sHpaItem) => void;
  onDeleteHpa: (hpaId: string, hpaName: string) => void;
  onAddNewHpa: () => void;
}

export const HPAListModal: React.FC<HPAListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  hpas,
  onEditHpa,
  onDeleteHpa,
  onAddNewHpa,
}) => {
  return (
    <AttachedResourceListModal<K8sHpaItem>
      isOpen={isOpen}
      onClose={onClose}
      title="Attached HPA Autoscalers"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached HPA Autoscalers'}
      icon={Activity}
      iconColorClass="text-fuchsia-400"
      buttonBgColorClass="bg-fuchsia-600 hover:bg-fuchsia-500"
      hoverIconColorClass="hover:text-fuchsia-300 hover:bg-fuchsia-500/10"
      items={hpas}
      emptyText="No HPA autoscalers attached to this node."
      addLabel="Add HPA"
      itemTypeName="HPA"
      renderItemDetails={(hpa) => (
        <div className="text-[11px] text-slate-400 font-mono">
          Replicas: {hpa.minReplicas} - {hpa.maxReplicas} | Target CPU: {hpa.targetCPU}%
          {hpa.targetMemory ? ` | Target Mem: ${hpa.targetMemory}%` : ''}
        </div>
      )}
      onEditItem={onEditHpa}
      onDeleteItem={onDeleteHpa}
      onAddNewItem={onAddNewHpa}
    />
  );
};
