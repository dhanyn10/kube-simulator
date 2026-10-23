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
  java: {
    maxTrafficRpm: 1000,
    baseMemoryMiB: 250,
    memoryPer1kTrafficMiB: 128,
    cpuPer1kTrafficMilli: 350,
    startupDelayTicks: 5,
    spikeToleranceRatio: 1.1,
  },
  golang: {
    maxTrafficRpm: 5000,
    baseMemoryMiB: 15,
    memoryPer1kTrafficMiB: 30,
    cpuPer1kTrafficMilli: 100,
    startupDelayTicks: 1,
    spikeToleranceRatio: 1.5,
  },
  nodejs: {
    maxTrafficRpm: 2000,
    baseMemoryMiB: 60,
    memoryPer1kTrafficMiB: 64,
    cpuPer1kTrafficMilli: 200,
    startupDelayTicks: 2,
    spikeToleranceRatio: 1.2,
  },
  python: {
    maxTrafficRpm: 800,
    baseMemoryMiB: 80,
    memoryPer1kTrafficMiB: 96,
    cpuPer1kTrafficMilli: 250,
    startupDelayTicks: 3,
    spikeToleranceRatio: 1.15,
  },
  php: {
    maxTrafficRpm: 1200,
    baseMemoryMiB: 50,
    memoryPer1kTrafficMiB: 80,
    cpuPer1kTrafficMilli: 220,
    startupDelayTicks: 2,
    spikeToleranceRatio: 1.2,
  },
  webserver: {
    maxTrafficRpm: 10000,
    baseMemoryMiB: 12,
    memoryPer1kTrafficMiB: 16,
    cpuPer1kTrafficMilli: 80,
    startupDelayTicks: 1,
    spikeToleranceRatio: 2.0,
  },
  cache: {
    maxTrafficRpm: 50000,
    baseMemoryMiB: 20,
    memoryPer1kTrafficMiB: 50,
    cpuPer1kTrafficMilli: 60,
    startupDelayTicks: 1,
    spikeToleranceRatio: 2.5,
  },
  database: {
    maxTrafficRpm: 1500,
    baseMemoryMiB: 128,
    memoryPer1kTrafficMiB: 100,
    cpuPer1kTrafficMilli: 300,
    startupDelayTicks: 4,
    spikeToleranceRatio: 1.25,
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
