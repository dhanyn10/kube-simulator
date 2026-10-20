import { K8sConfigMapItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';
import { KeyValueItem } from '@/components/Modals/KeyValueFormSection';

export type ConfigRow = KeyValueItem;

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

type RawSuggestionTuple = [
  key: string,
  hint: string,
  options: readonly (readonly [value: string, description: string])[]
];

const RAW_CONFIGMAP_KEYS: readonly RawSuggestionTuple[] = [
  [
    'REQUIRE_SECRET',
    'Enforces that a Secret must be attached for container authentication.',
    [
      ['true', 'Enforce Secret requirement (crashes if no Secret attached)'],
      ['false', 'Optional Secret (standard)'],
    ],
  ],
  [
    'PORT',
    'Container listening port. Must match Service targetPort.',
    [
      ['80', 'Standard HTTP Port'],
      ['8080', 'Alt Web Server Port'],
      ['3000', 'Node.js / React Port'],
      ['5000', 'Flask / Python Port'],
      ['8443', 'HTTPS Secure Port'],
    ],
  ],
  [
    'MAX_CONNECTIONS',
    'Maximum traffic capacity limit in RPS. Excess traffic gets throttled.',
    [
      ['100', '100 RPS (Low Limit - Throttling)'],
      ['500', '500 RPS (Medium Limit)'],
      ['1000', '1000 RPS (Standard High Limit)'],
      ['5000', '5000 RPS (Enterprise Scale)'],
    ],
  ],
  [
    'LOG_LEVEL',
    'Controls verbosity level of terminal activity logs.',
    [
      ['INFO', 'Standard Activity Logs'],
      ['DEBUG', 'Verbose Diagnostics'],
      ['WARN', 'Warning Highlights Only'],
      ['ERROR', 'Errors Only'],
    ],
  ],
  [
    'CHAOS_MODE',
    'Enables or disables simulated pod failures.',
    [
      ['disabled', 'Normal Operation'],
      ['enabled', 'Simulate CrashLoopBackOff'],
    ],
  ],
];

export const PREDEFINED_KEYS: readonly KeySuggestion[] = RAW_CONFIGMAP_KEYS.map(
  ([key, hint, suggestions]) => ({
    key,
    label: key,
    hint,
    valueSuggestions: suggestions.map(([v, desc]) => ({
      value: v,
      label: v,
      description: desc,
    })),
  })
);

const matchesQuery = (text: string, q: string): boolean => text.toLowerCase().includes(q);

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
  return PREDEFINED_KEYS.filter((pk) => matchesQuery(pk.key, q));
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
    (opt) => matchesQuery(opt.value, q) || matchesQuery(opt.description, q)
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
  const suffix = crypto.randomUUID().split('-')[0];
  return {
    id: initialId || `cm-${Date.now()}-${suffix}`,
    name: sanitizeSlug(rawName) || 'unnamed-configmap',
    configData,
  };
};
