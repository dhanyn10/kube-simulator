//go:build !windows

package system

import (
	"runtime"
)

func GetSystemResources() map[string]interface{} {
	cores := runtime.NumCPU()
	
	// Fallback for non-windows platforms in sandbox/web context
	return map[string]interface{}{
		"cpuCores":      cores,
		"cpuUsage":      10,
		"totalMemoryGB": 16,
		"freeMemoryGB":  8.0,
	}
}
