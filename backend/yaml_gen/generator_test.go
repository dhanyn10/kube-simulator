package yaml_gen

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSanitizeName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"My Name", "my-name"},
		{"My_Name@123!", "myname123"},
		{"-Start-End-", "start-end"},
		{"Very" + strings.Repeat("Long", 20), "verylonglonglonglonglonglonglonglonglonglonglonglonglonglonglon"}, // Test length limit
	}

	for _, tt := range tests {
		result := sanitizeName(tt.input)
		if result != tt.expected {
			t.Errorf("sanitizeName(%s) = %s; want %s", tt.input, result, tt.expected)
		}
	}
}

func TestGenerateNamespace(t *testing.T) {
	nodesJson := `[{"id":"ns1","type":"Namespace","data":{"label":"My Namespace"}}]`
	edgesJson := `[]`

	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Namespace") || !strings.Contains(result, "my-namespace") {
		t.Errorf("Generate failed for Namespace: %s", result)
	}
}

func TestGeneratePod(t *testing.T) {
	nodesJson := `[{"id":"p1","type":"Pod","data":{"label":"My Pod","image":"nginx"}}]`
	edgesJson := `[]`

	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Pod") || !strings.Contains(result, "my-pod") || !strings.Contains(result, "nginx") {
		t.Errorf("Generate failed for Pod: %s", result)
	}
}

func TestGenerateDeployment(t *testing.T) {
	replicas := 3
	nodesJson := `[{"id":"d1","type":"Deployment","data":{"label":"My Dep","image":"nginx","replicas":3}}]`
	// Manually construct JSON to include replicas
	var nodes []map[string]interface{}
	json.Unmarshal([]byte(nodesJson), &nodes)
	nodes[0]["data"].(map[string]interface{})["replicas"] = replicas
	nodesData, _ := json.Marshal(nodes)

	result := Generate(string(nodesData), `[]`)
	if !strings.Contains(result, "Deployment") || !strings.Contains(result, "3") {
		t.Errorf("Generate failed for Deployment: %s", result)
	}
}

func TestGenerateConfigMap(t *testing.T) {
	nodesJson := `[{"id":"cm1","type":"ConfigMap","data":{"label":"My CM","configData":[{"key":"k1","value":"v1"}]}}]`
	result := Generate(nodesJson, `[]`)
	if !strings.Contains(result, "ConfigMap") || !strings.Contains(result, "k1") || !strings.Contains(result, "v1") {
		t.Errorf("Generate failed for ConfigMap: %s", result)
	}
}

func TestGenerateSecret(t *testing.T) {
	nodesJson := `[{"id":"s1","type":"Secret","data":{"label":"My Secret","configData":[{"key":"k1","value":"v1"}]}}]`
	result := Generate(nodesJson, `[]`)
	if !strings.Contains(result, "Secret") || !strings.Contains(result, "v1") {
		t.Errorf("Generate failed for Secret: %s", result)
	}
}

func TestGenerateService(t *testing.T) {
	nodesJson := `[
		{"id":"s1","type":"Service","data":{"label":"My Svc","port":80}},
		{"id":"p1","type":"Pod","data":{"label":"My Pod"}}
	]`
	edgesJson := `[{"id":"e1","source":"s1","target":"p1"}]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Service") || !strings.Contains(result, "my-pod") {
		t.Errorf("Generate failed for Service: %s", result)
	}
}

func TestGenerateIngress(t *testing.T) {
	nodesJson := `[
		{"id":"i1","type":"Ingress","data":{"label":"My Ing","ingressHost":"example.com"}},
		{"id":"s1","type":"Service","data":{"label":"My Svc"}}
	]`
	edgesJson := `[{"id":"e1","source":"i1","target":"s1"}]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Ingress") || !strings.Contains(result, "example.com") || !strings.Contains(result, "my-svc") {
		t.Errorf("Generate failed for Ingress: %s", result)
	}
}

func TestGenerateHPA(t *testing.T) {
	nodesJson := `[
		{"id":"h1","type":"HPA","data":{"label":"My HPA"}},
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}}
	]`
	edgesJson := `[{"id":"e1","source":"h1","target":"d1"}]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "HorizontalPodAutoscaler") || !strings.Contains(result, "my-dep") {
		t.Errorf("Generate failed for HPA: %s", result)
	}
}

func TestGeneratePVC(t *testing.T) {
	nodesJson := `[{"id":"pvc1","type":"PVC","data":{"label":"My PVC","storageCapacity":"2Gi"}}]`
	result := Generate(nodesJson, `[]`)
	if !strings.Contains(result, "PersistentVolumeClaim") || !strings.Contains(result, "2Gi") {
		t.Errorf("Generate failed for PVC: %s", result)
	}
}
