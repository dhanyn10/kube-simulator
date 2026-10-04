package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
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
		{
			name: "Empty Label Fallback",
			node: &k8s.FrontendNode{
				Type: "ConfigMap",
				Data: k8s.K8sNodeData{
					Label: "",
					ConfigData: []k8s.ConfigDataItem{
						{Key: "K1", Value: "V1"},
					},
				},
			},
			expected: 1,
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
	t.Run("Single PVC", func(t *testing.T) {
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
	})

	t.Run("PVC with empty label fallback", func(t *testing.T) {
		ctx := &GenContext{
			nodeMap: map[string]*k8s.FrontendNode{
				"pvc1": {ID: "pvc1", Type: "PVC", Data: k8s.K8sNodeData{Label: ""}},
			},
			sourceEdgeMap: map[string][]k8s.FrontendEdge{
				"pod1": {{Source: "pod1", Target: "pvc1"}},
			},
		}
		volumes, _ := getVolumeConfig([]string{"pod1"}, ctx)
		if volumes[0].PersistentVolumeClaim.ClaimName != "pvc-storage" {
			t.Errorf("Expected fallback name 'pvc-storage', got '%s'", volumes[0].PersistentVolumeClaim.ClaimName)
		}
	})
}

func TestGetEnvFromConnections(t *testing.T) {
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"cm1": {ID: "cm1", Type: "ConfigMap", Data: k8s.K8sNodeData{Label: "cm", ConfigData: []k8s.ConfigDataItem{{Key: "K1", Value: "V1"}}}},
		},
		targetEdgeMap: map[string][]k8s.FrontendEdge{
			"pod1": {{Source: "cm1", Target: "pod1"}},
		},
	}
	env := getEnvFromConnections([]string{"pod1"}, ctx)
	if len(env) != 1 || env[0].Name != "K1" {
		t.Errorf("Expected 1 env var K1, got %v", env)
	}
}

func TestCreateResourceMap(t *testing.T) {
	if createResourceMap("", "") != nil {
		t.Error("Expected nil for empty inputs")
	}
	res := createResourceMap("100m", "")
	if res["cpu"] != "100m" || res["memory"] != "" {
		t.Errorf("Expected only cpu, got %v", res)
	}
}

func TestGetResourceConfigDisabled(t *testing.T) {
	data := k8s.K8sNodeData{
		YamlSettings:   map[string]bool{"resources": false},
		CpuRequest:     "100m",
		ResourceLimits: []k8s.ResourceLimitItem{{ID: "rl1", Name: "limits"}},
	}
	if res := getResourceConfig(data, []string{"p1"}, nil); res != nil {
		t.Error("Expected nil for disabled resources")
	}
}

func TestGetResourceConfigAttached(t *testing.T) {
	data := k8s.K8sNodeData{
		CpuRequest:     "100m",
		MemoryLimit:    "256Mi",
		ResourceLimits: []k8s.ResourceLimitItem{{ID: "rl1", Name: "limits"}},
	}
	res := getResourceConfig(data, []string{"p1"}, nil)
	if res == nil {
		t.Fatal("Expected non-nil resources")
	}
	if res.Requests["cpu"] != "100m" || res.Limits["memory"] != "256Mi" {
		t.Errorf("Unexpected resource requirements: %v", res)
	}
}

func TestGetResourceConfigTargetEdge(t *testing.T) {
	data := k8s.K8sNodeData{
		CpuRequest:  "100m",
		MemoryLimit: "256Mi",
	}
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"rl1": {ID: "rl1", Type: "ResourceLimit"},
		},
		targetEdgeMap: map[string][]k8s.FrontendEdge{
			"p1": {{Source: "rl1", Target: "p1"}},
		},
	}
	res := getResourceConfig(data, []string{"p1"}, ctx)
	if res == nil || res.Requests["cpu"] != "100m" || res.Limits["memory"] != "256Mi" {
		t.Errorf("Unexpected resource requirements when connected via targetEdgeMap: %v", res)
	}
}

func TestGetResourceConfigSourceEdge(t *testing.T) {
	data := k8s.K8sNodeData{
		CpuLimit: "500m",
	}
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"rl1": {ID: "rl1", Type: "ResourceLimit"},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"p1": {{Source: "p1", Target: "rl1"}},
		},
	}
	res := getResourceConfig(data, []string{"p1"}, ctx)
	if res == nil || res.Limits["cpu"] != "500m" {
		t.Errorf("Unexpected resource requirements when connected via sourceEdgeMap: %v", res)
	}
}

func TestGetResourceConfigNoLimits(t *testing.T) {
	data := k8s.K8sNodeData{
		CpuRequest:  "100m",
		MemoryLimit: "256Mi",
	}
	if res := getResourceConfig(data, []string{"p1"}, nil); res != nil {
		t.Error("Expected nil when no ResourceLimit attached or connected")
	}
}
