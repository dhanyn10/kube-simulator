import { useCallback } from 'react';
import { NodeProps } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';
import { validateResourceLimits } from '@/lib/utils';

/**
 * Custom hook providing business logic, QoS validation, and connection validation for ResourceLimitNode.
 */
export const useResourceLimitNode = (props: NodeProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = props.data as unknown as K8sNodeData;
  const hasWorkload = nodes.some((node: any) => node.type === 'Deployment' || node.type === 'Pod');

  const isValidConnection = useCallback(
    (connection: any) => {
      const target = nodes.find((node: any) => node.id === connection.target);
      return target?.type === 'Deployment' || target?.type === 'Pod';
    },
    [nodes]
  );

  const resourceValidation = validateResourceLimits(data);

  return {
    data,
    colorMode,
    hasWorkload,
    isValidConnection,
    isCpuInvalid: resourceValidation.isCpuError,
    isMemoryInvalid: resourceValidation.isMemError,
    hasResourceError: resourceValidation.hasError,
  };
};
