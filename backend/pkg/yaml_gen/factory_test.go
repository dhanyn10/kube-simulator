package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
	"testing"
)

type mockCustomGenerator struct{}

func (m *mockCustomGenerator) Generate(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	return "custom-object"
}

func TestResourceGeneratorFactory(t *testing.T) {
	t.Run("DefaultFactory registered types", func(t *testing.T) {
		expectedTypes := []string{
			"Namespace", "Pod", "Deployment", "ReplicaSet",
			"Service", "Ingress", "HPA", "PVC", "ConfigMap", "Secret",
		}

		for _, nodeType := range expectedTypes {
			gen, ok := DefaultFactory.GetGenerator(nodeType)
			if !ok || gen == nil {
				t.Errorf("Expected generator for node type %s to be registered", nodeType)
			}
		}
	})

	t.Run("Get unregistered type", func(t *testing.T) {
		gen, ok := DefaultFactory.GetGenerator("UnknownType")
		if ok || gen != nil {
			t.Errorf("Expected no generator for UnknownType, got %v", gen)
		}
	})

	t.Run("Custom Factory Register", func(t *testing.T) {
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
	})
}
