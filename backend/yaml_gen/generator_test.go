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
	nodesJson := `[
		{"id":"p1","type":"Pod","data":{"label":"My Pod","image":"my-image","port":8080,"cpuRequest":"100m","cpuLimit":"200m"}}
	]`
	edgesJson := `[]`

	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Pod") || !strings.Contains(result, "my-pod") || !strings.Contains(result, "my-image") || !strings.Contains(result, "8080") {
		t.Errorf("Generate failed for Pod: %s", result)
	}
}

func TestGeneratePodWithReplicas(t *testing.T) {
	// replicas=1 -> Pod
	nodesJson1 := `[{"id":"p1","type":"Pod","data":{"label":"My Pod","replicas":1}}]`
	result1 := Generate(nodesJson1, "[]")
	if !strings.Contains(result1, "\"kind\":\"Pod\"") {
		t.Errorf("Expected Pod Kind for replicas=1, got: %s", result1)
	}

	// replicas=2 -> Deployment
	nodesJson2 := `[{"id":"p1","type":"Pod","data":{"label":"My Pod","replicas":2}}]`
	result2 := Generate(nodesJson2, "[]")
	if !strings.Contains(result2, "\"kind\":\"Deployment\"") {
		t.Errorf("Expected Deployment Kind for replicas=2, got: %s", result2)
	}
}

func TestGeneratePodInNamespace(t *testing.T) {
	nodesJson := `[
		{"id":"ns1","type":"Namespace","data":{"label":"My NS"}},
		{"id":"p1","type":"Pod","data":{"label":"My Pod","image":"nginx"},"parentId":"ns1"}
	]`
	edgesJson := `[]`

	result := Generate(nodesJson, edgesJson)
	// It's JSON, so it might be "namespace":"my-ns"
	if !strings.Contains(result, "\"namespace\":\"my-ns\"") {
		t.Errorf("Pod should be in the correct namespace: %s", result)
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
		{"id":"s1","type":"Service","data":{"label":"My Svc","port":80,"targetPort":8080}},
		{"id":"p1","type":"Pod","data":{"label":"My Pod"}}
	]`
	edgesJson := `[{"id":"e1","source":"s1","target":"p1"}]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Service") || !strings.Contains(result, "my-pod") || !strings.Contains(result, "8080") {
		t.Errorf("Generate failed for Service: %s", result)
	}

	// Test Service connected to Deployment
	nodesJson2 := `[
		{"id":"s1","type":"Service","data":{"label":"My Svc","port":80}},
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}}
	]`
	edgesJson2 := `[{"id":"e1","source":"s1","target":"d1"}]`
	result2 := Generate(nodesJson2, edgesJson2)
	if !strings.Contains(result2, "Service") || !strings.Contains(result2, "my-dep") {
		t.Errorf("Generate failed for Service linked to Deployment: %s", result2)
	}

	// Test Service with disabled selector via YamlSettings
	// targetPort is only included if it is non-zero in JSON.
	nodesJson3 := `[{"id":"s1","type":"Service","data":{"label":"My Svc","port":80,"yamlSettings":{"selector":false}}}]`
	result3 := Generate(nodesJson3, "[]")
	if strings.Contains(result3, "\"selector\":{\"app\":\"app-label\"}") {
		t.Errorf("Generate failed to respect Service YamlSettings: %s", result3)
	}
}

func TestGenerateIngress(t *testing.T) {
	nodesJson := `[
		{"id":"i1","type":"Ingress","data":{"label":"My Ing","ingressHost":"example.com","ingressPath":"/api"}},
		{"id":"s1","type":"Service","data":{"label":"My Svc","port":80}}
	]`
	edgesJson := `[{"id":"e1","source":"i1","target":"s1"}]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "Ingress") || !strings.Contains(result, "example.com") || !strings.Contains(result, "my-svc") || !strings.Contains(result, "/api") {
		t.Errorf("Generate failed for Ingress: %s", result)
	}
}

func TestGenerateHPA(t *testing.T) {
	nodesJson := `[
		{"id":"h1","type":"HPA","data":{"label":"My HPA","minReplicas":2,"maxReplicas":5,"targetCPU":60,"targetMemory":80}},
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}}
	]`
	edgesJson := `[{"id":"e1","source":"h1","target":"d1"}]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "HorizontalPodAutoscaler") || !strings.Contains(result, "my-dep") {
		t.Errorf("Generate failed for HPA: %s", result)
	}
	if !strings.Contains(result, "2") || !strings.Contains(result, "5") || !strings.Contains(result, "60") || !strings.Contains(result, "80") {
		t.Errorf("Generate failed to include HPA metrics: %s", result)
	}
}

func TestGeneratePVC(t *testing.T) {
	// With StorageClass
	nodesJson1 := `[{"id":"pvc1","type":"PVC","data":{"label":"My PVC","storageCapacity":"2Gi","storageClass":"fast"}}]`
	result1 := Generate(nodesJson1, `[]`)
	if !strings.Contains(result1, "PersistentVolumeClaim") || !strings.Contains(result1, "2Gi") || !strings.Contains(result1, "fast") {
		t.Errorf("Generate failed for PVC with storage class: %s", result1)
	}

	// Without StorageClass
	nodesJson2 := `[{"id":"pvc1","type":"PVC","data":{"label":"My PVC","storageClass":"fast","yamlSettings":{"storageClass":false}}}]`
	result2 := Generate(nodesJson2, `[]`)
	if strings.Contains(result2, "storageClassName") {
		t.Errorf("Generate failed to respect PVC YamlSettings: %s", result2)
	}
}

func TestGenerateReplicaSet(t *testing.T) {
	nodesJson := `[{"id":"rs1","type":"ReplicaSet","data":{"label":"My RS","replicas":2,"image":"nginx"}}]`
	result := Generate(nodesJson, `[]`)
	if !strings.Contains(result, "ReplicaSet") || !strings.Contains(result, "my-rs") || !strings.Contains(result, "2") {
		t.Errorf("Generate failed for ReplicaSet: %s", result)
	}
}

func TestGenerateWithConnections(t *testing.T) {
	nodesJson := `[
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}},
		{"id":"cm1","type":"ConfigMap","data":{"label":"My CM","configData":[{"key":"K1","value":"V1"}]}},
		{"id":"s1","type":"Secret","data":{"label":"My Secret","configData":[{"key":"S1","value":"V1"}]}}
	]`
	edgesJson := `[
		{"id":"e1","source":"cm1","target":"d1"},
		{"id":"e2","source":"s1","target":"d1"}
	]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "K1") || !strings.Contains(result, "S1") {
		t.Errorf("Generate failed with env connections: %s", result)
	}
}

func TestGenerateWithPVC(t *testing.T) {
	nodesJson := `[
		{"id":"p1","type":"Pod","data":{"id":"p1","label":"My Pod"}},
		{"id":"pvc1","type":"PVC","data":{"label":"My PVC"}}
	]`
	edgesJson := `[
		{"id":"e1","source":"p1","target":"pvc1"}
	]`
	result := Generate(nodesJson, edgesJson)
	if !strings.Contains(result, "persistentVolumeClaim") || !strings.Contains(result, "my-pvc") {
		t.Errorf("Generate failed with PVC volume: %s", result)
	}
}

func TestGenerateInternet(t *testing.T) {
	nodesJson := `[{"id":"i1","type":"Internet","data":{"label":"Internet"}}]`
	result := Generate(nodesJson, "[]")
	if result != "null" {
		t.Errorf("Internet node should not generate YAML, got: %s", result)
	}
}

func TestGenerateNestedPod(t *testing.T) {
	nodesJson := `[
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}},
		{"id":"p1","type":"Pod","data":{"label":"My Pod"},"parentId":"d1"}
	]`
	result := Generate(nodesJson, "[]")
	// Pod inside Deployment should be skipped because Deployment handles it
	if strings.Contains(result, "Kind\":\"Pod\"") {
		t.Errorf("Nested Pod should not be generated as separate resource: %s", result)
	}
}

func TestGenerateWithEmptyLabel(t *testing.T) {
	nodesJson := `[{"id":"p1","type":"Pod","data":{"label":""}}]`
	result := Generate(nodesJson, "[]")
	if result != "null" {
		t.Errorf("Node with empty label should be skipped, got: %s", result)
	}
}

func TestGenerate_InvalidJSON(t *testing.T) {
	result1 := Generate("invalid json", "[]")
	if !strings.Contains(result1, "Error parsing nodes") {
		t.Errorf("Expected Error parsing nodes, got: %s", result1)
	}

	result2 := Generate("[]", "invalid json")
	if !strings.Contains(result2, "Error parsing edges") {
		t.Errorf("Expected Error parsing edges, got: %s", result2)
	}
}

func TestGenerate_UnknownNodeType(t *testing.T) {
	nodesJson := `[{"id":"u1","type":"UnknownType","data":{"label":"Unknown"}}]`
	result := Generate(nodesJson, "[]")
	if result != "null" {
		t.Errorf("Unknown node type should be skipped, got: %s", result)
	}
}

func TestGenerate_Integration(t *testing.T) {
	// A more complex setup to test Generate end-to-end with multiple resources
	nodesJson := `[
		{"id":"ns1","type":"Namespace","data":{"label":"Prod"}},
		{"id":"pvc1","type":"PVC","data":{"label":"Database Storage","storageCapacity":"10Gi"},"parentId":"ns1"},
		{"id":"dep1","type":"Deployment","data":{"label":"Api Server","image":"api:v1","replicas":3},"parentId":"ns1"},
		{"id":"svc1","type":"Service","data":{"label":"Api Service","port":80,"targetPort":8080},"parentId":"ns1"}
	]`
	edgesJson := `[
		{"id":"e1","source":"dep1","target":"pvc1"},
		{"id":"e2","source":"svc1","target":"dep1"}
	]`

	result := Generate(nodesJson, edgesJson)

	// Check if all kinds are present
	expectedKinds := []string{"Namespace", "PersistentVolumeClaim", "Deployment", "Service"}
	for _, kind := range expectedKinds {
		if !strings.Contains(result, kind) {
			t.Errorf("Integration test missing kind %s in output", kind)
		}
	}

	// Check for proper namespacing
	if !strings.Contains(result, "\"namespace\":\"prod\"") {
		t.Error("Integration test output missing correct namespace assignment")
	}

	// Check for volume connection
	if !strings.Contains(result, "database-storage") {
		t.Error("Integration test output missing volume connection to PVC")
	}

	// Check for service selector
	if !strings.Contains(result, "\"app\":\"api-server\"") {
		t.Error("Integration test output missing service selector link to deployment")
	}
}
