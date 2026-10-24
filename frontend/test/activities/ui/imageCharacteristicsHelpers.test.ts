import { describe, it, expect } from 'vitest';
import { createRuntimePreset, getImageCharacteristics, evaluateImageResourceConsumption } from '@/activities/ui/imageCharacteristicsHelpers';

describe('imageCharacteristicsHelpers', () => {
  it('creates runtime preset with default base values', () => {
    const javaPreset = createRuntimePreset('java');
    expect(javaPreset.maxTrafficRpm).toBe(1200);
    expect(javaPreset.baseMemoryMiB).toBe(220);
  });

  it('applies overrides to base preset', () => {
    const customGo = createRuntimePreset('golang', {
      maxTrafficRpm: 10000,
    });

    expect(customGo.maxTrafficRpm).toBe(10000);
    expect(customGo.baseMemoryMiB).toBe(12);
  });

  it('resolves image characteristics by image name', () => {
    const javaChars = getImageCharacteristics('openjdk:21-jdk-slim');
    expect(javaChars.maxTrafficRpm).toBe(1200);

    const goChars = getImageCharacteristics('golang:1.24-alpine');
    expect(goChars.maxTrafficRpm).toBe(6000);

    const nodeChars = getImageCharacteristics('node:22-alpine');
    expect(nodeChars.maxTrafficRpm).toBe(2500);

    const pythonChars = getImageCharacteristics('python:3.12-slim');
    expect(pythonChars.maxTrafficRpm).toBe(1000);

    const nginxChars = getImageCharacteristics('nginx:latest');
    expect(nginxChars.maxTrafficRpm).toBe(12000);

    const genericChars = getImageCharacteristics('custom-app:1.0');
    expect(genericChars.maxTrafficRpm).toBe(1000);
  });

  it('evaluates realistic resource consumption based on container image and traffic', () => {
    const javaRes = evaluateImageResourceConsumption('openjdk:21-jdk-slim', 1000, 1, 0);
    expect(javaRes.memValue).toBeGreaterThan(200); // Java 21 base RAM ~220MB

    const goRes = evaluateImageResourceConsumption('golang:1.24-alpine', 1000, 1, 0);
    expect(goRes.memValue).toBeLessThan(100); // Go 1.24 base RAM ~12MB

    expect(javaRes.memValue).toBeGreaterThan(goRes.memValue);
  });
});
