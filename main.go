package main

import (
	"context"
	"embed"
	"log"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	// メニューの定義 (F5)
	appMenu := menu.NewMenu()
	fileMenu := appMenu.AddSubmenu("ファイル")
	fileMenu.AddText("フォルダを開く...", keys.CmdOrCtrl("o"), func(_ *menu.CallbackData) {
		go func() {
			folder, err := app.SelectFolder()
			if err == nil && folder != "" {
				if err := app.OpenFolder(folder); err != nil {
					log.Printf("フォルダのオープンに失敗しました: %v\n", err)
				}
			}
		}()
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("終了", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		if app.ctx != nil {
			runtime.Quit(app.ctx)
		}
	})

	err := wails.Run(&options.App{
		Title:  "pumlv",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// ドラッグ＆ドロップ設定 (F4)
			runtime.OnFileDrop(ctx, func(x, y int, paths []string) {
				for _, p := range paths {
					if info, err := os.Stat(p); err == nil && info.IsDir() {
						go func(path string) {
							if err := app.OpenFolder(path); err != nil {
								log.Printf("DnDでのフォルダオープンに失敗しました: %v\n", err)
							}
						}(p)
						return
					}
				}
			})
		},
		OnDomReady: app.domReady,
		OnShutdown: app.shutdown,
		Menu:       appMenu,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: false,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
