import  { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';

export const InternetNode = memo((props: NodeProps) => {
  const data = props.data as unknown as K8sNodeData;
  return <BaseNode {...props} data={data} title="Internet" icon={Globe} color="blue" id={props.id} type={props.type} />;
});
