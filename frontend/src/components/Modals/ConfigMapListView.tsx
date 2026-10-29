import React from 'react';
import { Settings } from 'lucide-react';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import {
  ResourceListView,
  ResourceColumnVisibility,
  getInitialResourceColumnVisibility,
} from './ResourceListView';

export type ColumnVisibility = ResourceColumnVisibility;

export interface ConfigMapListViewProps {
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onSelectProfile?: (profileName: string) => void;
}

const STORAGE_COLUMN_KEY = 'k8s_configmap_table_columns';

export const getInitialColumnVisibility = (): ColumnVisibility =>
  getInitialResourceColumnVisibility(STORAGE_COLUMN_KEY);

export const ConfigMapListView: React.FC<ConfigMapListViewProps> = (props) => (
  <ResourceListView
    {...props}
    resourceType="ConfigMap"
    storageKey={STORAGE_COLUMN_KEY}
    accentColor="teal"
    emptyIcon={Settings}
  />
);
