package k8s

type K8sResourceType string

const (
	TypePod        K8sResourceType = "Pod"
	TypeService    K8sResourceType = "Service"
	TypeDeployment K8sResourceType = "Deployment"
	TypeNamespace  K8sResourceType = "Namespace"
	TypeInternet   K8sResourceType = "Internet"
	TypeIngress    K8sResourceType = "Ingress"
	TypeHPA        K8sResourceType = "HPA"
	TypePVC        K8sResourceType = "PVC"
	TypeConfigMap  K8sResourceType = "ConfigMap"
	TypeSecret     K8sResourceType = "Secret"
)

type ConfigDataItem struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type K8sNodeData struct {
	ID              string                 `json:"id"`
	Label           string                 `json:"label"`
	Type            K8sResourceType        `json:"type"`
	Replicas        *int                   `json:"replicas,omitempty"`
	Image           string                 `json:"image,omitempty"`
	Port            int                    `json:"port,omitempty"`
	TargetPort      int                    `json:"targetPort,omitempty"`
	Selector        string                 `json:"selector,omitempty"`
	Status          string                 `json:"status,omitempty"`
	Webserver       string                 `json:"webserver,omitempty"`
	Runtime         string                 `json:"runtime,omitempty"`
	Framework       string                 `json:"framework,omitempty"`
	CpuRequest      string                 `json:"cpuRequest,omitempty"`
	CpuLimit        string                 `json:"cpuLimit,omitempty"`
	MemoryRequest   string                 `json:"memoryRequest,omitempty"`
	MemoryLimit     string                 `json:"memoryLimit,omitempty"`
	MinReplicas     *int                   `json:"minReplicas,omitempty"`
	MaxReplicas     *int                   `json:"maxReplicas,omitempty"`
	TargetCPU       *int                   `json:"targetCPU,omitempty"`
	TargetMemory    *int                   `json:"targetMemory,omitempty"`
	IngressHost     string                 `json:"ingressHost,omitempty"`
	IngressPath     string                 `json:"ingressPath,omitempty"`
	Traffic         float64                `json:"traffic,omitempty"`
	YamlSettings    map[string]bool        `json:"yamlSettings,omitempty"`
	StorageCapacity string                 `json:"storageCapacity,omitempty"`
	AccessMode      string                 `json:"accessMode,omitempty"`
	StorageClass    string                 `json:"storageClass,omitempty"`
	ConfigData      []ConfigDataItem       `json:"configData,omitempty"`
}

type FrontendNode struct {
	ID       string      `json:"id"`
	Type     string      `json:"type"`
	Data     K8sNodeData `json:"data"`
	ParentID string      `json:"parentId,omitempty"`
}

type FrontendEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}
