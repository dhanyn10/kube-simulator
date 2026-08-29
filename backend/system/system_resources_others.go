//go:build !windows

package system

import (
	"runtime"
	"strconv"
	"strings"
)

func parseValueFromOutput(out []byte) uint64 {
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.EqualFold(trimmed, "TotalPhysicalMemory") || strings.EqualFold(trimmed, "FreePhysicalMemory") || strings.EqualFold(trimmed, "LoadPercentage") {
			continue
		}
		fields := strings.Fields(trimmed)
		for _, f := range fields {
			if val, err := strconv.ParseUint(f, 10, 64); err == nil {
				return val
			}
		}
	}
	return 0
}

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
