package yaml_gen

import (
	"build-wails/backend/k8s"
	"testing"
)

func TestGetEnvFromNode(t *testing.T) {
	tests := []struct {
		name     string
		node     *k8s.FrontendNode
		expected int
	}{
		{
			name: "ConfigMap",
			node: &k8s.FrontendNode{
				Type: "ConfigMap",
				Data: k8s.K8sNodeData{
					Label: "my-cm",
					ConfigData: []k8s.ConfigDataItem{
						{Key: "K1", Value: "V1"},
						{Key: "K2", Value: "V2"},
						{Key: "", Value: "V3"}, // Should be skipped
					},
				},
			},
			expected: 2,
		},
		{
			name: "Secret",
			node: &k8s.FrontendNode{
				Type: "Secret",
				Data: k8s.K8sNodeData{
					Label: "my-secret",
					ConfigData: []k8s.ConfigDataItem{
						{Key: "S1", Value: "V1"},
					},
				},
			},
			expected: 1,
		},
		{
			name:     "Nil Node",
			node:     nil,
			expected: 0,
		},
		{
			name: "Other Node Type",
			node: &k8s.FrontendNode{
				Type: "Pod",
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := getEnvFromNode(tt.node)
			if len(env) != tt.expected {
				t.Errorf("getEnvFromNode() len = %d, want %d", len(env), tt.expected)
			}
		})
	}
}

func TestGetVolumeConfig(t *testing.T) {
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"pod1": {ID: "pod1", Type: "Pod"},
			"pvc1": {ID: "pvc1", Type: "PVC", Data: k8s.K8sNodeData{Label: "my-pvc"}},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"pod1": {
				{Source: "pod1", Target: "pvc1"},
			},
		},
	}

	volumes, mounts := getVolumeConfig([]string{"pod1"}, ctx)

	if len(volumes) != 1 {
		t.Errorf("Expected 1 volume, got %d", len(volumes))
	}
	if len(mounts) != 1 {
		t.Errorf("Expected 1 mount, got %d", len(mounts))
	}
	if volumes[0].PersistentVolumeClaim.ClaimName != "my-pvc" {
		t.Errorf("Expected claim name 'my-pvc', got '%s'", volumes[0].PersistentVolumeClaim.ClaimName)
	}
}

func TestGetResourceConfig(t *testing.T) {
	t.Run("Disabled", func(t *testing.T) {
		data := k8s.K8sNodeData{
			YamlSettings: map[string]bool{"resources": false},
			CpuRequest:   "100m",
		}
		res := getResourceConfig(data)
		if res != nil {
			t.Error("Expected nil for disabled resources")
		}
	})

	t.Run("Enabled with values", func(t *testing.T) {
		data := k8s.K8sNodeData{
			CpuRequest: "100m",
			MemoryLimit: "256Mi",
		}
		res := getResourceConfig(data)
		if res == nil {
			t.Fatal("Expected non-nil resources")
		}
		if res.Requests["cpu"] != "100m" {
			t.Errorf("Expected CPU request 100m, got %s", res.Requests["cpu"])
		}
		if res.Limits["memory"] != "256Mi" {
			t.Errorf("Expected Memory limit 256Mi, got %s", res.Limits["memory"])
		}
	})
}
