import { useState, useEffect } from 'react';
import { K8sResourceLimitItem } from '@/types';
import { useFlowStore } from '@/store';
import { parseCPU, parseMemory, generateRandomHash } from '@/lib/utils';

/**
 * Custom hook managing form state, QoS validation, and saving logic for Resource Limit modal.
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
        const id = generateRandomHash(5);
        setName(`res-limit-${id}`);
        setCpuRequest('500m');
        setCpuLimit('1000m');
        setMemoryRequest('256Mi');
        setMemoryLimit('512Mi');
      }
    }
  }, [isOpen, initialResourceLimit]);

  const handleCpuLimitChange = (newLimit: string) => {
    setCpuLimit(newLimit);
    if (parseCPU(newLimit) < parseCPU(cpuRequest)) {
      setCpuRequest(newLimit);
    }
  };

  const handleMemoryLimitChange = (newLimit: string) => {
    setMemoryLimit(newLimit);
    if (parseMemory(newLimit) < parseMemory(memoryRequest)) {
      setMemoryRequest(newLimit);
    }
  };

  const isCpuRequestOptionDisabled = (val: string) => {
    return parseCPU(val) > parseCPU(cpuLimit);
  };

  const isMemoryRequestOptionDisabled = (val: string) => {
    return parseMemory(val) > parseMemory(memoryLimit);
  };

  const parsedCpuReq = parseCPU(cpuRequest);
  const parsedCpuLim = parseCPU(cpuLimit);
  const parsedMemReq = parseMemory(memoryRequest);
  const parsedMemLim = parseMemory(memoryLimit);

  const isCpuInvalid = Boolean(cpuLimit && cpuRequest && parsedCpuReq > parsedCpuLim);
  const isMemoryInvalid = Boolean(memoryLimit && memoryRequest && parsedMemReq > parsedMemLim);
  const hasResourceError = isCpuInvalid || isMemoryInvalid;
  const isFormInvalid = hasResourceError || !name.trim();

  const handleSave = () => {
    if (!name.trim()) {
      addLog('error', 'Resource Limit name cannot be empty.', 'UI');
      return;
    }

    if (hasResourceError) {
      addLog('error', 'Cannot save: Resource requests must be less than or equal to limits.', 'UI');
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
    setCpuLimit: handleCpuLimitChange,
    memoryRequest,
    setMemoryRequest,
    memoryLimit,
    setMemoryLimit: handleMemoryLimitChange,
    isCpuRequestOptionDisabled,
    isMemoryRequestOptionDisabled,
    isCpuInvalid,
    isMemoryInvalid,
    hasResourceError,
    isFormInvalid,
    parsedCpuReq,
    parsedCpuLim,
    parsedMemReq,
    parsedMemLim,
    handleSave,
  };
};
