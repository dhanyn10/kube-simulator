import React from 'react';
import { Lock } from 'lucide-react';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import {
  ResourceListView,
  ResourceColumnVisibility,
  getInitialResourceColumnVisibility,
} from './ResourceListView';

export type SecretColumnVisibility = ResourceColumnVisibility;

export interface SecretListViewProps {
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onSelectProfile?: (profileName: string) => void;
}

const STORAGE_COLUMN_KEY = 'k8s_secret_table_columns';

export const getInitialSecretColumnVisibility = (): SecretColumnVisibility =>
  getInitialResourceColumnVisibility(STORAGE_COLUMN_KEY);

export const SecretListView: React.FC<SecretListViewProps> = (props) => (
  <ResourceListView
    {...props}
    resourceType="Secret"
    storageKey={STORAGE_COLUMN_KEY}
    accentColor="rose"
    emptyIcon={Lock}
  />
);
