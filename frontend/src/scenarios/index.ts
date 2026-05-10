import mainScenarios from './main-scenarios.json';
import pvcScenarios from './pvc-scenarios.json';

export interface Scenario {
  id: string;
  name: string;
  level: 'Basic' | 'Intermediate' | 'Advanced';
  description: string;
  data: {
    nodes: any[];
    edges: any[];
  };
}

const levelWeight = {
  'Basic': 0,
  'Intermediate': 1,
  'Advanced': 2
};

export const scenarios: Scenario[] = ([
  ...mainScenarios,
  ...pvcScenarios.map((s: any) => ({
    id: s.id,
    name: s.name,
    level: (s.difficulty || s.level),
    description: s.description,
    data: s.data || { nodes: s.nodes, edges: s.edges }
  }))
] as Scenario[]).sort((a, b) => levelWeight[a.level] - levelWeight[b.level]);
