import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { K8sNodeData } from '@/types';

export interface SimpleResourceNodeProps extends NodeProps {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  children?: React.ReactNode;
  bottomSourceClassName?: string;
  rightSourceClassName?: string;
  hideDefaultHandles?: boolean;
}

/**
 * Simple wrapper around BaseNode for lightweight resource node types (Ingress etc.):
 * passes title/icon/color + custom source/target handle styling to the card.
 */
export const SimpleResourceNode = memo(({
  title,
  icon: Icon,
  color,
  children,
  bottomSourceClassName,
  rightSourceClassName,
  hideDefaultHandles,
  ...props
}: SimpleResourceNodeProps) => {
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
      bottomSourceClassName={bottomSourceClassName}
      rightSourceClassName={rightSourceClassName}
      hideDefaultHandles={hideDefaultHandles}
    >
      {children}
    </BaseNode>
  );
});
