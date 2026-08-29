//go:build windows

package system

import (
	"runtime"
	"strconv"
	"strings"

	"golang.org/x/sys/windows"
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

func fileTimeToUint64(ft windows.Filetime) uint64 {
	return uint64(ft.HighDateTime)<<32 | uint64(ft.LowDateTime)
}

func getWinMemoryStats() (totalGB uint64, freeGB float64) {
	var msx windows.MemoryStatusEx
	msx.Length = uint32(windows.SizeofMemoryStatusEx)
	err := windows.GlobalMemoryStatusEx(&msx)
	if err == nil {
		totalGB = (msx.TotalPhys + (1024 * 1024 * 1024) - 1) / (1024 * 1024 * 1024)
		freeGB = float64(msx.AvailPhys) / (1024 * 1024 * 1024)
		return totalGB, freeGB
	}
	return 16, 8.0
}

func getWinCpuUsage() int {
	var idleTime, kernelTime, userTime windows.Filetime
	err := windows.GetSystemTimes(&idleTime, &kernelTime, &userTime)
	if err == nil {
		idle := fileTimeToUint64(idleTime)
		kernel := fileTimeToUint64(kernelTime)
		user := fileTimeToUint64(userTime)
		total := kernel + user
		if total > 0 {
			busy := total - idle
			return int((busy * 100) / total)
		}
	}
	return 0
}

// GetSystemResources returns the local CPU cores and total/available memory in GB using native Win32 API via golang.org/x/sys/windows
func GetSystemResources() map[string]interface{} {
	cores := runtime.NumCPU()
	totalMemoryGB, freeMemoryGB := getWinMemoryStats()
	cpuUsage := getWinCpuUsage()

	return map[string]interface{}{
		"cpuCores":      cores,
		"cpuUsage":      cpuUsage,
		"totalMemoryGB": totalMemoryGB,
		"freeMemoryGB":  freeMemoryGB,
	}
}
