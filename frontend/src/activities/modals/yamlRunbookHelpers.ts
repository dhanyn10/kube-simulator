import yaml from 'js-yaml';
import { toWindowsDisplayPath } from '@/lib/utils';
import { getLocalHardwareSpecs } from '../monitoring/workerBudgetHelpers';

/**
 * Windows hosts file path formatted safely for user guidance without triggering escape rules.
 */
const WINDOWS_HOSTS_PATH = toWindowsDisplayPath('C:/Windows/System32/drivers/etc/hosts');

/**
 * A single command that a user can copy and run from the YAML deployment runbook.
 */
export interface YamlRunbookCommand {
  readonly command: string;
}

/**
 * Stages in the 4-step deployment, verification, and cleanup workflow (matching CI/CD pipeline stages).
 */
export type YamlStage = 'prerequisites' | 'manifest' | 'deploy' | 'cleanup' | 'localhost';

/**
 * One numbered, user-facing step in the YAML deployment runbook.
 */
export interface YamlRunbookStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly commands: YamlRunbookCommand[];
  readonly stage: YamlStage;
  /** True when this step is needed before applying the manifest. */
  readonly requiresSetup?: boolean;
  /** Warnings are highlighted so the user cannot miss an incomplete canvas. */
  readonly tone?: 'warning';
  /** Extra bullets, used to explain warnings in plain language. */
  readonly notes?: string[];
  /** Local URLs the user can open after starting a port-forward. */
  readonly urls?: string[];
}

interface ManifestLabelSelector {
  readonly [key: string]: string;
}

interface ManifestPort {
  readonly port?: number;
  readonly targetPort?: number | string;
  readonly nodePort?: number;
}

interface ManifestContainer {
  readonly image?: string;
  readonly ports?: Array<{ readonly containerPort?: number }>;
}

interface ManifestDocument {
  readonly apiVersion?: string;
  readonly kind?: string;
  readonly metadata?: {
    readonly name?: string;
    readonly namespace?: string;
    readonly labels?: ManifestLabelSelector;
  };
  readonly rules?: Array<{
    readonly apiGroups?: string[];
    readonly resources?: string[];
    readonly verbs?: string[];
  }>;
  readonly roleRef?: {
    readonly apiGroup?: string;
    readonly kind?: string;
    readonly name?: string;
  };
  readonly subjects?: Array<{
    readonly kind?: string;
    readonly name?: string;
    readonly namespace?: string;
  }>;
  readonly spec?: {
    readonly ingressClassName?: string;
    readonly storageClassName?: string;
    readonly type?: string;
    readonly selector?: ManifestLabelSelector;
    readonly ports?: ManifestPort[];
    readonly replicas?: number;
    readonly maxReplicas?: number;
    readonly scaleTargetRef?: {
      readonly apiVersion?: string;
      readonly kind?: string;
      readonly name?: string;
    };
    readonly template?: {
      readonly metadata?: { readonly labels?: ManifestLabelSelector };
      readonly spec?: { readonly containers?: ManifestContainer[] };
    };
    readonly rules?: Array<{
      readonly host?: string;
      readonly http?: {
        readonly paths?: Array<{
          readonly path?: string;
          readonly backend?: { readonly service?: { readonly name?: string } };
        }>;
      };
    }>;
    readonly containers?: ManifestContainer[];
    readonly volumeClaimTemplates?: Array<{
      readonly spec?: { readonly storageClassName?: string };
    }>;
  };
}

interface LocalTestPort {
  readonly serviceName: string;
  readonly namespace?: string;
  readonly port: number;
  readonly nodePort?: number;
  readonly serviceType?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
}

interface IngressRoute {
  readonly host: string;
  readonly path: string;
}

interface LocalTestReadiness {
  readonly warnings: string[];
  readonly ports: LocalTestPort[];
  readonly ingressServiceNames: string[];
  readonly ingressRoutes: IngressRoute[];
  readonly nonHttpImages: string[];
}

/**
 * Conservative number of pods that is safe to run on the current PC.
 * Used to flag scenario templates that a user edited beyond local capacity.
 */
export const getLocalPodCeiling = (): number => {
  const { cpuCores, memoryGb } = getLocalHardwareSpecs();
  return Math.max(10, Math.min(cpuCores * 4, Math.floor(memoryGb * 2)));
};

const SYSTEM_NAMESPACES = new Set([
  'default',
  'kube-system',
  'kube-public',
  'kube-node-lease',
]);

const WORKLOAD_KINDS = new Set(['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet']);

const parseDocuments = (yamlContent: string): ManifestDocument[] => {
  if (!yamlContent.trim()) return [];
  try {
    return yaml
      .loadAll(yamlContent)
      .filter((doc): doc is ManifestDocument => Boolean(doc) && typeof doc === 'object');
  } catch {
    return [];
  }
};

const addIfPresent = (target: Set<string>, value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    target.add(value.trim());
  }
};

const collectNamespaces = (documents: ManifestDocument[]): string[] => {
  const namespaces = new Set<string>();
  documents.forEach((doc) => {
    addIfPresent(namespaces, doc.metadata?.namespace);
    if (doc.kind === 'Namespace') {
      addIfPresent(namespaces, doc.metadata?.name);
    }
  });
  return Array.from(namespaces)
    .filter((namespace) => !SYSTEM_NAMESPACES.has(namespace))
    .sort((a, b) => a.localeCompare(b));
};

const collectIngressClasses = (documents: ManifestDocument[]): string[] => {
  const classes = new Set<string>();
  documents.forEach((doc) => {
    if (doc.kind !== 'Ingress') return;
    classes.add(doc.spec?.ingressClassName || 'nginx');
  });
  return Array.from(classes).sort((a, b) => a.localeCompare(b));
};

const NON_HTTP_IMAGE_BASES = new Set([
  'golang',
  'python',
  'postgres',
  'mysql',
  'mariadb',
  'redis',
  'busybox',
  'alpine',
]);

const collectNonHttpImages = (documents: ManifestDocument[]): string[] => {
  const images = new Set<string>();
  documents.forEach((doc) => {
    const containers = getContainers(doc) || [];
    containers.forEach((container) => {
      const image = container.image;
      if (!image) return;
      const base = image.split('/').pop()?.split(':')[0] || '';
      if (NON_HTTP_IMAGE_BASES.has(base)) images.add(image);
    });
  });
  return Array.from(images).sort((a, b) => a.localeCompare(b));
};

const collectIngressRoutes = (documents: ManifestDocument[]): IngressRoute[] => {
  const routes = new Map<string, IngressRoute>();
  documents.forEach((doc) => {
    if (doc.kind !== 'Ingress') return;
    (doc.spec?.rules || []).forEach((rule) => {
      if (!rule.host) return;
      const paths = rule.http?.paths || [{ path: '/' }];
      paths.forEach((item) => {
        const path = item.path || '/';
        routes.set(`${rule.host}${path}`, { host: rule.host as string, path });
      });
    });
  });
  return Array.from(routes.values());
};

const collectStorageClasses = (documents: ManifestDocument[]): string[] => {
  const storageClasses = new Set<string>();
  documents.forEach((doc) => {
    if (doc.kind === 'PVC' || doc.kind === 'PersistentVolumeClaim') {
      addIfPresent(storageClasses, doc.spec?.storageClassName);
    }
    if (doc.kind === 'StatefulSet' && Array.isArray(doc.spec?.volumeClaimTemplates)) {
      doc.spec.volumeClaimTemplates.forEach((template) => {
        addIfPresent(storageClasses, template.spec?.storageClassName);
      });
    }
  });
  return Array.from(storageClasses).sort((a, b) => a.localeCompare(b));
};

const namespaceFlag = (namespace?: string): string =>
  namespace && namespace !== 'default' ? ` -n ${namespace}` : '';

const getPodLabels = (doc: ManifestDocument): ManifestLabelSelector | undefined =>
  doc.kind === 'Pod' ? doc.metadata?.labels : doc.spec?.template?.metadata?.labels;

const matchesSelector = (
  labels: ManifestLabelSelector | undefined,
  selector: ManifestLabelSelector
): boolean => Object.entries(selector).every(([key, value]) => labels?.[key] === value);

const getContainers = (doc: ManifestDocument): ManifestContainer[] | undefined =>
  doc.kind === 'Pod' ? doc.spec?.containers : doc.spec?.template?.spec?.containers;

const isIngressControllerSelector = (selector: ManifestLabelSelector | undefined): boolean =>
  selector?.['app.kubernetes.io/name'] === 'ingress-nginx';

const resolveServiceType = (type?: string): 'ClusterIP' | 'NodePort' | 'LoadBalancer' => {
  if (type === 'LoadBalancer' || type === 'NodePort') return type;
  return 'ClusterIP';
};

const buildServiceWarnings = (
  services: ManifestDocument[],
  workloads: ManifestDocument[],
  ports: LocalTestPort[],
  ingressServiceNames: string[],
  warnings: string[]
) => {
  services.forEach((service) => {
    const name = service.metadata?.name || 'unnamed-service';
    const flag = namespaceFlag(service.metadata?.namespace);
    const servicePorts = service.spec?.ports || [];
    const serviceType = resolveServiceType(service.spec?.type);

    servicePorts.forEach((item) => {
      if (typeof item.port === 'number' && item.port > 0) {
        ports.push({
          serviceName: name,
          namespace: service.metadata?.namespace,
          port: item.port,
          nodePort: typeof item.nodePort === 'number' && item.nodePort > 0 ? item.nodePort : undefined,
          serviceType,
        });
      }
    });

    if (servicePorts.length === 0) {
      warnings.push(
        `Service ${name} has no port. Set the port on the Service card, otherwise port-forward cannot reach your app.`
      );
    }

    const selector = service.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) {
      warnings.push(
        `Service ${name} has no selector. Check the "selector" toggle on the Service card and connect the Service to a Pod/Deployment. Without a selector there are no endpoints to forward to.`
      );
      return;
    }

    if (isIngressControllerSelector(selector)) {
      ingressServiceNames.push(name);
      return;
    }

    if (!workloads.some((workload) => matchesSelector(getPodLabels(workload), selector))) {
      warnings.push(
        `Service ${name} selector does not match any workload in this YAML. Connect the Service card to a Pod/Deployment card (or fix its selector) before testing at localhost. Diagnostic: kubectl get endpoints ${name}${flag}.`
      );
    }
  });
};

const buildWorkloadWarnings = (workloads: ManifestDocument[], warnings: string[]) => {
  workloads.forEach((workload) => {
    const kind = workload.kind;
    const name = workload.metadata?.name || 'unnamed-workload';
    const containers = getContainers(workload) || [];

    if (containers.length === 0 || containers.some((container) => !container.image)) {
      warnings.push(
        `${kind} ${name} has no container image. Set the image on that card, otherwise the pod cannot start and there is nothing to open in the browser.`
      );
    }
    if (workload.spec?.replicas === 0) {
      warnings.push(
        `${kind} ${name} has replicas: 0. Set replicas to at least 1 to get a running pod for browser testing.`
      );
    }
  });
};

const checkIngressPaths = (
  paths: Array<{ readonly path?: string; readonly backend?: { readonly service?: { readonly name?: string } } }>,
  serviceNames: Set<string>,
  ingressName: string,
  warnings: string[]
): boolean => {
  let hasBackend = false;
  for (const p of paths) {
    const backendName = p.backend?.service?.name;
    if (backendName) {
      hasBackend = true;
      if (!serviceNames.has(backendName)) {
        warnings.push(
          `Ingress ${ingressName} references Service "${backendName}", but no Service with that name exists in this YAML. Connect the Ingress card to a valid Service card.`
        );
      }
    }
  }
  return hasBackend;
};

const buildIngressWarnings = (
  documents: ManifestDocument[],
  services: ManifestDocument[],
  warnings: string[]
) => {
  const ingresses = documents.filter((doc) => doc.kind === 'Ingress');
  if (ingresses.length === 0) return;

  const serviceNames = new Set(
    services
      .map((s) => s.metadata?.name)
      .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
  );

  for (const ingress of ingresses) {
    const name = ingress.metadata?.name || 'unnamed-ingress';
    const rules = ingress.spec?.rules || [];
    if (rules.length === 0) {
      warnings.push(`Ingress ${name} has no routing rules defined. Connect it to a Service card.`);
      continue;
    }
    const paths = rules.flatMap((r) => r.http?.paths || []);
    const hasBackend = checkIngressPaths(paths, serviceNames, name, warnings);
    if (!hasBackend) {
      warnings.push(
        `Ingress ${name} has no backend Service configured. Connect the Ingress card to a Service card to direct traffic.`
      );
    }
  }
};

const buildHpaWarnings = (
  documents: ManifestDocument[],
  workloads: ManifestDocument[],
  warnings: string[]
) => {
  const hpas = documents.filter((doc) => doc.kind === 'HorizontalPodAutoscaler');
  if (hpas.length === 0) return;

  const workloadNames = new Set(
    workloads
      .map((w) => w.metadata?.name)
      .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
  );

  for (const hpa of hpas) {
    const name = hpa.metadata?.name || 'unnamed-hpa';
    const targetName = hpa.spec?.scaleTargetRef?.name;
    if (!targetName) {
      warnings.push(
        `HPA ${name} has no scale target workload configured. Connect the HPA card to a Deployment or StatefulSet card.`
      );
    } else if (!workloadNames.has(targetName)) {
      warnings.push(
        `HPA ${name} targets workload "${targetName}", but no workload with that name exists in this YAML. Connect the HPA card to a Deployment or StatefulSet card.`
      );
    }
  }
};

const buildRoleWarnings = (documents: ManifestDocument[], warnings: string[]) => {
  const roles = documents.filter((doc) => doc.kind === 'Role' || doc.kind === 'ClusterRole');
  for (const role of roles) {
    const name = role.metadata?.name || 'unnamed-role';
    const rules = role.rules || [];
    if (rules.length === 0) {
      warnings.push(
        `${role.kind} ${name} has no permission rules defined. Add at least one rule specifying apiGroups, resources, and verbs.`
      );
    }
  }
};

const buildBindingWarnings = (
  documents: ManifestDocument[],
  roleNames: Set<string>,
  warnings: string[]
) => {
  const bindings = documents.filter(
    (doc) => doc.kind === 'RoleBinding' || doc.kind === 'ClusterRoleBinding'
  );
  for (const binding of bindings) {
    const name = binding.metadata?.name || 'unnamed-binding';
    const subjects = binding.subjects || [];
    if (subjects.length === 0) {
      warnings.push(
        `${binding.kind} ${name} has no subjects assigned. Assign at least one ServiceAccount or user subject.`
      );
    }
    const roleRefName = binding.roleRef?.name;
    if (roleRefName && !roleNames.has(roleRefName)) {
      warnings.push(
        `${binding.kind} ${name} references role "${roleRefName}", but no matching Role or ClusterRole exists in this YAML.`
      );
    }
  }
};

const buildRbacWarnings = (documents: ManifestDocument[], warnings: string[]) => {
  buildRoleWarnings(documents, warnings);
  const roleNames = new Set(
    documents
      .filter((doc) => doc.kind === 'Role' || doc.kind === 'ClusterRole')
      .map((doc) => doc.metadata?.name)
      .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
  );
  buildBindingWarnings(documents, roleNames, warnings);
};

const addCapacityWarnings = (documents: ManifestDocument[], warnings: string[]) => {
  const safeCeiling = getLocalPodCeiling();
  const desiredPods = documents.reduce((total, doc) => {
    if (!WORKLOAD_KINDS.has(doc.kind || '')) return total;
    return total + (doc.kind === 'Pod' ? 1 : (doc.spec?.replicas ?? 1));
  }, 0);

  if (desiredPods > safeCeiling) {
    warnings.push(
      `This YAML asks for ${desiredPods} pods, above the safe local ceiling of about ${safeCeiling}. You likely increased replicas from the scenario template. Reduce replicas before testing on this PC.`
    );
  }

  documents.forEach((doc) => {
    const maxReplicas = doc.kind === 'HorizontalPodAutoscaler' ? doc.spec?.maxReplicas : undefined;
    if (typeof maxReplicas === 'number' && maxReplicas > safeCeiling) {
      warnings.push(
        `HPA ${doc.metadata?.name || 'unnamed-hpa'} has maxReplicas: ${maxReplicas}, which can exceed this PC's capacity (~${safeCeiling} pods). Lower maxReplicas for a local test.`
      );
    }
  });
};

export const analyzeLocalTestReadiness = (documents: ManifestDocument[]): LocalTestReadiness => {
  const warnings: string[] = [];
  const ports: LocalTestPort[] = [];
  const ingressServiceNames: string[] = [];
  const ingressRoutes = collectIngressRoutes(documents);
  const nonHttpImages = collectNonHttpImages(documents);
  const workloads = documents.filter((doc) => WORKLOAD_KINDS.has(doc.kind || ''));
  const services = documents.filter((doc) => doc.kind === 'Service');

  if (services.length === 0) {
    warnings.push(
      'There is no Service card in this design. Add a Service card and connect it to a Pod/Deployment card; kubectl port-forward needs a Service to expose localhost.'
    );
  }
  if (workloads.length === 0) {
    warnings.push(
      'There is no Pod, Deployment, StatefulSet, or ReplicaSet card in this design. Add a workload card with a container image before expecting a live browser test.'
    );
  }

  buildServiceWarnings(services, workloads, ports, ingressServiceNames, warnings);
  buildWorkloadWarnings(workloads, warnings);
  buildIngressWarnings(documents, services, warnings);
  buildHpaWarnings(documents, workloads, warnings);
  buildRbacWarnings(documents, warnings);
  addCapacityWarnings(documents, warnings);

  return { warnings, ports, ingressServiceNames, ingressRoutes, nonHttpImages };
};

const buildDockerDesktopContextStep = (): YamlRunbookStep => ({
  id: 'docker-desktop-context',
  title: 'Target your Docker Desktop cluster',
  description: 'Make sure your terminal commands target your local Docker Desktop Kubernetes cluster.',
  commands: [{ command: 'kubectl config use-context docker-desktop' }],
  stage: 'prerequisites',
});

const buildNamespaceStep = (namespaces: string[]): YamlRunbookStep | null => {
  if (namespaces.length === 0) return null;
  return {
    id: 'create-namespaces',
    title: 'Create the namespaces first',
    description: `The manifest contains resources in: ${namespaces.join(', ')}. Run this before kubectl apply. The commands are safe to run again if a namespace already exists.`,
    commands: namespaces.map((namespace) => ({
      command: `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`,
    })),
    requiresSetup: true,
    stage: 'prerequisites',
  };
};

const buildHpaStep = (documents: ManifestDocument[]): YamlRunbookStep | null => {
  if (!documents.some((doc) => doc.kind === 'HorizontalPodAutoscaler')) return null;
  return {
    id: 'metrics-server',
    title: 'Install the Kubernetes Metrics Server',
    description:
      'HorizontalPodAutoscaler needs the Metrics Server to read CPU and memory usage. In Docker Desktop, the deployment is patched with --kubelet-insecure-tls to bypass local self-signed certificate checks. Skip this step if metrics-server is already running.',
    commands: [
      {
        command:
          'kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
      },
      {
        command:
          `kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'`,
      },
      {
        command:
          'kubectl rollout status deployment/metrics-server -n kube-system --timeout=120s',
      },
      { command: 'kubectl top pods' },
    ],
    notes: [
      'Docker Desktop uses self-signed Kubelet certificates. The patch adds --kubelet-insecure-tls so Metrics Server can scrape CPU and memory without TLS SAN validation errors.',
    ],
    requiresSetup: true,
    stage: 'prerequisites',
  };
};

const buildIngressStep = (ingressClass: string): YamlRunbookStep => {
  if (ingressClass === 'traefik') {
    return {
      id: 'ingress-traefik',
      title: 'Install the Traefik Ingress Controller',
      description: 'Ingress resources use ingressClassName: traefik. Skip this step if Traefik is already installed.',
      commands: [
        { command: 'helm repo add traefik https://traefik.github.io/charts' },
        { command: 'helm repo update' },
        { command: 'helm install traefik traefik/traefik' },
      ],
      requiresSetup: true,
      stage: 'prerequisites',
    };
  }

  return {
    id: `ingress-${ingressClass}`,
    title: `Install the ${ingressClass} Ingress Controller`,
    description: `Ingress resources use ingressClassName: ${ingressClass}. Skip this step if the controller is already installed.`,
    commands: [
      { command: 'kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/cloud/deploy.yaml' },
      { command: 'kubectl get pods -n ingress-nginx' },
    ],
    requiresSetup: true,
    stage: 'prerequisites',
  };
};

const buildStorageStep = (storageClasses: string[]): YamlRunbookStep | null => {
  if (storageClasses.length === 0) return null;

  const nonHostpath = storageClasses.filter((sc) => sc !== 'hostpath');
  const notes: string[] = [];

  if (nonHostpath.length > 0) {
    notes.push(
      `Docker Desktop only provides the "hostpath" StorageClass by default. If ${nonHostpath.join(', ')} is not provisioned on your cluster, PVCs will remain Pending. Change storageClassName to "hostpath" on your PVC / StatefulSet cards, or create matching StorageClasses.`
    );
  } else {
    notes.push(
      'Docker Desktop provides the "hostpath" StorageClass out of the box, so PVCs will bind immediately.'
    );
  }

  return {
    id: 'storage-classes',
    title: 'Make sure the StorageClass exists',
    description: `PersistentVolumeClaims request: ${storageClasses.join(', ')}. If the StorageClass is missing, PVCs stay Pending. Install a storage provisioner or change storageClassName in the manifest.`,
    commands: [
      { command: `kubectl get storageclass ${storageClasses.join(' ')}` },
    ],
    notes,
    requiresSetup: true,
    stage: 'prerequisites',
  };
};

const buildVerifyStep = (
  documents: ManifestDocument[],
  namespaces: string[]
): YamlRunbookStep => {
  const kinds = new Set(documents.map((doc) => doc.kind).filter(Boolean));
  const extraTypes = ['ingress', 'hpa', 'pvc'].filter((type) => {
    if (type === 'ingress') return kinds.has('Ingress');
    if (type === 'hpa') return kinds.has('HorizontalPodAutoscaler');
    return kinds.has('PVC') || kinds.has('PersistentVolumeClaim');
  });
  const suffix = extraTypes.length > 0 ? `,${extraTypes.join(',')}` : '';
  const targets = namespaces.length > 0 ? namespaces : [''];

  return {
    id: 'verify-resources',
    title: 'Verify that the resources are running',
    description: 'Wait a few seconds, then check that pods and services are created. If a pod is not Running, use kubectl describe pod <pod-name> to see the reason.',
    commands: targets.map((namespace) => ({
      command: `kubectl get all${suffix}${namespaceFlag(namespace)}`,
    })),
    stage: 'deploy',
  };
};

const buildBrowserWarningStep = (warnings: string[]): YamlRunbookStep | null => {
  if (warnings.length === 0) return null;
  return {
    id: 'browser-test-warnings',
    title: 'The design is not ready for a browser test yet',
    description: 'Fix these gaps on the canvas, regenerate the YAML, and then repeat the deployment steps. Port-forward will not work until they are resolved.',
    commands: [],
    notes: warnings,
    tone: 'warning',
    stage: 'deploy',
  };
};

interface LocalTestTarget {
  readonly item: LocalTestPort;
  readonly localPort: number;
  readonly isIngress: boolean;
}

const getAppLocalPort = (port: number): number => (port === 80 ? 8080 : port);

const assignLocalPort = (port: number, isIngress: boolean, used: Set<number>): number => {
  let candidate = isIngress ? 80 : getAppLocalPort(port);
  while (used.has(candidate)) {
    candidate += 1;
  }
  used.add(candidate);
  return candidate;
};

/**
 * Ingress-controller Services return nginx 404 on localhost because the Host
 * header does not match any Ingress rule. Explain the correct URL instead of
 * offering a localhost link that cannot work.
 */
const buildIngressTargetNotes = (
  target: LocalTestTarget,
  routes: IngressRoute[]
): string[] => {
  if (routes.length === 0) {
    return [
      `Service ${target.item.serviceName} targets the Ingress controller, but no Ingress host was found in this YAML. Use the app Service for a direct browser test.`,
    ];
  }

  return routes.map((route) => {
    const url = `http://${route.host}${route.path}`;
    return `Add "127.0.0.1 ${route.host}" to your hosts file (Windows: ${WINDOWS_HOSTS_PATH}, macOS/Linux: /etc/hosts), then open ${url}. Opening http://localhost:${target.localPort} gives nginx 404 because the Host header does not match the Ingress rule.`;
  });
};

const buildServiceRoutingNotes = (appTargets: LocalTestTarget[]): string[] => {
  const notes: string[] = [];
  appTargets.forEach((target) => {
    const { serviceName, port, nodePort, serviceType } = target.item;
    if (serviceType === 'LoadBalancer') {
      notes.push(
        `Service ${serviceName} is a LoadBalancer: Docker Desktop binds port ${port} directly to http://localhost:${port}. You can open it without port-forward (or run the port-forward fallback command if port ${port} is occupied).`
      );
    } else if (serviceType === 'NodePort') {
      if (nodePort) {
        notes.push(
          `Service ${serviceName} is a NodePort: Docker Desktop exposes port ${nodePort} directly on localhost. You can open http://localhost:${nodePort} directly without port-forward.`
        );
      } else {
        notes.push(
          `Service ${serviceName} is a NodePort without an explicit nodePort. Docker Desktop assigns a dynamic port (30000-32767). Run "kubectl get svc ${serviceName}" to find the port, or use the port-forward command below.`
        );
      }
    }
  });
  return notes;
};

const collectAppUrls = (appTargets: LocalTestTarget[]): string[] => {
  const urls: string[] = [];
  const addUrl = (url: string) => {
    if (!urls.includes(url)) urls.push(url);
  };

  appTargets.forEach((target) => {
    const { port, nodePort, serviceType } = target.item;
    if (serviceType === 'LoadBalancer') {
      addUrl(`http://localhost:${port}`);
      if (target.localPort !== port) {
        addUrl(`http://localhost:${target.localPort}`);
      }
    } else if (serviceType === 'NodePort') {
      if (nodePort) {
        addUrl(`http://localhost:${nodePort}`);
      }
      addUrl(`http://localhost:${target.localPort}`);
    } else {
      addUrl(`http://localhost:${target.localPort}`);
    }
  });

  return urls;
};

const buildPortForwardStep = (
  ports: LocalTestPort[],
  ingressServiceNames: string[],
  ingressRoutes: IngressRoute[],
  nonHttpImages: string[]
): YamlRunbookStep | null => {
  if (ports.length === 0) return null;

  const usedPorts = new Set<number>();
  const ingressServices = new Set(ingressServiceNames);
  const targets: LocalTestTarget[] = ports.map((item) => {
    const isIngress = ingressServices.has(item.serviceName);
    return { item, isIngress, localPort: assignLocalPort(item.port, isIngress, usedPorts) };
  });

  const commands = targets.map(({ item, localPort }) => ({
    command: `kubectl port-forward svc/${item.serviceName} ${localPort}:${item.port}${namespaceFlag(item.namespace)}`,
  }));

  const appTargets = targets.filter((target) => !target.isIngress);
  const ingressTargets = targets.filter((target) => target.isIngress);
  const urls = collectAppUrls(appTargets);
  const notes: string[] = [];

  buildServiceRoutingNotes(appTargets).forEach((note) => {
    if (!notes.includes(note)) notes.push(note);
  });

  ingressTargets.forEach((target) => {
    buildIngressTargetNotes(target, ingressRoutes).forEach((note) => {
      if (!notes.includes(note)) notes.push(note);
    });
  });

  if (urls.length === 0) {
    ingressRoutes.forEach((route) => {
      const url = `http://${route.host}${route.path}`;
      urls.push(url);
    });
  }

  nonHttpImages.forEach((image) => {
    const note = `The image ${image} is not an HTTP server. Port-forward still opens the port, but a browser may show a blank page or connection error. Use nginx/httpd for a page, or a matching client (for example psql) for a database.`;
    notes.push(note);
  });

  const hasDirectRouting = appTargets.some(
    (t) => t.item.serviceType === 'LoadBalancer' || t.item.serviceType === 'NodePort'
  );

  const description = hasDirectRouting
    ? 'Docker Desktop natively routes LoadBalancer and NodePort services to localhost without port-forward. For ClusterIP services (or as fallback), keep the command running in its own terminal. Stop with Ctrl+C.'
    : 'Keep each command running in its own terminal. The number before the colon is the local port; if it is busy, change it (for example 8081:80). Stop with Ctrl+C. Use the localhost link below for a direct test; the Ingress link needs the hosts-file note.';

  return {
    id: 'port-forward',
    title: 'Open the app in your browser',
    description,
    commands,
    urls,
    notes: notes.length > 0 ? notes : undefined,
    stage: 'deploy',
  };
};

const buildCleanupStep = (): YamlRunbookStep => ({
  id: 'cleanup',
  title: 'Clean up application workloads',
  description:
    'Stop running port-forward processes with Ctrl+C, then run this command to delete the resources created from infra.yaml.',
  commands: [{ command: 'kubectl delete -f infra.yaml' }],
  notes: [
    'Stop port-forward: Press Ctrl+C in any terminal running kubectl port-forward.',
    'Local manifest: Delete or archive infra.yaml in your terminal folder once cleanup is complete.',
  ],
  stage: 'cleanup',
});

const buildTeardownPrerequisitesStep = (
  namespaces: string[],
  ingressClasses: string[],
  hasHpa: boolean,
  ingressRoutes: IngressRoute[]
): YamlRunbookStep | null => {
  const hasPrerequisites =
    namespaces.length > 0 || ingressClasses.length > 0 || hasHpa || ingressRoutes.length > 0;
  if (!hasPrerequisites) return null;

  const commands: YamlRunbookCommand[] = [];

  ingressClasses.forEach((ingressClass) => {
    if (ingressClass === 'traefik') {
      commands.push({ command: 'helm uninstall traefik' });
    } else {
      commands.push({
        command:
          'kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/cloud/deploy.yaml',
      });
    }
  });

  if (hasHpa) {
    commands.push({
      command:
        'kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
    });
  }

  namespaces.forEach((namespace) => {
    commands.push({ command: `kubectl delete namespace ${namespace}` });
  });

  const notes: string[] = [];

  if (ingressRoutes.length > 0) {
    const hosts = Array.from(new Set(ingressRoutes.map((r) => r.host))).join(', ');
    notes.push(
      `Hosts file cleanup: Remove entries for "${hosts}" from your hosts file (Windows: ${WINDOWS_HOSTS_PATH}, macOS/Linux: /etc/hosts).`
    );
  }

  notes.push(
    'Add-on retention: Ingress controllers and Metrics Server can be left installed if you plan to run more Kubernetes tests. Only run the uninstall commands above if you want to free up laptop memory.',
    'Full Docker Desktop reset: To wipe all cluster state and restore a factory-clean cluster, go to Docker Desktop Settings > Kubernetes > click "Reset Kubernetes Cluster".'
  );

  return {
    id: 'teardown-prerequisites',
    title: 'Revert cluster prerequisites & system changes (Optional)',
    description:
      'Return your Docker Desktop cluster and host system to their original state. Skip this step if you prefer keeping add-ons for future tests.',
    commands,
    notes,
    stage: 'cleanup',
  };
};

const buildSaveManifestStep = (): YamlRunbookStep => ({
  id: 'save-manifest',
  title: 'Save or download infra.yaml',
  description: 'Download infra.yaml or copy the manifest content into a file named infra.yaml in your terminal working folder.',
  commands: [],
  stage: 'manifest',
});

const buildApplyManifestStep = (): YamlRunbookStep => ({
  id: 'apply-manifest',
  title: 'Apply the manifest',
  description: 'Run this command from the same folder that contains infra.yaml. Make sure the prerequisite steps above are already completed.',
  commands: [{ command: 'kubectl apply -f infra.yaml' }],
  stage: 'deploy',
});

/**
 * Filter runbook steps by their corresponding workflow stage.
 */
export const getStepsByStage = (steps: YamlRunbookStep[], stage: YamlStage): YamlRunbookStep[] =>
  steps.filter(
    (step) =>
      step.stage === stage ||
      (stage === 'deploy' && step.stage === 'localhost') ||
      (stage === 'localhost' && step.stage === 'deploy')
  );

/**
 * Builds a step-by-step kubectl runbook from the generated multi-document YAML.
 *
 * The runbook covers saving the manifest, applying it, and verifying deployed resources.
 * Namespace creation, Metrics Server, Ingress controllers, and StorageClass checks are added
 * only when the manifest needs them. A port-forward step plus explicit warnings are added
 * so a beginner can test the design at localhost, or understand which canvas cards are missing.
 *
 * @param yamlContent - Generated Kubernetes YAML (multi-document).
 * @returns Ordered steps that can be rendered in the YAML modal.
 */
export const buildYamlRunbook = (yamlContent: string): YamlRunbookStep[] => {
  const documents = parseDocuments(yamlContent);
  if (documents.length === 0) return [];

  const namespaces = collectNamespaces(documents);
  const ingressClasses = collectIngressClasses(documents);
  const storageClasses = collectStorageClasses(documents);
  const readiness = analyzeLocalTestReadiness(documents);
  const hasHpa = documents.some((doc) => doc.kind === 'HorizontalPodAutoscaler');

  const candidates: Array<YamlRunbookStep | null> = [
    buildDockerDesktopContextStep(),
    buildNamespaceStep(namespaces),
    buildHpaStep(documents),
    ...ingressClasses.map((ingressClass) => buildIngressStep(ingressClass)),
    buildStorageStep(storageClasses),
    buildSaveManifestStep(),
    buildApplyManifestStep(),
    buildVerifyStep(documents, namespaces),
    buildBrowserWarningStep(readiness.warnings),
    buildPortForwardStep(
      readiness.ports,
      readiness.ingressServiceNames,
      readiness.ingressRoutes,
      readiness.nonHttpImages
    ),
    buildCleanupStep(),
    buildTeardownPrerequisitesStep(
      namespaces,
      ingressClasses,
      hasHpa,
      readiness.ingressRoutes
    ),
  ];

  return candidates.filter((step): step is YamlRunbookStep => step !== null);
};
