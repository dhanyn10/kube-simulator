package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
	"encoding/json"
	"fmt"
	"strings"
)

// GenContext holds canvas context, node mappings, and relationship edges for YAML manifest generation.
type GenContext struct {
	nodes         []k8s.FrontendNode
	edges         []k8s.FrontendEdge
	nodeMap       map[string]*k8s.FrontendNode
	sourceEdgeMap map[string][]k8s.FrontendEdge
	targetEdgeMap map[string][]k8s.FrontendEdge
	nsMap         map[string]string // nodeId -> namespaceName
}

// Generate converts frontend nodes and edges JSON strings into a unified JSON array string of Kubernetes resource objects.
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
		nodes:         nodes,
		edges:         edges,
		nodeMap:       make(map[string]*k8s.FrontendNode),
		sourceEdgeMap: make(map[string][]k8s.FrontendEdge),
		targetEdgeMap: make(map[string][]k8s.FrontendEdge),
		nsMap:         make(map[string]string),
	}

	for i := range nodes {
		ctx.nodeMap[nodes[i].ID] = &nodes[i]
	}
	for _, edge := range edges {
		ctx.sourceEdgeMap[edge.Source] = append(ctx.sourceEdgeMap[edge.Source], edge)
		ctx.targetEdgeMap[edge.Target] = append(ctx.targetEdgeMap[edge.Target], edge)
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

// generateNodeObject delegates generation of a single canvas node to its corresponding ResourceGenerator.
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

	generator, ok := DefaultFactory.GetGenerator(node.Type)
	if !ok {
		return nil
	}

	return generator.Generate(data, name, namespace, ctx)
}

// sanitizeName formats node labels into valid DNS-1123 compliant Kubernetes resource names.
func sanitizeName(label string) string {
	sanitizedResult := strings.ReplaceAll(strings.ToLower(label), "_", "-")
	sanitizedResult = strings.ReplaceAll(sanitizedResult, " ", "-")
	// Kubernetes DNS-1123: only alphanumeric and '-'
	sanitizeRune := func(charRune rune) rune {
		if (charRune >= 'a' && charRune <= 'z') || (charRune >= '0' && charRune <= '9') || charRune == '-' {
			return charRune
		}
		return '-'
	}
	sanitizedResult = strings.Map(sanitizeRune, sanitizedResult)
	for strings.Contains(sanitizedResult, "--") {
		sanitizedResult = strings.ReplaceAll(sanitizedResult, "--", "-")
	}
	// Ensure it starts and ends with alphanumeric
	sanitizedResult = strings.Trim(sanitizedResult, "-")
	if len(sanitizedResult) > 63 {
		sanitizedResult = sanitizedResult[:63]
		sanitizedResult = strings.TrimRight(sanitizedResult, "-")
	}
	return sanitizedResult
}


// getNamespace determines the target Kubernetes namespace for a given node based on parent canvas hierarchy.
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
// generateNamespace constructs a Kubernetes Namespace object structure.
func generateNamespace(data k8s.K8sNodeData, name string) interface{} {
	return k8s.Namespace{
		ApiVersion: "v1",
		Kind:       "Namespace",
		Metadata: k8s.ObjectMeta{
			Name: name,
		},
	}
}
