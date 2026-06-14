package yaml_gen

import (
	"strings"
	"testing"
)

func TestGenerateHPA_DisabledMetrics(t *testing.T) {
	nodesJson := `[
		{"id":"h1","type":"HPA","data":{"label":"My HPA","targetCPU":60,"targetMemory":80,"yamlSettings":{"targetCPU":false, "targetMemory":false}}},
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}}
	]`
	edgesJson := `[{"id":"e1","source":"h1","target":"d1"}]`
	result := Generate(nodesJson, edgesJson)
	if strings.Contains(result, "cpu") || strings.Contains(result, "60") {
		t.Errorf("Generate failed to respect HPA YamlSettings for CPU: %s", result)
	}
	if strings.Contains(result, "memory") || strings.Contains(result, "80") {
		t.Errorf("Generate failed to respect HPA YamlSettings for Memory: %s", result)
	}
}

func TestGenerateHPA_DisabledReplicas(t *testing.T) {
	nodesJson := `[
		{"id":"h1","type":"HPA","data":{"label":"My HPA","minReplicas":5,"maxReplicas":20,"yamlSettings":{"replicas":false}}},
		{"id":"d1","type":"Deployment","data":{"label":"My Dep"}}
	]`
	edgesJson := `[{"id":"e1","source":"h1","target":"d1"}]`
	result := Generate(nodesJson, edgesJson)
	// When replicas is false, it defaults to min=1, max=10
	if !strings.Contains(result, "\"minReplicas\":1") || !strings.Contains(result, "\"maxReplicas\":10") {
		t.Errorf("Generate failed to respect HPA YamlSettings for replicas: %s", result)
	}
}

func TestGenerateIngress_DisabledSettings(t *testing.T) {
	nodesJson := `[
		{"id":"i1","type":"Ingress","data":{"label":"My Ing","ingressPath":"/api","yamlSettings":{"path":false}}},
		{"id":"s1","type":"Service","data":{"label":"My Svc","port":80}}
	]`
	edgesJson := `[{"id":"e1","source":"i1","target":"s1"}]`
	result := Generate(nodesJson, edgesJson)
	// path: false should default to "/"
	if !strings.Contains(result, "\"path\":\"/\"") {
		t.Errorf("Generate failed to respect Ingress path YamlSettings: %s", result)
	}
}

func TestGenerateService_DisabledTargetPort(t *testing.T) {
	nodesJson := `[{"id":"s1","type":"Service","data":{"label":"My Svc","port":80,"targetPort":8080,"yamlSettings":{"targetPort":false}}}]`
	result := Generate(nodesJson, "[]")
	// targetPort: false should set targetPort to 0 (omitted in JSON)
	if strings.Contains(result, "8080") {
		t.Errorf("Generate failed to respect Service targetPort YamlSettings: %s", result)
	}
}

func TestGeneratePod_DisabledImage(t *testing.T) {
	nodesJson := `[{"id":"p1","type":"Pod","data":{"label":"My Pod","image":"custom-image","yamlSettings":{"image":false}}}]`
	result := Generate(nodesJson, "[]")
	// image: false should default to "nginx:latest"
	if !strings.Contains(result, "nginx:latest") {
		t.Errorf("Generate failed to respect Pod image YamlSettings: %s", result)
	}
}

func TestGenerateConfigMap_DisabledData(t *testing.T) {
	nodesJson := `[{"id":"cm1","type":"ConfigMap","data":{"label":"My CM","configData":[{"key":"k1","value":"v1"}],"yamlSettings":{"data":false}}}]`
	result := Generate(nodesJson, "[]")
	if strings.Contains(result, "\"data\":") {
		t.Errorf("Generate failed to respect ConfigMap data YamlSettings: %s", result)
	}
}

func TestGenerateSecret_DisabledData(t *testing.T) {
	nodesJson := `[{"id":"s1","type":"Secret","data":{"label":"My Secret","configData":[{"key":"k1","value":"v1"}],"yamlSettings":{"data":false}}}]`
	result := Generate(nodesJson, "[]")
	if strings.Contains(result, "\"stringData\":") {
		t.Errorf("Generate failed to respect Secret data YamlSettings: %s", result)
	}
}
