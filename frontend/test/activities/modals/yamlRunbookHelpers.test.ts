import { describe, it, expect } from 'vitest';
import { buildYamlRunbook, getLocalPodCeiling } from '@/activities/modals/yamlRunbookHelpers';

const stepById = (steps: ReturnType<typeof buildYamlRunbook>, id: string) =>
  steps.find((step) => step.id === id);

const READY_YAML = [
  'apiVersion: v1',
  'kind: Pod',
  'metadata:',
  '  name: web',
  '  labels:',
  '    app: web',
  'spec:',
  '  containers:',
  '    - name: web',
  '      image: nginx:latest',
  '      ports:',
  '        - containerPort: 80',
  '---',
  'apiVersion: v1',
  'kind: Service',
  'metadata:',
  '  name: web-svc',
  'spec:',
  '  selector:',
  '    app: web',
  '  ports:',
  '    - port: 80',
  '      targetPort: 80',
].join('\n');

describe('buildYamlRunbook', () => {
  it('returns no steps for empty or unparseable content', () => {
    expect(buildYamlRunbook('')).toEqual([]);
    expect(buildYamlRunbook('not: [valid: yaml')).toEqual([]);
  });

  it('always includes docker-desktop context, save, apply, verify, and port-forward steps', () => {
    const steps = buildYamlRunbook(READY_YAML);

    expect(steps.map((step) => step.id)).toEqual([
      'docker-desktop-context',
      'save-manifest',
      'apply-manifest',
      'verify-resources',
      'port-forward',
      'cleanup',
    ]);
    expect(stepById(steps, 'docker-desktop-context')?.commands).toEqual([
      { command: 'kubectl config use-context docker-desktop' },
    ]);
    expect(stepById(steps, 'apply-manifest')?.commands).toEqual([
      { command: 'kubectl apply -f infra.yaml' },
    ]);
    expect(stepById(steps, 'verify-resources')?.commands[0].command).toBe('kubectl get all');
    expect(stepById(steps, 'cleanup')?.commands).toEqual([
      { command: 'kubectl delete -f infra.yaml' },
    ]);
    expect(stepById(steps, 'browser-test-warnings')).toBeUndefined();
  });

  it('adds a port-forward command and localhost URL for each Service port', () => {
    const content = READY_YAML.replace('  name: web-svc', '  name: web-svc\n  namespace: production');
    const step = stepById(buildYamlRunbook(content), 'port-forward');

    expect(step?.commands).toEqual([
      { command: 'kubectl port-forward svc/web-svc 8080:80 -n production' },
    ]);
    expect(step?.urls).toEqual(['http://localhost:8080']);
  });

  it('provides native direct URLs and notes for LoadBalancer services in Docker Desktop', () => {
    const content = READY_YAML.replace(
      'spec:\n  selector:',
      'spec:\n  type: LoadBalancer\n  selector:'
    );
    const step = stepById(buildYamlRunbook(content), 'port-forward');

    expect(step?.urls).toEqual(['http://localhost:80', 'http://localhost:8080']);
    expect(step?.commands).toEqual([
      { command: 'kubectl port-forward svc/web-svc 8080:80' },
    ]);
    expect(step?.description).toContain('Docker Desktop natively routes LoadBalancer and NodePort services');
    const note = step?.notes?.join(' ') || '';
    expect(note).toContain('Service web-svc is a LoadBalancer');
    expect(note).toContain('http://localhost:80');
  });

  it('provides native direct URL for NodePort services with explicit nodePort', () => {
    const content = READY_YAML.replace(
      'spec:\n  selector:',
      'spec:\n  type: NodePort\n  selector:'
    ).replace(
      '      targetPort: 80',
      '      targetPort: 80\n      nodePort: 30080'
    );
    const step = stepById(buildYamlRunbook(content), 'port-forward');

    expect(step?.urls).toEqual(['http://localhost:30080', 'http://localhost:8080']);
    const note = step?.notes?.join(' ') || '';
    expect(note).toContain('Service web-svc is a NodePort');
    expect(note).toContain('http://localhost:30080');
  });

  it('explains dynamic port assignment for NodePort services without explicit nodePort', () => {
    const content = READY_YAML.replace(
      'spec:\n  selector:',
      'spec:\n  type: NodePort\n  selector:'
    );
    const step = stepById(buildYamlRunbook(content), 'port-forward');

    expect(step?.urls).toEqual(['http://localhost:8080']);
    const note = step?.notes?.join(' ') || '';
    expect(note).toContain('dynamic port (30000-32767)');
  });

  it('creates a namespace step that ignores system namespaces and sorts the rest', () => {
    const content = [
      'apiVersion: v1',
      'kind: Pod',
      'metadata:',
      '  name: api',
      '  namespace: production',
      '---',
      'apiVersion: v1',
      'kind: Pod',
      'metadata:',
      '  name: cache',
      '  namespace: staging',
      '---',
      'apiVersion: v1',
      'kind: Pod',
      'metadata:',
      '  name: system',
      '  namespace: kube-system',
      '---',
      'apiVersion: v1',
      'kind: Namespace',
      'metadata:',
      '  name: production',
      '---',
      'apiVersion: v1',
      'kind: Namespace',
      'metadata:',
      '  name: default',
    ].join('\n');

    const step = stepById(buildYamlRunbook(content), 'create-namespaces');

    expect(step).toBeDefined();
    expect(step?.commands).toEqual([
      { command: 'kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -' },
      { command: 'kubectl create namespace staging --dry-run=client -o yaml | kubectl apply -f -' },
    ]);
  });

  it('adds a metrics-server step only when an HPA exists', () => {
    const hpa = buildYamlRunbook('apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: api');
    expect(stepById(hpa, 'metrics-server')).toBeDefined();
    expect(stepById(hpa, 'metrics-server')?.commands[0].command).toContain('metrics-server');

    const pod = buildYamlRunbook('apiVersion: v1\nkind: Pod\nmetadata:\n  name: web');
    expect(stepById(pod, 'metrics-server')).toBeUndefined();
  });

  it('adds ingress controller steps for each class, defaulting to nginx', () => {
    const content = [
      'apiVersion: networking.k8s.io/v1',
      'kind: Ingress',
      'metadata:',
      '  name: web',
      'spec:',
      '  ingressClassName: nginx',
      '---',
      'apiVersion: networking.k8s.io/v1',
      'kind: Ingress',
      'metadata:',
      '  name: admin',
      'spec:',
      '  ingressClassName: traefik',
      '---',
      'apiVersion: networking.k8s.io/v1',
      'kind: Ingress',
      'metadata:',
      '  name: default-class',
    ].join('\n');

    const steps = buildYamlRunbook(content);

    expect(stepById(steps, 'ingress-nginx')).toBeDefined();
    expect(stepById(steps, 'ingress-traefik')).toBeDefined();
    expect(stepById(steps, 'ingress-nginx')?.commands[0].command).toContain('ingress-nginx');
    expect(stepById(steps, 'ingress-traefik')?.commands[0].command).toContain('helm repo add traefik');
  });

  it('adds a storage class check for PVCs and StatefulSet volume claim templates', () => {
    const content = [
      'apiVersion: v1',
      'kind: PersistentVolumeClaim',
      'metadata:',
      '  name: data',
      'spec:',
      '  storageClassName: fast-ssd',
      '---',
      'apiVersion: apps/v1',
      'kind: StatefulSet',
      'metadata:',
      '  name: db',
      'spec:',
      '  volumeClaimTemplates:',
      '    - metadata:',
      '        name: data',
      '      spec:',
      '        storageClassName: standard',
    ].join('\n');

    const step = stepById(buildYamlRunbook(content), 'storage-classes');

    expect(step).toBeDefined();
    expect(step?.commands[0].command).toBe('kubectl get storageclass fast-ssd standard');
  });

  it('includes namespace and extra resource types in verification commands', () => {
    const content = [
      'apiVersion: v1',
      'kind: Pod',
      'metadata:',
      '  name: api',
      '  namespace: production',
      '---',
      'apiVersion: autoscaling/v2',
      'kind: HorizontalPodAutoscaler',
      'metadata:',
      '  name: api',
      '  namespace: production',
    ].join('\n');

    const step = stepById(buildYamlRunbook(content), 'verify-resources');

    expect(step?.commands).toEqual([
      { command: 'kubectl get all,hpa -n production' },
    ]);
  });

  it('warns explicitly when the canvas lacks cards needed for a browser test', () => {
    const steps = buildYamlRunbook('apiVersion: v1\nkind: Pod\nmetadata:\n  name: web');
    const warning = stepById(steps, 'browser-test-warnings');
    const notes = warning?.notes?.join(' ') || '';

    expect(warning?.tone).toBe('warning');
    expect(notes).toContain('no Service card');
    expect(notes).toContain('no container image');
    expect(stepById(steps, 'port-forward')).toBeUndefined();
  });

  it('warns when a Service selector does not match any workload', () => {
    const content = READY_YAML.replace('  selector:\n    app: web', '  selector:\n    app: other');
    const notes = stepById(buildYamlRunbook(content), 'browser-test-warnings')?.notes?.join(' ') || '';

    expect(notes).toContain('selector does not match any workload');
    expect(notes).toContain('kubectl get endpoints web-svc');
  });

  it('warns when a Service has no selector toggle enabled', () => {
    const content = READY_YAML.replace('  selector:\n    app: web\n', '');
    const notes = stepById(buildYamlRunbook(content), 'browser-test-warnings')?.notes?.join(' ') || '';

    expect(notes).toContain('has no selector');
  });

  it('warns when replicas is zero', () => {
    const content = [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: api',
      'spec:',
      '  replicas: 0',
      '  selector:',
      '    matchLabels:',
      '      app: api',
      '  template:',
      '    metadata:',
      '      labels:',
      '        app: api',
      '    spec:',
      '      containers:',
      '        - name: api',
      '          image: nginx:latest',
    ].join('\n');
    const notes = stepById(buildYamlRunbook(content), 'browser-test-warnings')?.notes?.join(' ') || '';

    expect(notes).toContain('replicas: 0');
  });

  it('treats an Ingress-controller Service as valid without offering a 404 localhost URL', () => {
    const content = READY_YAML.replace(
      '  selector:\n    app: web',
      '  selector:\n    app.kubernetes.io/name: ingress-nginx\n    app.kubernetes.io/component: controller'
    );
    const steps = buildYamlRunbook(content);
    const step = stepById(steps, 'port-forward');

    expect(stepById(steps, 'browser-test-warnings')).toBeUndefined();
    expect(step?.notes?.join(' ')).toContain('targets the Ingress controller');
    expect(step?.urls).toEqual([]);
  });

  it('uses the Ingress host URL instead of localhost for Ingress-controller Services', () => {
    const ingressService = READY_YAML.replace(
      '  selector:\n    app: web',
      '  selector:\n    app.kubernetes.io/name: ingress-nginx\n    app.kubernetes.io/component: controller'
    );
    const ingressDoc = [
      '---',
      'apiVersion: networking.k8s.io/v1',
      'kind: Ingress',
      'metadata:',
      '  name: web-ingress',
      'spec:',
      '  ingressClassName: nginx',
      '  rules:',
      '    - host: app.example.local',
      '      http:',
      '        paths:',
      '          - path: /',
      '            pathType: Prefix',
      '            backend:',
      '              service:',
      '                name: web-svc',
      '                port:',
      '                  number: 80',
    ].join('\n');

    const step = stepById(buildYamlRunbook(`${ingressService}\n${ingressDoc}`), 'port-forward');

    expect(step?.commands).toEqual([
      { command: 'kubectl port-forward svc/web-svc 80:80' },
    ]);
    expect(step?.urls).toEqual(['http://app.example.local/']);
    expect(step?.notes?.join(' ')).toContain('127.0.0.1 app.example.local');
    expect(step?.notes?.join(' ')).toContain('hosts file');
  });

  it('explains when a workload image cannot serve a browser page', () => {
    const content = READY_YAML.replace('nginx:latest', 'golang:1.21-alpine');
    const notes = stepById(buildYamlRunbook(content), 'port-forward')?.notes?.join(' ') || '';

    expect(notes).toContain('golang:1.21-alpine');
    expect(notes).toContain('not an HTTP server');
  });

  it('warns when replicas exceed the safe local capacity', () => {
    const content = [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: web',
      'spec:',
      `  replicas: ${getLocalPodCeiling() + 5}`,
      '  selector:',
      '    matchLabels:',
      '      app: web',
      '  template:',
      '    metadata:',
      '      labels:',
      '        app: web',
      '    spec:',
      '      containers:',
      '        - name: web',
      '          image: nginx:latest',
      '---',
      'apiVersion: v1',
      'kind: Service',
      'metadata:',
      '  name: web-svc',
      'spec:',
      '  selector:',
      '    app: web',
      '  ports:',
      '    - port: 80',
    ].join('\n');
    const steps = buildYamlRunbook(content);
    const notes = stepById(steps, 'browser-test-warnings')?.notes?.join(' ') || '';

    expect(notes).toContain('above the safe local ceiling');
    expect(notes).toContain('Reduce replicas');
  });

  it('partitions runbook steps cleanly across the 3 workflow stages', () => {
    const steps = buildYamlRunbook(READY_YAML);
    expect(stepById(steps, 'docker-desktop-context')?.stage).toBe('prerequisites');
    expect(stepById(steps, 'save-manifest')?.stage).toBe('manifest');
    expect(stepById(steps, 'apply-manifest')?.stage).toBe('manifest');
    expect(stepById(steps, 'verify-resources')?.stage).toBe('localhost');
    expect(stepById(steps, 'port-forward')?.stage).toBe('localhost');
    expect(stepById(steps, 'cleanup')?.stage).toBe('localhost');
  });
});
