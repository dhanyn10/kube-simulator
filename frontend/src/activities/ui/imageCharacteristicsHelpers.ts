export interface ImageCharacteristics {
  maxTraffic: string;
  ramWeight: string;
  startup: string;
  cpuClass: string;
}

export type PresetType = 'java' | 'golang' | 'nodejs' | 'python' | 'php' | 'webserver' | 'database' | 'cache';

const RUNTIME_PRESETS: Record<PresetType, ImageCharacteristics> = {
  java: {
    maxTraffic: '1k req/m',
    ramWeight: 'Heavy (~250MB+)',
    startup: 'Slow (3-5s)',
    cpuClass: 'High (JIT/GC)',
  },
  golang: {
    maxTraffic: '5k req/m',
    ramWeight: 'Ultra Light (~15MB)',
    startup: 'Instant (<50ms)',
    cpuClass: 'Low-Medium',
  },
  nodejs: {
    maxTraffic: '2k req/m',
    ramWeight: 'Medium (~60MB)',
    startup: 'Fast (<500ms)',
    cpuClass: 'Single-Threaded',
  },
  python: {
    maxTraffic: '800 req/m',
    ramWeight: 'Medium (~80MB)',
    startup: 'Fast (<1s)',
    cpuClass: 'GIL-Limited',
  },
  php: {
    maxTraffic: '1.2k req/m',
    ramWeight: 'Dynamic/FPM',
    startup: 'Fast (<300ms)',
    cpuClass: 'Per-Request',
  },
  webserver: {
    maxTraffic: '10k req/m',
    ramWeight: 'Ultra Light (~10MB)',
    startup: 'Instant (<100ms)',
    cpuClass: 'Event-Driven',
  },
  cache: {
    maxTraffic: '50k req/m',
    ramWeight: 'In-Memory Bound',
    startup: 'Instant (<50ms)',
    cpuClass: 'Single-Core',
  },
  database: {
    maxTraffic: '1.5k req/m',
    ramWeight: 'Heavy (~100MB+)',
    startup: 'Medium (1-2s)',
    cpuClass: 'I/O & Query Bound',
  },
};

const DEFAULT_GENERIC_PRESET: ImageCharacteristics = {
  maxTraffic: '1k req/m',
  ramWeight: 'Standard',
  startup: 'Standard',
  cpuClass: 'Standard',
};

/**
 * Creates a customized runtime preset by overriding specific characteristics.
 */
export function createRuntimePreset(
  base: PresetType,
  overrides?: Partial<ImageCharacteristics>
): ImageCharacteristics {
  const basePreset = RUNTIME_PRESETS[base] ?? DEFAULT_GENERIC_PRESET;
  if (!overrides) return { ...basePreset };

  return {
    ...basePreset,
    ...overrides,
  };
}

/**
 * Resolves image characteristics based on image name or tag.
 */
export function getImageCharacteristics(imageName: string): ImageCharacteristics {
  const lower = imageName.toLowerCase();

  if (lower.includes('openjdk') || lower.includes('java')) {
    return createRuntimePreset('java');
  }
  if (lower.includes('golang') || lower.includes('go')) {
    return createRuntimePreset('golang');
  }
  if (lower.includes('node')) {
    return createRuntimePreset('nodejs');
  }
  if (lower.includes('python')) {
    return createRuntimePreset('python');
  }
  if (lower.includes('php')) {
    return createRuntimePreset('php');
  }
  if (lower.includes('nginx') || lower.includes('apache')) {
    return createRuntimePreset('webserver');
  }
  if (lower.includes('redis')) {
    return createRuntimePreset('cache');
  }
  if (lower.includes('postgres') || lower.includes('mysql') || lower.includes('mariadb')) {
    return createRuntimePreset('database');
  }

  return DEFAULT_GENERIC_PRESET;
}
