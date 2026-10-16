package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
	"testing"
)

type mockCustomGenerator struct{}

func (m *mockCustomGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return "custom-object"
}

func TestDefaultFactoryRegisteredTypes(t *testing.T) {
	expectedTypes := []string{
		"Namespace", "Pod", "Deployment", "StatefulSet", "ReplicaSet",
		"Service", "Ingress", "HPA", "PVC", "ConfigMap", "Secret",
	}

	for _, nodeType := range expectedTypes {
		gen, ok := DefaultFactory.GetGenerator(nodeType)
		if !ok || gen == nil {
			t.Errorf("Expected generator for node type %s to be registered", nodeType)
		}
	}
}

func TestStatefulSetGeneratorExecution(t *testing.T) {
	gen, ok := DefaultFactory.GetGenerator("StatefulSet")
	if !ok || gen == nil {
		t.Fatalf("Expected StatefulSet generator")
	}
	rep := 2
	data := k8s.K8sNodeData{Replicas: &rep, Image: "redis:alpine"}
	res := gen.Generate(data, "my-ss", "prod", &GenContext{})
	ss, ok := res.(k8s.StatefulSet)
	if !ok || ss.Kind != "StatefulSet" || ss.Spec.Replicas != 2 || ss.Spec.ServiceName != "my-ss" {
		t.Errorf("StatefulSetGenerator failed, got %v", res)
	}
}

func TestUnregisteredTypeGenerator(t *testing.T) {
	gen, ok := DefaultFactory.GetGenerator("UnknownType")
	if ok || gen != nil {
		t.Errorf("Expected no generator for UnknownType, got %v", gen)
	}
}

func TestCustomFactoryRegister(t *testing.T) {
	factory := NewResourceGeneratorFactory()
	factory.Register("CustomType", &mockCustomGenerator{})

	gen, ok := factory.GetGenerator("CustomType")
	if !ok || gen == nil {
		t.Fatalf("Expected custom generator to be registered")
	}

	res := gen.Generate(k8s.K8sNodeData{}, "custom", "default", &GenContext{})
	if res != "custom-object" {
		t.Errorf("Expected 'custom-object', got %v", res)
	}
}
