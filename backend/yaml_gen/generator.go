package yaml_gen

import (
	"build-wails/backend/k8s"
	"encoding/json"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

func Generate(nodesJson, edgesJson string) string {
	var nodes []k8s.FrontendNode
	var edges []k8s.FrontendEdge

	if err := json.Unmarshal([]byte(nodesJson), &nodes); err != nil {
		return fmt.Sprintf("Error parsing nodes: %v", err)
	}
	if err := json.Unmarshal([]byte(edgesJson), &edges); err != nil {
		return fmt.Sprintf("Error parsing edges: %v", err)
	}

	var manifests []string

	for _, node := range nodes {
		manifest := generateNodeYaml(node, nodes, edges)
		if manifest != "" {
			manifests = append(manifests, manifest)
		}
	}

	return strings.Join(manifests, "---\n")
}

func generateNodeYaml(node k8s.FrontendNode, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) string {
	data := node.Data
	if data.Label == "" || node.Type == "" {
		return ""
	}

	// Skip nodes that don't produce YAML directly
	if node.Type == "Internet" {
		return ""
	}

	// Special check for nested pods (only top-level or Namespace-child pods are generated)
	if node.Type == "Pod" && node.ParentID != "" {
		parent := findNodeByID(node.ParentID, nodes)
		if parent == nil || parent.Type != "Namespace" {
			return ""
		}
	}

	name := sanitizeName(data.Label)
	namespace := getNamespace(node, nodes)

	var obj interface{}

	switch node.Type {
	case "Namespace":
		obj = generateNamespace(data, name)
	case "Pod":
		obj = generatePodOrDeployment(data, name, namespace, nodes, edges)
	case "Deployment":
		obj = generateDeployment(data, name, namespace, nodes, edges)
	case "ReplicaSet":
		obj = generateReplicaSet(data, name, namespace, nodes, edges)
	case "Service":
		obj = generateService(data, name, namespace, nodes, edges)
	case "Ingress":
		obj = generateIngress(data, name, namespace, nodes, edges)
	case "HPA":
		obj = generateHPA(data, name, namespace, nodes, edges)
	case "PVC":
		obj = generatePVC(data, name, namespace)
	case "ConfigMap":
		obj = generateConfigMap(data, name, namespace)
	case "Secret":
		obj = generateSecret(data, name, namespace)
	default:
		return ""
	}

	if obj == nil {
		return ""
	}

	yamlData, err := yaml.Marshal(obj)
	if err != nil {
		return fmt.Sprintf("Error generating YAML for %s: %v", name, err)
	}

	return string(yamlData)
}

func sanitizeName(label string) string {
	return strings.ReplaceAll(strings.ToLower(label), " ", "-")
}

func findNodeByID(id string, nodes []k8s.FrontendNode) *k8s.FrontendNode {
	for i := range nodes {
		if nodes[i].ID == id {
			return &nodes[i]
		}
	}
	return nil
}

func getNamespace(node k8s.FrontendNode, nodes []k8s.FrontendNode) string {
	if node.ParentID == "" {
		return ""
	}
	parent := findNodeByID(node.ParentID, nodes)
	if parent != nil && parent.Type == "Namespace" {
		return sanitizeName(parent.Data.Label)
	}
	return ""
}

// Logic for each resource type goes here...
// (I will implement them in the next tool call to keep it manageable)
func generateNamespace(data k8s.K8sNodeData, name string) interface{} {
	return k8s.Namespace{
		ApiVersion: "v1",
		Kind:       "Namespace",
		Metadata: k8s.ObjectMeta{
			Name: name,
		},
	}
}
