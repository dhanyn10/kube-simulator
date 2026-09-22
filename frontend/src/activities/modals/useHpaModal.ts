import { useState, useEffect } from 'react';
import { K8sHpaItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';

/**
 * Custom hook managing form state and saving logic for HPA modal.
 *
 * @param isOpen Modal open state
 * @param targetNodeId Target node ID
 * @param initialHpa Initial HPA item if editing
 * @param onSave Callback when saving HPA item
 * @param onClose Callback to close modal
 * @returns State properties and save handler
 */
export function useHpaModal(
  isOpen: boolean,
  targetNodeId: string | null,
  initialHpa: K8sHpaItem | null | undefined,
  onSave: (hpaItem: K8sHpaItem) => void,
  onClose: () => void
) {
  const [hpaName, setHpaName] = useState<string>('app-hpa');
  const [minReplicas, setMinReplicas] = useState<number>(1);
  const [maxReplicas, setMaxReplicas] = useState<number>(10);
  const [targetCPU, setTargetCPU] = useState<number>(80);
  const [targetMemory, setTargetMemory] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (initialHpa) {
      setHpaName(initialHpa.name || 'app-hpa');
      setMinReplicas(initialHpa.minReplicas ?? 1);
      setMaxReplicas(initialHpa.maxReplicas ?? 10);
      setTargetCPU(initialHpa.targetCPU ?? 80);
      setTargetMemory(initialHpa.targetMemory);
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setHpaName(`hpa-${randomSuffix}`);
      setMinReplicas(1);
      setMaxReplicas(10);
      setTargetCPU(80);
      setTargetMemory(undefined);
    }
  }, [initialHpa, isOpen, targetNodeId]);

  const handleSave = () => {
    const minVal = Math.max(1, Number(minReplicas) || 1);
    const maxVal = Math.max(minVal, Number(maxReplicas) || 10);
    const cpuVal = Math.min(100, Math.max(1, Number(targetCPU) || 80));
    const memVal =
      targetMemory !== undefined && targetMemory !== null && targetMemory > 0
        ? Math.min(100, Math.max(1, Number(targetMemory)))
        : undefined;

    const hpaItem: K8sHpaItem = {
      id: initialHpa?.id || `hpa-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(hpaName) || 'unnamed-hpa',
      minReplicas: minVal,
      maxReplicas: maxVal,
      targetCPU: cpuVal,
      ...(memVal !== undefined ? { targetMemory: memVal } : {})
    };
    onSave(hpaItem);
    onClose();
  };

  return {
    hpaName,
    setHpaName,
    minReplicas,
    setMinReplicas,
    maxReplicas,
    setMaxReplicas,
    targetCPU,
    setTargetCPU,
    targetMemory,
    setTargetMemory,
    handleSave
  };
}
