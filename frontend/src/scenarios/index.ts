import basic from './basic.json';
import intermediate from './intermediate.json';
import advanced from './advanced.json';
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

export const scenarios: Scenario[] = [
  {
    id: 'basic-web',
    name: 'Simple Web Service',
    level: 'Basic',
    description: 'A simple setup with a Service connected to a single Pod.',
    data: basic
  },
  {
    id: 'intermediate-lb',
    name: 'Load Balanced App',
    level: 'Intermediate',
    description: 'An Ingress exposing a Service that distributes traffic to multiple Pods in a Deployment.',
    data: intermediate
  },
  {
    id: 'advanced-scaling',
    name: 'Scalable Microservice',
    level: 'Advanced',
    description: 'A production-ready setup inside a Namespace with Ingress, Service, Deployment, and HPA for auto-scaling.',
    data: advanced
  },
  ...pvcScenarios.map(s => ({
    id: s.id,
    name: s.name,
    level: s.difficulty as any,
    description: s.description,
    data: { nodes: s.nodes, edges: s.edges }
  }))
];
