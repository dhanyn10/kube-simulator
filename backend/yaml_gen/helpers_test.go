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
