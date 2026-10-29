import React from 'react';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { ResourcePrecedenceView } from './ResourcePrecedenceView';

export interface ConfigMapPrecedenceViewProps {
  readonly profileName: string;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onAddNewConfigMap?: () => void;
}

export const ConfigMapPrecedenceView: React.FC<ConfigMapPrecedenceViewProps> = ({
  onAddNewConfigMap,
  ...props
}) => (
  <ResourcePrecedenceView
    {...props}
    resourceType="ConfigMap"
    accentColor="teal"
    onAddNewItem={onAddNewConfigMap}
  />
);
