import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';

export const PodNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  return <BaseNode {...props} data={data} title="Pod" icon={Box} color="cyan" id={props.id} type={props.type} />;
});
