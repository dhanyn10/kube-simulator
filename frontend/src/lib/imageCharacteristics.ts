export interface ImageCharacteristics {
  // Pure numerical simulator variables (consumed directly by simulation engine)
  maxTrafficRpm: number;          // Max safe traffic requests per minute
  baseMemoryMiB: number;          // Idle RAM consumption in MiB
  memoryPer1kTrafficMiB: number;  // RAM scaling per 1,000 req/min
  cpuPer1kTrafficMilli: number;   // CPU milli-cores scaling per 1,000 req/min
  startupDelayTicks: number;      // Cold start delay in simulation ticks
  spikeToleranceRatio: number;    // Traffic surge tolerance factor (e.g. 1.2 = 20% burst overhead before CPU/RAM surge)
}

export type PresetType = 'java' | 'golang' | 'nodejs' | 'python' | 'php' | 'webserver' | 'database' | 'cache';

const RUNTIME_PRESETS: Record<PresetType, ImageCharacteristics> = {
  java: { // JDK 21 LTS: Generational ZGC & Virtual Threads optimize CPU/RAM efficiency
    maxTrafficRpm: 1200,
    baseMemoryMiB: 220,
    memoryPer1kTrafficMiB: 110,
    cpuPer1kTrafficMilli: 320,
    startupDelayTicks: 4,
    spikeToleranceRatio: 1.15,
  },
  golang: { // Go 1.24: Swiss Tables maps & allocator enhancements
    maxTrafficRpm: 6000,
    baseMemoryMiB: 12,
    memoryPer1kTrafficMiB: 25,
    cpuPer1kTrafficMilli: 90,
    startupDelayTicks: 1,
    spikeToleranceRatio: 1.6,
  },
  nodejs: { // Node.js 22 LTS: V8 12.4 performance & Maglev JIT compiler optimizations
    maxTrafficRpm: 2500,
    baseMemoryMiB: 55,
    memoryPer1kTrafficMiB: 56,
    cpuPer1kTrafficMilli: 180,
    startupDelayTicks: 2,
    spikeToleranceRatio: 1.25,
  },
  python: { // Python 3.12: Per-interpreter GIL & JIT compiler foundations
    maxTrafficRpm: 1000,
    baseMemoryMiB: 75,
    memoryPer1kTrafficMiB: 85,
    cpuPer1kTrafficMilli: 220,
    startupDelayTicks: 2,
    spikeToleranceRatio: 1.2,
  },
  php: { // PHP 8.3: OPcache & JIT improvements
    maxTrafficRpm: 1400,
    baseMemoryMiB: 45,
    memoryPer1kTrafficMiB: 70,
    cpuPer1kTrafficMilli: 200,
    startupDelayTicks: 2,
    spikeToleranceRatio: 1.25,
  },
  webserver: { // Nginx 1.26 / Alpine: High-concurrency event-driven proxy
    maxTrafficRpm: 12000,
    baseMemoryMiB: 10,
    memoryPer1kTrafficMiB: 12,
    cpuPer1kTrafficMilli: 75,
    startupDelayTicks: 1,
    spikeToleranceRatio: 2.2,
  },
  cache: { // Redis 7 LTS: Multi-threaded I/O & memory optimizations
    maxTrafficRpm: 60000,
    baseMemoryMiB: 18,
    memoryPer1kTrafficMiB: 45,
    cpuPer1kTrafficMilli: 50,
    startupDelayTicks: 1,
    spikeToleranceRatio: 3.0,
  },
  database: { // PostgreSQL 16 / MySQL 8.4 LTS: Query execution & connection pooler efficiency
    maxTrafficRpm: 2000,
    baseMemoryMiB: 120,
    memoryPer1kTrafficMiB: 90,
    cpuPer1kTrafficMilli: 280,
    startupDelayTicks: 3,
    spikeToleranceRatio: 1.3,
  },
};

const DEFAULT_GENERIC_PRESET: ImageCharacteristics = {
  maxTrafficRpm: 1000,
  baseMemoryMiB: 100,
  memoryPer1kTrafficMiB: 64,
  cpuPer1kTrafficMilli: 200,
  startupDelayTicks: 2,
  spikeToleranceRatio: 1.2,
};

/**
 * Creates a customized runtime preset by overriding specific numerical parameters.
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
  const lower = (imageName || '').toLowerCase();

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

/**
 * Evaluates exact numerical resource consumption (CPU milli and Memory MiB) based on container image characteristics and traffic load.
 */
export function evaluateImageResourceConsumption(
  imageName: string,
  incomingTraffic: number,
  replicas: number = 1,
  noise: number = 0
): { cpuValue: number; memValue: number; characteristics: ImageCharacteristics } {
  const chars = getImageCharacteristics(imageName);
  const safeReplicas = Math.max(1, replicas);
  const trafficK = incomingTraffic / 1000;

  // Evaluate surge factor if incoming traffic per replica exceeds safe capacity
  const trafficPerReplica = incomingTraffic / safeReplicas;
  const surgeLimit = chars.maxTrafficRpm * chars.spikeToleranceRatio;
  const surgeMultiplier = trafficPerReplica > surgeLimit ? 1 + (trafficPerReplica - surgeLimit) / chars.maxTrafficRpm : 1;

  const baseCpu = (trafficK * chars.cpuPer1kTrafficMilli * surgeMultiplier) / safeReplicas;
  const cpuValue = Math.max(10, baseCpu + 30 + noise);

  const baseMem = chars.baseMemoryMiB + (trafficK * chars.memoryPer1kTrafficMiB * surgeMultiplier) / safeReplicas;
  const memValue = Math.max(10, baseMem + noise);

  return {
    cpuValue,
    memValue,
    characteristics: chars,
  };
}
