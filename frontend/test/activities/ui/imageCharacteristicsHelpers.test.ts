import { describe, it, expect } from 'vitest';
import { createRuntimePreset, getImageCharacteristics } from '@/activities/ui/imageCharacteristicsHelpers';

describe('imageCharacteristicsHelpers', () => {
  it('creates runtime preset with default base values', () => {
    const javaPreset = createRuntimePreset('java');
    expect(javaPreset.maxTraffic).toBe('1k req/m');
    expect(javaPreset.ramWeight).toContain('Heavy');
  });

  it('applies overrides to base preset', () => {
    const customGo = createRuntimePreset('golang', {
      maxTraffic: '10k req/m',
    });

    expect(customGo.maxTraffic).toBe('10k req/m');
    expect(customGo.ramWeight).toContain('Ultra Light');
  });

  it('resolves image characteristics by image name', () => {
    const javaChars = getImageCharacteristics('openjdk:17-jdk-slim');
    expect(javaChars.maxTraffic).toBe('1k req/m');

    const goChars = getImageCharacteristics('golang:1.21-alpine');
    expect(goChars.maxTraffic).toBe('5k req/m');

    const nodeChars = getImageCharacteristics('node:18-alpine');
    expect(nodeChars.maxTraffic).toBe('2k req/m');

    const pythonChars = getImageCharacteristics('python:3.11-slim');
    expect(pythonChars.maxTraffic).toBe('800 req/m');

    const nginxChars = getImageCharacteristics('nginx:latest');
    expect(nginxChars.maxTraffic).toBe('10k req/m');

    const genericChars = getImageCharacteristics('custom-app:1.0');
    expect(genericChars.maxTraffic).toBe('1k req/m');
  });
});
