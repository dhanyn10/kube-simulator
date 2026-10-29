import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveSecretsToLocal,
  loadSecretsFromLocal,
  persistSecretItem,
  removeSecretFromLocal,
  SECRETS_STORAGE_KEY,
  SECRETS_SETTING_KEY,
} from '@/activities/modals/secretStorageHelpers';
import { K8sSecretItem } from '@/types';

describe('secretStorageHelpers', () => {
  const sampleSecrets: K8sSecretItem[] = [
    {
      id: 'sec-1',
      name: 'app-secret',
      type: 'Opaque',
      secretData: [{ key: 'API_KEY', value: 'secret-token' }],
    },
    {
      id: 'sec-2',
      name: 'db-secret',
      type: 'Opaque',
      secretData: [{ key: 'DB_PASS', value: 's3cr3t' }],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    delete (globalThis as any).go;
  });

  it('saveSecretsToLocal saves to localStorage and App.SaveSetting when available', async () => {
    const mockSaveSetting = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: mockSaveSetting,
        },
      },
    };

    const result = await saveSecretsToLocal(sampleSecrets);
    expect(result).toBe(true);

    const localStored = localStorage.getItem(SECRETS_STORAGE_KEY);
    expect(localStored).toBe(JSON.stringify(sampleSecrets));
    expect(mockSaveSetting).toHaveBeenCalledWith(
      SECRETS_SETTING_KEY,
      JSON.stringify(sampleSecrets)
    );
  });

  it('saveSecretsToLocal handles JSON errors gracefully', async () => {
    const circular: any = {};
    circular.self = circular;

    const result = await saveSecretsToLocal(circular as any);
    expect(result).toBe(false);
  });

  it('loadSecretsFromLocal loads from App.GetSetting when available', async () => {
    const mockGetSetting = vi.fn().mockResolvedValue(JSON.stringify(sampleSecrets));
    (globalThis as any).go = {
      main: {
        App: {
          GetSetting: mockGetSetting,
        },
      },
    };

    const loaded = await loadSecretsFromLocal();
    expect(loaded).toEqual(sampleSecrets);
    expect(mockGetSetting).toHaveBeenCalledWith(SECRETS_SETTING_KEY);
  });

  it('loadSecretsFromLocal falls back to localStorage if App.GetSetting returns empty or is unavailable', async () => {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(sampleSecrets));
    const loaded = await loadSecretsFromLocal();
    expect(loaded).toEqual(sampleSecrets);
  });

  it('loadSecretsFromLocal returns empty array if no data stored or parsing fails', async () => {
    expect(await loadSecretsFromLocal()).toEqual([]);

    localStorage.setItem(SECRETS_STORAGE_KEY, 'invalid json');
    expect(await loadSecretsFromLocal()).toEqual([]);
  });

  it('persistSecretItem adds a new Secret if it does not exist', async () => {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify([sampleSecrets[0]]));

    const updated = await persistSecretItem(sampleSecrets[1]);
    expect(updated).toHaveLength(2);
    expect(updated[1].id).toBe('sec-2');
  });

  it('persistSecretItem updates an existing Secret by ID or name', async () => {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(sampleSecrets));

    const modified: K8sSecretItem = {
      id: 'sec-1',
      name: 'app-secret-updated',
      type: 'Opaque',
      secretData: [{ key: 'NEW_KEY', value: 'new-val' }],
    };

    const updated = await persistSecretItem(modified);
    expect(updated).toHaveLength(2);
    expect(updated[0].name).toBe('app-secret-updated');
    expect(updated[0].secretData?.[0].key).toBe('NEW_KEY');
  });

  it('removeSecretFromLocal removes a Secret by ID or name', async () => {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(sampleSecrets));

    const updated = await removeSecretFromLocal('sec-1');
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('sec-2');

    const updatedByName = await removeSecretFromLocal('db-secret');
    expect(updatedByName).toHaveLength(0);
  });
});
