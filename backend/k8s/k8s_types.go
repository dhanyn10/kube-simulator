package k8s

type ObjectMeta struct {
	Name        string            `yaml:"name" json:"name"`
	Namespace   string            `yaml:"namespace,omitempty" json:"namespace,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty" json:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty" json:"annotations,omitempty"`
}

type ResourceRequirements struct {
	Requests map[string]string `yaml:"requests,omitempty" json:"requests,omitempty"`
	Limits   map[string]string `yaml:"limits,omitempty" json:"limits,omitempty"`
}

type ContainerPort struct {
	ContainerPort int `yaml:"containerPort" json:"containerPort"`
}

type EnvVarSource struct {
	ConfigMapKeyRef *ConfigMapKeySelector `yaml:"configMapKeyRef,omitempty" json:"configMapKeyRef,omitempty"`
	SecretKeyRef    *SecretKeySelector    `yaml:"secretKeyRef,omitempty" json:"secretKeyRef,omitempty"`
}

type ConfigMapKeySelector struct {
	Name string `yaml:"name" json:"name"`
	Key  string `yaml:"key" json:"key"`
}

type SecretKeySelector struct {
	Name string `yaml:"name" json:"name"`
	Key  string `yaml:"key" json:"key"`
}

type EnvVar struct {
	Name      string        `yaml:"name" json:"name"`
	Value     string        `yaml:"value,omitempty" json:"value,omitempty"`
	ValueFrom *EnvVarSource `yaml:"valueFrom,omitempty" json:"valueFrom,omitempty"`
}

type VolumeMount struct {
	Name      string `yaml:"name" json:"name"`
	MountPath string `yaml:"mountPath" json:"mountPath"`
}

type Container struct {
	Name            string                `yaml:"name" json:"name"`
	Image           string                `yaml:"image" json:"image"`
	ImagePullPolicy string                `yaml:"imagePullPolicy,omitempty" json:"imagePullPolicy,omitempty"`
	Ports           []ContainerPort       `yaml:"ports,omitempty" json:"ports,omitempty"`
	Env             []EnvVar              `yaml:"env,omitempty" json:"env,omitempty"`
	Resources       *ResourceRequirements `yaml:"resources,omitempty" json:"resources,omitempty"`
	VolumeMounts    []VolumeMount         `yaml:"volumeMounts,omitempty" json:"volumeMounts,omitempty"`
}

type PersistentVolumeClaimVolumeSource struct {
	ClaimName string `yaml:"claimName" json:"claimName"`
}

type Volume struct {
	Name                  string                             `yaml:"name" json:"name"`
	PersistentVolumeClaim *PersistentVolumeClaimVolumeSource `yaml:"persistentVolumeClaim,omitempty" json:"persistentVolumeClaim,omitempty"`
}

type PodSpec struct {
	Containers []Container `yaml:"containers" json:"containers"`
	Volumes    []Volume    `yaml:"volumes,omitempty" json:"volumes,omitempty"`
}

type Pod struct {
	ApiVersion string     `yaml:"apiVersion" json:"apiVersion"`
	Kind       string     `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta `yaml:"metadata" json:"metadata"`
	Spec       PodSpec    `yaml:"spec" json:"spec"`
}

type LabelSelector struct {
	MatchLabels map[string]string `yaml:"matchLabels" json:"matchLabels"`
}

type DeploymentStrategy struct {
	Type          string                `yaml:"type" json:"type"`
	RollingUpdate *RollingUpdateOptions `yaml:"rollingUpdate,omitempty" json:"rollingUpdate,omitempty"`
}

type RollingUpdateOptions struct {
	MaxSurge       string `yaml:"maxSurge" json:"maxSurge"`
	MaxUnavailable string `yaml:"maxUnavailable" json:"maxUnavailable"`
}

type DeploymentSpec struct {
	Replicas int                 `yaml:"replicas" json:"replicas"`
	Selector LabelSelector       `yaml:"selector" json:"selector"`
	Strategy *DeploymentStrategy `yaml:"strategy,omitempty" json:"strategy,omitempty"`
	Template PodTemplate         `yaml:"template" json:"template"`
}

type ReplicaSet struct {
	ApiVersion string         `yaml:"apiVersion" json:"apiVersion"`
	Kind       string         `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta     `yaml:"metadata" json:"metadata"`
	Spec       DeploymentSpec `yaml:"spec" json:"spec"` // ReplicaSet uses same spec as Deployment minus strategy
}

type PodTemplate struct {
	Metadata ObjectMeta `yaml:"metadata" json:"metadata"`
	Spec     PodSpec    `yaml:"spec" json:"spec"`
}

type Deployment struct {
	ApiVersion string         `yaml:"apiVersion" json:"apiVersion"`
	Kind       string         `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta     `yaml:"metadata" json:"metadata"`
	Spec       DeploymentSpec `yaml:"spec" json:"spec"`
}

type ServicePort struct {
	Protocol   string `yaml:"protocol" json:"protocol"`
	Port       int    `yaml:"port" json:"port"`
	TargetPort int    `yaml:"targetPort,omitempty" json:"targetPort,omitempty"`
}

type ServiceSpec struct {
	Selector map[string]string `yaml:"selector" json:"selector"`
	Ports    []ServicePort     `yaml:"ports" json:"ports"`
}

type Service struct {
	ApiVersion string      `yaml:"apiVersion" json:"apiVersion"`
	Kind       string      `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta  `yaml:"metadata" json:"metadata"`
	Spec       ServiceSpec `yaml:"spec" json:"spec"`
}

type IngressRule struct {
	Host string `yaml:"host" json:"host"`
	HTTP *HTTPIngressRuleValue `yaml:"http,omitempty" json:"http,omitempty"`
}

type HTTPIngressRuleValue struct {
	Paths []HTTPIngressPath `yaml:"paths" json:"paths"`
}

type HTTPIngressPath struct {
	Path     string         `yaml:"path" json:"path"`
	PathType string         `yaml:"pathType" json:"pathType"`
	Backend  IngressBackend `yaml:"backend" json:"backend"`
}

type IngressBackend struct {
	Service IngressServiceBackend `yaml:"service" json:"service"`
}

type IngressServiceBackend struct {
	Name string             `yaml:"name" json:"name"`
	Port ServiceBackendPort `yaml:"port" json:"port"`
}

type ServiceBackendPort struct {
	Number int `yaml:"number" json:"number"`
}

type IngressSpec struct {
	IngressClassName string        `yaml:"ingressClassName" json:"ingressClassName"`
	Rules            []IngressRule `yaml:"rules" json:"rules"`
}

type Ingress struct {
	ApiVersion string      `yaml:"apiVersion" json:"apiVersion"`
	Kind       string      `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta  `yaml:"metadata" json:"metadata"`
	Spec       IngressSpec `yaml:"spec" json:"spec"`
}

type HPA struct {
	ApiVersion string   `yaml:"apiVersion" json:"apiVersion"`
	Kind       string   `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta `yaml:"metadata" json:"metadata"`
	Spec       HPASpec    `yaml:"spec" json:"spec"`
}

type HPASpec struct {
	ScaleTargetRef CrossVersionObjectReference `yaml:"scaleTargetRef" json:"scaleTargetRef"`
	MinReplicas    int                         `yaml:"minReplicas" json:"minReplicas"`
	MaxReplicas    int                         `yaml:"maxReplicas" json:"maxReplicas"`
	Metrics        []HPAMetric                 `yaml:"metrics,omitempty" json:"metrics,omitempty"`
}

type CrossVersionObjectReference struct {
	ApiVersion string `yaml:"apiVersion" json:"apiVersion"`
	Kind       string `yaml:"kind" json:"kind"`
	Name       string `yaml:"name" json:"name"`
}

type HPAMetric struct {
	Type     string            `yaml:"type" json:"type"`
	Resource *ResourceMetricSource `yaml:"resource,omitempty" json:"resource,omitempty"`
}

type ResourceMetricSource struct {
	Name   string               `yaml:"name" json:"name"`
	Target MetricTarget         `yaml:"target" json:"target"`
}

type MetricTarget struct {
	Type               string `yaml:"type" json:"type"`
	AverageUtilization int    `yaml:"averageUtilization" json:"averageUtilization"`
}

type PVC struct {
	ApiVersion string     `yaml:"apiVersion" json:"apiVersion"`
	Kind       string     `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta `yaml:"metadata" json:"metadata"`
	Spec       PVCSpec    `yaml:"spec" json:"spec"`
}

type PVCSpec struct {
	AccessModes      []string             `yaml:"accessModes" json:"accessModes"`
	StorageClassName string               `yaml:"storageClassName,omitempty" json:"storageClassName,omitempty"`
	Resources        ResourceRequirements `yaml:"resources" json:"resources"`
}

type ConfigMap struct {
	ApiVersion string            `yaml:"apiVersion" json:"apiVersion"`
	Kind       string            `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta        `yaml:"metadata" json:"metadata"`
	Data       map[string]string `yaml:"data,omitempty" json:"data,omitempty"`
}

type Secret struct {
	ApiVersion string            `yaml:"apiVersion" json:"apiVersion"`
	Kind       string            `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta        `yaml:"metadata" json:"metadata"`
	Type       string            `yaml:"type" json:"type"`
	StringData map[string]string `yaml:"stringData,omitempty" json:"stringData,omitempty"`
}

type Namespace struct {
	ApiVersion string     `yaml:"apiVersion" json:"apiVersion"`
	Kind       string     `yaml:"kind" json:"kind"`
	Metadata   ObjectMeta `yaml:"metadata" json:"metadata"`
}
