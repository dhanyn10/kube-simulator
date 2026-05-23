package k8s

type ObjectMeta struct {
	Name        string            `yaml:"name"`
	Namespace   string            `yaml:"namespace,omitempty"`
	Labels      map[string]string `yaml:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations,omitempty"`
}

type ResourceRequirements struct {
	Requests map[string]string `yaml:"requests,omitempty"`
	Limits   map[string]string `yaml:"limits,omitempty"`
}

type ContainerPort struct {
	ContainerPort int `yaml:"containerPort"`
}

type EnvVarSource struct {
	ConfigMapKeyRef *ConfigMapKeySelector `yaml:"configMapKeyRef,omitempty"`
	SecretKeyRef    *SecretKeySelector    `yaml:"secretKeyRef,omitempty"`
}

type ConfigMapKeySelector struct {
	Name string `yaml:"name"`
	Key  string `yaml:"key"`
}

type SecretKeySelector struct {
	Name string `yaml:"name"`
	Key  string `yaml:"key"`
}

type EnvVar struct {
	Name      string        `yaml:"name"`
	Value     string        `yaml:"value,omitempty"`
	ValueFrom *EnvVarSource `yaml:"valueFrom,omitempty"`
}

type VolumeMount struct {
	Name      string `yaml:"name"`
	MountPath string `yaml:"mountPath"`
}

type Container struct {
	Name            string                `yaml:"name"`
	Image           string                `yaml:"image"`
	ImagePullPolicy string                `yaml:"imagePullPolicy,omitempty"`
	Ports           []ContainerPort       `yaml:"ports,omitempty"`
	Env             []EnvVar              `yaml:"env,omitempty"`
	Resources       *ResourceRequirements `yaml:"resources,omitempty"`
	VolumeMounts    []VolumeMount         `yaml:"volumeMounts,omitempty"`
}

type PersistentVolumeClaimVolumeSource struct {
	ClaimName string `yaml:"claimName"`
}

type Volume struct {
	Name                  string                             `yaml:"name"`
	PersistentVolumeClaim *PersistentVolumeClaimVolumeSource `yaml:"persistentVolumeClaim,omitempty"`
}

type PodSpec struct {
	Containers []Container `yaml:"containers"`
	Volumes    []Volume    `yaml:"volumes,omitempty"`
}

type Pod struct {
	ApiVersion string     `yaml:"apiVersion"`
	Kind       string     `yaml:"kind"`
	Metadata   ObjectMeta `yaml:"metadata"`
	Spec       PodSpec    `yaml:"spec"`
}

type LabelSelector struct {
	MatchLabels map[string]string `yaml:"matchLabels"`
}

type DeploymentStrategy struct {
	Type          string                `yaml:"type"`
	RollingUpdate *RollingUpdateOptions `yaml:"rollingUpdate,omitempty"`
}

type RollingUpdateOptions struct {
	MaxSurge       string `yaml:"maxSurge"`
	MaxUnavailable string `yaml:"maxUnavailable"`
}

type DeploymentSpec struct {
	Replicas int                 `yaml:"replicas"`
	Selector LabelSelector       `yaml:"selector"`
	Strategy *DeploymentStrategy `yaml:"strategy,omitempty"`
	Template PodTemplate         `yaml:"template"`
}

type ReplicaSet struct {
	ApiVersion string         `yaml:"apiVersion"`
	Kind       string         `yaml:"kind"`
	Metadata   ObjectMeta     `yaml:"metadata"`
	Spec       DeploymentSpec `yaml:"spec"` // ReplicaSet uses same spec as Deployment minus strategy
}

type PodTemplate struct {
	Metadata ObjectMeta `yaml:"metadata"`
	Spec     PodSpec    `yaml:"spec"`
}

type Deployment struct {
	ApiVersion string         `yaml:"apiVersion"`
	Kind       string         `yaml:"kind"`
	Metadata   ObjectMeta     `yaml:"metadata"`
	Spec       DeploymentSpec `yaml:"spec"`
}

type ServicePort struct {
	Protocol   string `yaml:"protocol"`
	Port       int    `yaml:"port"`
	TargetPort int    `yaml:"targetPort,omitempty"`
}

type ServiceSpec struct {
	Selector map[string]string `yaml:"selector"`
	Ports    []ServicePort     `yaml:"ports"`
}

type Service struct {
	ApiVersion string      `yaml:"apiVersion"`
	Kind       string      `yaml:"kind"`
	Metadata   ObjectMeta  `yaml:"metadata"`
	Spec       ServiceSpec `yaml:"spec"`
}

type IngressRule struct {
	Host string `yaml:"host"`
	HTTP *HTTPIngressRuleValue `yaml:"http,omitempty"`
}

type HTTPIngressRuleValue struct {
	Paths []HTTPIngressPath `yaml:"paths"`
}

type HTTPIngressPath struct {
	Path     string         `yaml:"path"`
	PathType string         `yaml:"pathType"`
	Backend  IngressBackend `yaml:"backend"`
}

type IngressBackend struct {
	Service IngressServiceBackend `yaml:"service"`
}

type IngressServiceBackend struct {
	Name string             `yaml:"name"`
	Port ServiceBackendPort `yaml:"port"`
}

type ServiceBackendPort struct {
	Number int `yaml:"number"`
}

type IngressSpec struct {
	IngressClassName string        `yaml:"ingressClassName"`
	Rules            []IngressRule `yaml:"rules"`
}

type Ingress struct {
	ApiVersion string      `yaml:"apiVersion"`
	Kind       string      `yaml:"kind"`
	Metadata   ObjectMeta  `yaml:"metadata"`
	Spec       IngressSpec `yaml:"spec"`
}

type HPA struct {
	ApiVersion string   `yaml:"apiVersion"`
	Kind       string   `yaml:"kind"`
	Metadata   ObjectMeta `yaml:"metadata"`
	Spec       HPASpec    `yaml:"spec"`
}

type HPASpec struct {
	ScaleTargetRef CrossVersionObjectReference `yaml:"scaleTargetRef"`
	MinReplicas    int                         `yaml:"minReplicas"`
	MaxReplicas    int                         `yaml:"maxReplicas"`
	Metrics        []HPAMetric                 `yaml:"metrics,omitempty"`
}

type CrossVersionObjectReference struct {
	ApiVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
	Name       string `yaml:"name"`
}

type HPAMetric struct {
	Type     string            `yaml:"type"`
	Resource *ResourceMetricSource `yaml:"resource,omitempty"`
}

type ResourceMetricSource struct {
	Name   string               `yaml:"name"`
	Target MetricTarget         `yaml:"target"`
}

type MetricTarget struct {
	Type               string `yaml:"type"`
	AverageUtilization int    `yaml:"averageUtilization"`
}

type PVC struct {
	ApiVersion string     `yaml:"apiVersion"`
	Kind       string     `yaml:"kind"`
	Metadata   ObjectMeta `yaml:"metadata"`
	Spec       PVCSpec    `yaml:"spec"`
}

type PVCSpec struct {
	AccessModes      []string             `yaml:"accessModes"`
	StorageClassName string               `yaml:"storageClassName,omitempty"`
	Resources        ResourceRequirements `yaml:"resources"`
}

type ConfigMap struct {
	ApiVersion string            `yaml:"apiVersion"`
	Kind       string            `yaml:"kind"`
	Metadata   ObjectMeta        `yaml:"metadata"`
	Data       map[string]string `yaml:"data,omitempty"`
}

type Secret struct {
	ApiVersion string            `yaml:"apiVersion"`
	Kind       string            `yaml:"kind"`
	Metadata   ObjectMeta        `yaml:"metadata"`
	Type       string            `yaml:"type"`
	StringData map[string]string `yaml:"stringData,omitempty"`
}

type Namespace struct {
	ApiVersion string     `yaml:"apiVersion"`
	Kind       string     `yaml:"kind"`
	Metadata   ObjectMeta `yaml:"metadata"`
}
