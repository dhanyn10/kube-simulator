//go:build !windows

package system

import (
	"runtime"
)

func GetSystemResources() map[string]interface{} {
	cores := runtime.NumCPU()
	
	// Mock or simple fallback for non-windows platforms in this specific project context
	return map[string]interface{}{
		"cpuCores":      cores,
		"totalMemoryGB": 16, 
	}
}
