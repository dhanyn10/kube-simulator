package yaml_gen

import (
	"build-wails/backend/k8s"
	"encoding/json"
	"fmt"
	"strings"
)

type GenContext struct {
	nodes    []k8s.FrontendNode
	edges    []k8s.FrontendEdge
	nodeMap  map[string]*k8s.FrontendNode
	edgeMap  map[string][]k8s.FrontendEdge
	nsMap    map[string]string // nodeId -> namespaceName
}

func Generate(nodesJson, edgesJson string) string {
	var nodes []k8s.FrontendNode
	var edges []k8s.FrontendEdge

	if err := json.Unmarshal([]byte(nodesJson), &nodes); err != nil {
		return fmt.Sprintf("Error parsing nodes: %v", err)
	}
	if err := json.Unmarshal([]byte(edgesJson), &edges); err != nil {
		return fmt.Sprintf("Error parsing edges: %v", err)
	}

	ctx := &GenContext{
		nodes:   nodes,
		edges:   edges,
		nodeMap: make(map[string]*k8s.FrontendNode),
		edgeMap: make(map[string][]k8s.FrontendEdge),
		nsMap:   make(map[string]string),
	}

	for i := range nodes {
		ctx.nodeMap[nodes[i].ID] = &nodes[i]
	}
	for _, e := range edges {
		ctx.edgeMap[e.Source] = append(ctx.edgeMap[e.Source], e)
	}

	var manifests []interface{}
	for _, node := range nodes {
		obj := generateNodeObject(node, ctx)
		if obj != nil {
			manifests = append(manifests, obj)
		}
	}

	jsonData, err := json.Marshal(manifests)
	if err != nil {
		return fmt.Sprintf("Error generating JSON: %v", err)
	}

	return string(jsonData)
}

func generateNodeObject(node k8s.FrontendNode, ctx *GenContext) interface{} {
	data := node.Data
	if data.Label == "" || node.Type == "" {
		return nil
	}

	// Skip nodes that don't produce YAML directly
	if node.Type == "Internet" {
		return nil
	}

	// Special check for nested pods (only top-level or Namespace-child pods are generated)
	if node.Type == "Pod" && node.ParentID != "" {
		parent := ctx.nodeMap[node.ParentID]
		if parent == nil || parent.Type != "Namespace" {
			return nil
		}
	}

	name := sanitizeName(data.Label)
	namespace := getNamespace(node, ctx)

	var obj interface{}

	switch node.Type {
	case "Namespace":
		obj = generateNamespace(data, name)
	case "Pod":
		obj = generatePodOrDeployment(data, name, namespace, ctx)
	case "Deployment":
		obj = generateDeployment(data, name, namespace, ctx)
	case "ReplicaSet":
		obj = generateReplicaSet(data, name, namespace, ctx)
	case "Service":
		obj = generateService(data, name, namespace, ctx)
	case "Ingress":
		obj = generateIngress(data, name, namespace, ctx)
	case "HPA":
		obj = generateHPA(data, name, namespace, ctx)
	case "PVC":
		obj = generatePVC(data, name, namespace)
	case "ConfigMap":
		obj = generateConfigMap(data, name, namespace)
	case "Secret":
		obj = generateSecret(data, name, namespace)
	default:
		return nil
	}

	return obj
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

func getNamespace(node k8s.FrontendNode, ctx *GenContext) string {
	if node.ParentID == "" {
		return ""
	}
	if ns, ok := ctx.nsMap[node.ID]; ok {
		return ns
	}
	parent := ctx.nodeMap[node.ParentID]
	if parent != nil && parent.Type == "Namespace" {
		ns := sanitizeName(parent.Data.Label)
		ctx.nsMap[node.ID] = ns
		return ns
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
