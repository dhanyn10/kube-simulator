package system

import (
	"testing"
)

func TestParseValueFromOutput(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected uint64
	}{
		{
			name:     "WMIC TotalMemory Output",
			input:    "TotalPhysicalMemory  \r\n17179869184  \r\n\r\n",
			expected: 17179869184,
		},
		{
			name:     "WMIC FreeMemory Output",
			input:    "FreePhysicalMemory  \r\n8388608  \r\n\r\n",
			expected: 8388608,
		},
		{
			name:     "PowerShell Output Single Line",
			input:    "17179869184\n",
			expected: 17179869184,
		},
		{
			name:     "Empty Output",
			input:    "",
			expected: 0,
		},
		{
			name:     "Non-numeric Header Only",
			input:    "LoadPercentage\n\n",
			expected: 0,
		},
		{
			name:     "Dirty Output with Leading Strings",
			input:    "FreePhysicalMemory\n  invalid_token 1048576  \n",
			expected: 1048576,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val := parseValueFromOutput([]byte(tt.input))
			if val != tt.expected {
				t.Errorf("parseValueFromOutput(%q) = %d, expected %d", tt.input, val, tt.expected)
			}
		})
	}
}

func TestGetSystemResources(t *testing.T) {
	res := GetSystemResources()
	if res == nil {
		t.Fatal("expected non-nil system resources")
	}

	keys := []string{"cpuCores", "cpuUsage", "totalMemoryGB", "freeMemoryGB"}
	for _, key := range keys {
		if _, ok := res[key]; !ok {
			t.Errorf("expected %s in system resources", key)
		}
	}

	if cores, ok := res["cpuCores"].(int); !ok || cores <= 0 {
		t.Errorf("expected cpuCores > 0, got %v", res["cpuCores"])
	}

	if mem, ok := res["totalMemoryGB"].(uint64); !ok || mem == 0 {
		if memInt, okInt := res["totalMemoryGB"].(int); !okInt || memInt == 0 {
			t.Errorf("expected totalMemoryGB > 0, got %v", res["totalMemoryGB"])
		}
	}
}
