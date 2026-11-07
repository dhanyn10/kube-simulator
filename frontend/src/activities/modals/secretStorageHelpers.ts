import { K8sSecretItem } from '@/types';
import { logger } from '@/lib/logger';
import { getBackendGateway } from '@/gateway';

export const SECRETS_STORAGE_KEY = 'kube_simulator_secrets';
export const SECRETS_SETTING_KEY = 'kube_secrets_data';

/**
 * Persists an array of Secrets into local storage (localStorage and App.SaveSetting).
 *
 * @param secrets - Array of Secret items to persist.
 * @returns Boolean indicating whether save succeeded.
 */
export const saveSecretsToLocal = async (secrets: K8sSecretItem[]): Promise<boolean> => {
  try {
    const json = JSON.stringify(secrets);
    if (globalThis.localStorage !== undefined) {
      globalThis.localStorage.setItem(SECRETS_STORAGE_KEY, json);
    }
    await getBackendGateway().saveSetting(SECRETS_SETTING_KEY, json);
    return true;
  } catch (err) {
    logger.error('[SecretStorage] Failed to save Secrets locally:', err);
    return false;
  }
};

/**
 * Loads saved Secrets from local storage (App.GetSetting or localStorage fallback).
 *
 * @returns Array of saved Secret items.
 */
export const loadSecretsFromLocal = async (): Promise<K8sSecretItem[]> => {
  try {
    let dataStr = await getBackendGateway().getSetting(SECRETS_SETTING_KEY);
    if (!dataStr && globalThis.localStorage !== undefined) {
      dataStr = globalThis.localStorage.getItem(SECRETS_STORAGE_KEY) || '';
    }
    if (!dataStr) return [];

    const parsed = JSON.parse(dataStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error('[SecretStorage] Failed to load Secrets locally:', err);
    return [];
  }
};

/**
 * Merges a Secret item into the locally persisted list and returns the updated list.
 *
 * @param secretItem - Secret item to add or update.
 * @returns Updated array of Secret items.
 */
export const persistSecretItem = async (secretItem: K8sSecretItem): Promise<K8sSecretItem[]> => {
  const current = await loadSecretsFromLocal();
  const idx = current.findIndex((s) => s.id === secretItem.id || s.name === secretItem.name);
  let updated: K8sSecretItem[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = secretItem;
  } else {
    updated = [...current, secretItem];
  }
  await saveSecretsToLocal(updated);
  return updated;
};

/**
 * Removes a Secret item by ID or name from local storage.
 *
 * @param idOrName - Identifier or name of the Secret to remove.
 * @returns Updated array of Secret items.
 */
export const removeSecretFromLocal = async (idOrName: string): Promise<K8sSecretItem[]> => {
  const current = await loadSecretsFromLocal();
  const updated = current.filter((s) => s.id !== idOrName && s.name !== idOrName);
  await saveSecretsToLocal(updated);
  return updated;
};
