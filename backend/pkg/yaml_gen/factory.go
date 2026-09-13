package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
)

// ResourceGenerator defines the common interface for generating Kubernetes resource objects.
type ResourceGenerator interface {
	// Generate constructs and returns the Kubernetes object based on node data, name, namespace, and generation context.
	Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{}
}

// ResourceGeneratorFactory manages and provides access to registered ResourceGenerator implementations.
type ResourceGeneratorFactory struct {
	generators map[string]ResourceGenerator
}

// NewResourceGeneratorFactory creates and initializes a ResourceGeneratorFactory pre-populated with standard Kubernetes resource generators.
func NewResourceGeneratorFactory() *ResourceGeneratorFactory {
	factory := &ResourceGeneratorFactory{
		generators: make(map[string]ResourceGenerator),
	}
	factory.Register("Namespace", &NamespaceGenerator{})
	factory.Register("Pod", &PodGenerator{})
	factory.Register("Deployment", &DeploymentGenerator{})
	factory.Register("ReplicaSet", &ReplicaSetGenerator{})
	factory.Register("Service", &ServiceGenerator{})
	factory.Register("Ingress", &IngressGenerator{})
	factory.Register("HPA", &HPAGenerator{})
	factory.Register("PVC", &PVCGenerator{})
	factory.Register("ConfigMap", &ConfigMapGenerator{})
	factory.Register("Secret", &SecretGenerator{})
	return factory
}

// Register attaches or overrides a ResourceGenerator for the specified node type.
func (f *ResourceGeneratorFactory) Register(nodeType string, generator ResourceGenerator) {
	if f.generators != nil && nodeType != "" && generator != nil {
		f.generators[nodeType] = generator
	}
}

// GetGenerator retrieves the ResourceGenerator registered for the given node type.
func (f *ResourceGeneratorFactory) GetGenerator(nodeType string) (ResourceGenerator, bool) {
	if f.generators == nil {
		return nil, false
	}
	g, ok := f.generators[nodeType]
	return g, ok
}

// DefaultFactory is the default global instance of ResourceGeneratorFactory.
var DefaultFactory = NewResourceGeneratorFactory()

// NamespaceGenerator handles generating Kubernetes Namespace resources.
type NamespaceGenerator struct{}

func (g *NamespaceGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateNamespace(data, name)
}

// PodGenerator handles generating Kubernetes Pod (or single-replica Pod/Deployment) resources.
type PodGenerator struct{}

func (g *PodGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generatePodOrDeployment(data, name, namespace, ctx)
}

// DeploymentGenerator handles generating Kubernetes Deployment resources.
type DeploymentGenerator struct{}

func (g *DeploymentGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateDeployment(data, name, namespace, ctx)
}

// ReplicaSetGenerator handles generating Kubernetes ReplicaSet resources.
type ReplicaSetGenerator struct{}

func (g *ReplicaSetGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateReplicaSet(data, name, namespace, ctx)
}

// ServiceGenerator handles generating Kubernetes Service resources.
type ServiceGenerator struct{}

func (g *ServiceGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateService(data, name, namespace, ctx)
}

// IngressGenerator handles generating Kubernetes Ingress resources.
type IngressGenerator struct{}

func (g *IngressGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateIngress(data, name, namespace, ctx)
}

// HPAGenerator handles generating Kubernetes HorizontalPodAutoscaler resources.
type HPAGenerator struct{}

func (g *HPAGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateHPA(data, name, namespace, ctx)
}

// PVCGenerator handles generating Kubernetes PersistentVolumeClaim resources.
type PVCGenerator struct{}

func (g *PVCGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generatePVC(data, name, namespace)
}

// ConfigMapGenerator handles generating Kubernetes ConfigMap resources.
type ConfigMapGenerator struct{}

func (g *ConfigMapGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateConfigMap(data, name, namespace)
}

// SecretGenerator handles generating Kubernetes Secret resources.
type SecretGenerator struct{}

func (g *SecretGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return generateSecret(data, name, namespace)
}
