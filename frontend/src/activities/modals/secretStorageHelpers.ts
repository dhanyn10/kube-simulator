import { K8sSecretItem } from '@/types';
import {
  saveResourcesToStorage,
  loadResourcesFromStorage,
  persistResourceItem,
  removeResourceFromStorage,
  ResourceStorageConfig,
} from './resourceStorageHelpers';

export const SECRETS_STORAGE_KEY = 'kube_simulator_secrets';
export const SECRETS_SETTING_KEY = 'kube_secrets_data';

const secretStorageConfig: ResourceStorageConfig = {
  localStorageKey: SECRETS_STORAGE_KEY,
  settingKey: SECRETS_SETTING_KEY,
  logTag: 'SecretStorage',
};

/**
 * Persists an array of Secrets into local storage (localStorage and App.SaveSetting).
 */
export const saveSecretsToLocal = (secrets: K8sSecretItem[]): Promise<boolean> =>
  saveResourcesToStorage(secretStorageConfig, secrets);

/**
 * Loads saved Secrets from local storage (App.GetSetting or localStorage fallback).
 */
export const loadSecretsFromLocal = (): Promise<K8sSecretItem[]> =>
  loadResourcesFromStorage<K8sSecretItem>(secretStorageConfig);

/**
 * Merges a Secret item into the locally persisted list and returns the updated list.
 */
export const persistSecretItem = (secretItem: K8sSecretItem): Promise<K8sSecretItem[]> =>
  persistResourceItem(secretStorageConfig, secretItem);

/**
 * Removes a Secret item by ID or name from local storage.
 */
export const removeSecretFromLocal = (idOrName: string): Promise<K8sSecretItem[]> =>
  removeResourceFromStorage<K8sSecretItem>(secretStorageConfig, idOrName);
