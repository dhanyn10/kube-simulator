import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '../../types';

export interface SimpleResourceNodeProps extends NodeProps {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  children?: React.ReactNode;
}

export const SimpleResourceNode = memo(({ title, icon: Icon, color, children, ...props }: SimpleResourceNodeProps) => {
  const data = props.data as unknown as K8sNodeData;

  return (
    <BaseNode
      {...props}
      data={data}
      title={title}
      icon={Icon}
      color={color}
      id={props.id}
      type={props.type}
    >
      {children}
    </BaseNode>
  );
});
