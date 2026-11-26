import mainScenarios from './main-scenarios.json';
import pvcScenarios from './pvc-scenarios.json';
import configScenarios from './config-scenarios.json';

export type ScenarioLevel = 'Basic' | 'Intermediate' | 'Advanced';

export interface Scenario {
  id: string;
  name: string;
  /** Canonical tier used for grouping, sorting, and local-readiness checks. */
  difficulty: ScenarioLevel;
  /** Display alias kept for existing UI and tests. */
  level: ScenarioLevel;
  description: string;
  data: {
    nodes: any[];
    edges: any[];
  };
}

const difficultyWeight: Record<ScenarioLevel, number> = {
  Basic: 0,
  Intermediate: 1,
  Advanced: 2,
};

const normalizeScenario = (source: any): Scenario => {
  const difficulty = (source.difficulty || source.level || 'Basic') as ScenarioLevel;
  return {
    id: source.id,
    name: source.name,
    difficulty,
    level: difficulty,
    description: source.description,
    data: source.data || {
      nodes: source.nodes || [],
      edges: source.edges || [],
    },
  };
};

export const scenarios: Scenario[] = [
  ...mainScenarios,
  ...pvcScenarios,
  ...configScenarios,
]
  .map(normalizeScenario)
  .sort((a, b) => difficultyWeight[a.difficulty] - difficultyWeight[b.difficulty]);

export * from './scenarioDetector';
