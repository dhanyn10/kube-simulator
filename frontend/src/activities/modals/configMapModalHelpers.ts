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

const createSuggestion = (
  key: string,
  hint: string,
  suggestions: readonly (readonly [value: string, description: string])[]
): KeySuggestion => ({
  key,
  label: key,
  hint,
  valueSuggestions: suggestions.map(([v, desc]) => ({
    value: v,
    label: v,
    description: desc,
  })),
});

export const PREDEFINED_KEYS: readonly KeySuggestion[] = [
  createSuggestion('PORT', 'Container listening port. Must match Service targetPort.', [
    ['80', 'Standard HTTP Port'],
    ['8080', 'Alt Web Server Port'],
    ['3000', 'Node.js / React Port'],
    ['5000', 'Flask / Python Port'],
    ['8443', 'HTTPS Secure Port'],
  ]),
  createSuggestion('MAX_CONNECTIONS', 'Maximum traffic capacity limit in RPS. Excess traffic gets throttled.', [
    ['100', '100 RPS (Low Limit - Throttling)'],
    ['500', '500 RPS (Medium Limit)'],
    ['1000', '1000 RPS (Standard High Limit)'],
    ['5000', '5000 RPS (Enterprise Scale)'],
  ]),
  createSuggestion('LOG_LEVEL', 'Controls verbosity level of terminal activity logs.', [
    ['INFO', 'Standard Activity Logs'],
    ['DEBUG', 'Verbose Diagnostics'],
    ['WARN', 'Warning Highlights Only'],
    ['ERROR', 'Errors Only'],
  ]),
  createSuggestion('CHAOS_MODE', 'Enables or disables simulated pod failures.', [
    ['disabled', 'Normal Operation'],
    ['enabled', 'Simulate CrashLoopBackOff'],
  ]),
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
