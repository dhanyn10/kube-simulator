package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Handle file association (Open With)
	if len(os.Args) > 1 {
		arg := os.Args[1]
		if strings.HasSuffix(strings.ToLower(arg), ".infra") {
			if _, err := os.Stat(arg); err == nil {
				absPath, err := filepath.Abs(arg)
				if err == nil {
					app.SetInitialFile(absPath)
				}
			}
		}
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "build-wails",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
