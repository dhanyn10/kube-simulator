//go:build windows

package system

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
)

var wmicPath = filepath.Join(os.Getenv("SystemRoot"), "System32", "wbem", "wmic.exe")

func runWmic(arg ...string) ([]byte, error) {
	cmd := exec.Command(wmicPath, arg...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Output()
}

func runPowershell(script string) ([]byte, error) {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script) // NOSONAR
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Output()
}

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

func getTotalMemoryGB() uint64 {
	totalOut, err := runWmic("computersystem", "get", "TotalPhysicalMemory")
	val := uint64(0)
	if err == nil {
		val = parseValueFromOutput(totalOut)
	}
	if val == 0 {
		psOut, psErr := runPowershell("(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory")
		if psErr == nil {
			val = parseValueFromOutput(psOut)
		}
	}
	if val > 0 {
		return (val + (1024 * 1024 * 1024) - 1) / (1024 * 1024 * 1024)
	}
	return 16
}

func getFreeMemoryGB() float64 {
	freeOut, err := runWmic("os", "get", "FreePhysicalMemory")
	valKB := uint64(0)
	if err == nil {
		valKB = parseValueFromOutput(freeOut)
	}
	if valKB == 0 {
		psOut, psErr := runPowershell("(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory")
		if psErr == nil {
			valKB = parseValueFromOutput(psOut)
		}
	}
	if valKB > 0 {
		return float64(valKB) / (1024 * 1024)
	}
	return 8.0
}

func getCpuUsage() int {
	cpuOut, err := runWmic("cpu", "get", "loadpercentage")
	val := uint64(0)
	if err == nil {
		val = parseValueFromOutput(cpuOut)
	}
	if val == 0 {
		psOut, psErr := runPowershell("(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average")
		if psErr == nil {
			val = parseValueFromOutput(psOut)
		}
	}
	return int(val)
}

// GetSystemResources returns the local CPU cores and total/available memory in GB using WMIC with PowerShell fallback
func GetSystemResources() map[string]interface{} {
	cores := runtime.NumCPU()
	totalMemoryGB := getTotalMemoryGB()
	freeMemoryGB := getFreeMemoryGB()
	cpuUsage := getCpuUsage()

	return map[string]interface{}{
		"cpuCores":       cores,
		"cpuUsage":       cpuUsage,
		"totalMemoryGB":  totalMemoryGB,
		"freeMemoryGB":   freeMemoryGB,
	}
}
