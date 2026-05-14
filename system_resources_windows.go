//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

var wmicPath = filepath.Join(os.Getenv("SystemRoot"), "System32", "wbem", "wmic.exe")

// GetSystemResources returns the local CPU cores and total/available memory in GB using WMIC
func (a *App) GetSystemResources() map[string]interface{} {
	cores := runtime.NumCPU()

	// Get Total Memory
	totalOut, _ := exec.Command(wmicPath, "computersystem", "get", "TotalPhysicalMemory").Output()
	totalMemoryGB := uint64(16)
	
	totalLines := strings.Split(string(totalOut), "\n")
	if len(totalLines) >= 2 {
		memStr := strings.TrimSpace(totalLines[1])
		if memBytes, err := strconv.ParseUint(memStr, 10, 64); err == nil {
			totalMemoryGB = (memBytes + (1024 * 1024 * 1024) - 1) / (1024 * 1024 * 1024)
		}
	}

	// Get Free Memory (returns in KB)
	freeOut, _ := exec.Command(wmicPath, "os", "get", "FreePhysicalMemory").Output()
	freeMemoryGB := float64(0)
	
	freeLines := strings.Split(string(freeOut), "\n")
	if len(freeLines) >= 2 {
		freeStr := strings.TrimSpace(freeLines[1])
		if freeKB, err := strconv.ParseUint(freeStr, 10, 64); err == nil {
			freeMemoryGB = float64(freeKB) / (1024 * 1024)
		}
	}

	// Get CPU Usage (Percent)
	cpuOut, _ := exec.Command(wmicPath, "cpu", "get", "loadpercentage").Output()
	cpuUsage := 0
	cpuLines := strings.Split(string(cpuOut), "\n")
	if len(cpuLines) >= 2 {
		cpuStr := strings.TrimSpace(cpuLines[1])
		if val, err := strconv.Atoi(cpuStr); err == nil {
			cpuUsage = val
		}
	}

	return map[string]interface{}{
		"cpuCores":       cores,
		"cpuUsage":       cpuUsage,
		"totalMemoryGB":  totalMemoryGB,
		"freeMemoryGB":   freeMemoryGB,
	}
}
