import { useState, useEffect } from 'react';
import { K8sResourceLimitItem } from '@/types';
import { useFlowStore } from '@/store';

/**
 * Custom hook managing form state and saving logic for Resource Limit modal.
 */
export const useResourceLimitModal = (
  isOpen: boolean,
  targetNodeId: string | null,
  initialResourceLimit: K8sResourceLimitItem | null | undefined,
  onSave: (resItem: K8sResourceLimitItem) => void,
  onClose: () => void
) => {
  const addLog = useFlowStore((state) => state.addLog);

  const [name, setName] = useState('');
  const [cpuRequest, setCpuRequest] = useState('500m');
  const [cpuLimit, setCpuLimit] = useState('1000m');
  const [memoryRequest, setMemoryRequest] = useState('256Mi');
  const [memoryLimit, setMemoryLimit] = useState('512Mi');

  useEffect(() => {
    if (isOpen) {
      if (initialResourceLimit) {
        setName(initialResourceLimit.name);
        setCpuRequest(initialResourceLimit.cpuRequest || '500m');
        setCpuLimit(initialResourceLimit.cpuLimit || '1000m');
        setMemoryRequest(initialResourceLimit.memoryRequest || '256Mi');
        setMemoryLimit(initialResourceLimit.memoryLimit || '512Mi');
      } else {
        const id = Math.random().toString(36).substring(2, 7);
        setName(`res-limit-${id}`);
        setCpuRequest('500m');
        setCpuLimit('1000m');
        setMemoryRequest('256Mi');
        setMemoryLimit('512Mi');
      }
    }
  }, [isOpen, initialResourceLimit]);

  const handleSave = () => {
    if (!name.trim()) {
      addLog('error', 'Resource Limit name cannot be empty.', 'UI');
      return;
    }

    const item: K8sResourceLimitItem = {
      id: initialResourceLimit?.id || `res-limit-${Date.now()}`,
      name: name.trim(),
      cpuRequest,
      cpuLimit,
      memoryRequest,
      memoryLimit,
    };

    onSave(item);
    onClose();
  };

  return {
    name,
    setName,
    cpuRequest,
    setCpuRequest,
    cpuLimit,
    setCpuLimit,
    memoryRequest,
    setMemoryRequest,
    memoryLimit,
    setMemoryLimit,
    handleSave,
  };
};
