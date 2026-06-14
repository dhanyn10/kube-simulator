package k8s

import (
	"encoding/json"
	"testing"
)

func TestObjectMetaSerialization(t *testing.T) {
	meta := ObjectMeta{
		Name:      "test-name",
		Namespace: "test-ns",
		Labels:    map[string]string{"app": "test"},
	}

	data, err := json.Marshal(meta)
	if err != nil {
		t.Fatalf("failed to marshal ObjectMeta: %v", err)
	}

	var unmarshaled ObjectMeta
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal ObjectMeta: %v", err)
	}

	if unmarshaled.Name != meta.Name {
		t.Errorf("expected Name %s, got %s", meta.Name, unmarshaled.Name)
	}
	if unmarshaled.Namespace != meta.Namespace {
		t.Errorf("expected Namespace %s, got %s", meta.Namespace, unmarshaled.Namespace)
	}
	if unmarshaled.Labels["app"] != meta.Labels["app"] {
		t.Errorf("expected Label %s, got %s", meta.Labels["app"], unmarshaled.Labels["app"])
	}
}

func TestK8sNodeDataSerialization(t *testing.T) {
	replicas := 3
	data := K8sNodeData{
		ID:       "node-1",
		Label:    "test-label",
		Type:     TypeDeployment,
		Replicas: &replicas,
		Image:    "nginx:latest",
		Port:     80,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("failed to marshal K8sNodeData: %v", err)
	}

	var unmarshaled K8sNodeData
	if err := json.Unmarshal(jsonData, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal K8sNodeData: %v", err)
	}

	if unmarshaled.ID != data.ID {
		t.Errorf("expected ID %s, got %s", data.ID, unmarshaled.ID)
	}
	if *unmarshaled.Replicas != *data.Replicas {
		t.Errorf("expected Replicas %d, got %d", *data.Replicas, *unmarshaled.Replicas)
	}
}

func TestK8sResourceTypes(t *testing.T) {
	types := []K8sResourceType{
		TypePod, TypeService, TypeDeployment, TypeNamespace,
		TypeInternet, TypeIngress, TypeHPA, TypePVC, TypeConfigMap, TypeSecret,
	}

	for _, ty := range types {
		if ty == "" {
			t.Error("expected non-empty resource type")
		}
	}
}
