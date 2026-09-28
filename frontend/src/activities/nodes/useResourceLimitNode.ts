import { useCallback } from 'react';
import { NodeProps } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';

/**
 * Custom hook providing business logic and connection validation for ResourceLimitNode.
 */
export const useResourceLimitNode = (props: NodeProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = props.data as unknown as K8sNodeData;
  const hasWorkload = nodes.some((n: any) => n.type === 'Deployment' || n.type === 'Pod');

  const isValidConnection = useCallback(
    (connection: any) => {
      const target = nodes.find((n: any) => n.id === connection.target);
      return target?.type === 'Deployment' || target?.type === 'Pod';
    },
    [nodes]
  );

  return {
    data,
    colorMode,
    hasWorkload,
    isValidConnection,
  };
};
