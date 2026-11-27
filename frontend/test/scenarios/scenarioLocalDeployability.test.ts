import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scenarios } from '@/scenarios';
import { generateYamlClientSide } from '@/lib/manifestGenerator';
import { buildYamlRunbook, getLocalPodCeiling } from '@/activities/modals/yamlRunbookHelpers';

const WORKLOAD_KINDS = ['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet'];

const countDesiredPods = (documents: any[]): number =>
  documents.reduce((total, doc) => {
    if (!WORKLOAD_KINDS.includes(doc?.kind)) return total;
    return total + (doc.kind === 'Pod' ? 1 : (doc.spec?.replicas ?? 1));
  }, 0);

const resolveKubeconform = (): string | null => {
  try {
    execFileSync('kubeconform', ['-v'], { stdio: 'ignore' });
    return 'kubeconform';
  } catch {
    try {
      const goPath = execFileSync('go', ['env', 'GOPATH'], { encoding: 'utf8' }).trim();
      const candidate = join(goPath, 'bin', process.platform === 'win32' ? 'kubeconform.exe' : 'kubeconform');
      return existsSync(candidate) ? candidate : null;
    } catch {
      return null;
    }
  }
};

describe('scenario local deployability', () => {
  it('keeps every built-in scenario within the safe local pod ceiling', () => {
    const ceiling = getLocalPodCeiling();
    scenarios.forEach((scenario) => {
      const documents = yaml.loadAll(
        generateYamlClientSide(scenario.data.nodes, scenario.data.edges)
      ) as any[];
      expect(countDesiredPods(documents)).toBeLessThanOrEqual(ceiling);
    });
  });

  scenarios.forEach((scenario) => {
    it(`gives ${scenario.id} a runbook that can be applied and tested at localhost`, () => {
      expect(['Basic', 'Intermediate', 'Advanced']).toContain(scenario.difficulty);

      const output = generateYamlClientSide(scenario.data.nodes, scenario.data.edges);
      const documents = (yaml.loadAll(output) as any[]).filter(Boolean);
      expect(documents.length).toBeGreaterThan(0);

      const runbook = buildYamlRunbook(output);
      expect(runbook.find((step) => step.id === 'apply-manifest')).toBeDefined();
      expect(runbook.find((step) => step.id === 'browser-test-warnings')).toBeUndefined();

      const portForward = runbook.find((step) => step.id === 'port-forward');
      expect(portForward?.commands.length).toBeGreaterThan(0);
      expect(portForward?.urls?.length).toBeGreaterThan(0);
      portForward?.urls?.forEach((url) => expect(url).toMatch(/^http:\/\/localhost:\d+$/));
    });
  });

  it('validates every scenario manifest with kubeconform when available', () => {
    const kubeconform = resolveKubeconform();
    if (!kubeconform) return;

    scenarios.forEach((scenario) => {
      const output = generateYamlClientSide(scenario.data.nodes, scenario.data.edges);
      const result = execFileSync(kubeconform, ['-strict', '-summary'], {
        input: output,
        encoding: 'utf8',
      });
      expect(result).toContain('Invalid: 0');
      expect(result).toContain('Errors: 0');
    });
  }, 120_000);

  it('warns when a scenario template is edited beyond local PC capacity', () => {
    const template = scenarios.find((scenario) => scenario.id === 'basic-web');
    expect(template).toBeDefined();

    const nodes = JSON.parse(JSON.stringify(template!.data.nodes));
    const pod = nodes.find((node: any) => node.type === 'Pod');
    pod.data.replicas = getLocalPodCeiling() + 5;

    const output = generateYamlClientSide(nodes, template!.data.edges);
    const warning = buildYamlRunbook(output).find(
      (step) => step.id === 'browser-test-warnings'
    );
    expect(warning?.notes?.join(' ')).toContain('above the safe local ceiling');
    expect(warning?.notes?.join(' ')).toContain('Reduce replicas');
  });
});
