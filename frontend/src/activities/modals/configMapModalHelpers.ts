import { K8sConfigMapItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';

export interface ConfigRow {
  readonly id: string;
  readonly key: string;
  readonly value: string;
}

export interface ValueSuggestionItem {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

export interface KeySuggestion {
  readonly key: string;
  readonly label: string;
  readonly valueSuggestions: readonly ValueSuggestionItem[];
  readonly hint: string;
}

export const PREDEFINED_KEYS: readonly KeySuggestion[] = [
  {
    key: 'PORT',
    label: 'PORT',
    valueSuggestions: [
      { value: '80', label: '80', description: 'Standard HTTP Port' },
      { value: '8080', label: '8080', description: 'Alt Web Server Port' },
      { value: '3000', label: '3000', description: 'Node.js / React Port' },
      { value: '5000', label: '5000', description: 'Flask / Python Port' },
      { value: '8443', label: '8443', description: 'HTTPS Secure Port' },
    ],
    hint: 'Container listening port. Must match Service targetPort.',
  },
  {
    key: 'MAX_CONNECTIONS',
    label: 'MAX_CONNECTIONS',
    valueSuggestions: [
      { value: '100', label: '100', description: '100 RPS (Low Limit - Throttling)' },
      { value: '500', label: '500', description: '500 RPS (Medium Limit)' },
      { value: '1000', label: '1000', description: '1000 RPS (Standard High Limit)' },
      { value: '5000', label: '5000', description: '5000 RPS (Enterprise Scale)' },
    ],
    hint: 'Maximum traffic capacity limit in RPS. Excess traffic gets throttled.',
  },
  {
    key: 'LOG_LEVEL',
    label: 'LOG_LEVEL',
    valueSuggestions: [
      { value: 'INFO', label: 'INFO', description: 'Standard Activity Logs' },
      { value: 'DEBUG', label: 'DEBUG', description: 'Verbose Diagnostics' },
      { value: 'WARN', label: 'WARN', description: 'Warning Highlights Only' },
      { value: 'ERROR', label: 'ERROR', description: 'Errors Only' },
    ],
    hint: 'Controls verbosity level of terminal activity logs.',
  },
  {
    key: 'CHAOS_MODE',
    label: 'CHAOS_MODE',
    valueSuggestions: [
      { value: 'disabled', label: 'disabled', description: 'Normal Operation' },
      { value: 'enabled', label: 'enabled', description: 'Simulate CrashLoopBackOff' },
    ],
    hint: 'Enables or disables simulated pod failures.',
  },
];

/**
 * Finds predefined key info for a given key name.
 */
export const findActiveKeyInfo = (keyName: string): KeySuggestion | undefined => {
  const normalizedKey = keyName.trim().toUpperCase();
  return PREDEFINED_KEYS.find((pk) => pk.key === normalizedKey);
};

/**
 * Filters predefined keys matching a user search key string.
 */
export const filterKeysByQuery = (keyQuery: string): KeySuggestion[] => {
  const q = keyQuery.toLowerCase();
  return PREDEFINED_KEYS.filter((pk) => pk.key.toLowerCase().includes(q));
};

/**
 * Filters value suggestions for a specific key info matching a user search value string.
 */
export const filterValuesByQuery = (
  keyInfo: KeySuggestion | undefined,
  valueQuery: string
): readonly ValueSuggestionItem[] => {
  if (!keyInfo) return [];
  const q = valueQuery.toLowerCase();
  return keyInfo.valueSuggestions.filter(
    (opt) => opt.value.toLowerCase().includes(q) || opt.description.toLowerCase().includes(q)
  );
};

/**
 * Constructs a standardized K8sConfigMapItem object.
 */
export const buildConfigMapItem = (
  initialId: string | undefined,
  rawName: string,
  configData: Array<{ key: string; value: string }>
): K8sConfigMapItem => {
  const fallbackSuffix = crypto.randomUUID().split('-')[0];
  return {
    id: initialId || `cm-${Date.now()}-${fallbackSuffix}`,
    name: sanitizeSlug(rawName) || 'unnamed-configmap',
    configData,
  };
};
