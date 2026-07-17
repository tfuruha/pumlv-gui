package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	"pumlv-gui/internal/config"
	"pumlv-gui/internal/server"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App はアプリケーションのメイン構造体
type App struct {
	ctx          context.Context
	srv          *server.Server
	srvMu        sync.Mutex
	initialPaths []string
	cfg          *config.Config
}

// NewApp はアプリインスタンスを生成する
func NewApp() *App {
	return &App{}
}

// startup は Wails フレームワークから起動時に呼ばれるコールバック
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 設定を読み込む
	cfg, err := config.Load()
	if err != nil {
		log.Printf("設定の読み込みに失敗しました: %v\n", err)
		a.cfg = &config.Config{}
	} else {
		a.cfg = cfg
	}

	// CLI 引数からパスを取得
	paths := os.Args[1:]
	a.initialPaths = paths

	// 起動時に引数がある場合、または前回フォルダが記憶されている場合は自動で開く
	var targetPath string
	if len(paths) > 0 {
		targetPath = paths[0]
	} else if a.cfg.LastFolder != "" {
		// ディレクトリの実在チェック
		if info, err := os.Stat(a.cfg.LastFolder); err == nil && info.IsDir() {
			targetPath = a.cfg.LastFolder
		}
		log.Printf("前回記憶されたフォルダを使用します: %s\n", targetPath)
	}

	if targetPath != "" {
		if err := a.openFolderInternal(targetPath); err != nil {
			log.Printf("自動オープンに失敗しました: %v\n", err)
		}
	}
}

// domReady は DOMがロードされた後に呼ばれるコールバック
func (a *App) domReady(ctx context.Context) {
	// 監視中のフォルダがない場合、自動的にフォルダ選択ダイアログを開く（要件 F2）
	a.srvMu.Lock()
	srv := a.srv
	a.srvMu.Unlock()

	if srv == nil {
		// 少しディレイを入れるか、goroutineで非同期実行してUIブロックを回避
		go func() {
			log.Println("フォルダ未指定のため、フォルダ選択ダイアログを表示します")
			folder, err := a.SelectFolder()
			if err == nil && folder != "" {
				if err := a.OpenFolder(folder); err != nil {
					log.Printf("フォルダのオープンに失敗しました: %v\n", err)
				}
			}
		}()
	}
}

// openFolderInternal は内部的なフォルダオープン共通処理
func (a *App) openFolderInternal(path string) error {
	a.srvMu.Lock()
	defer a.srvMu.Unlock()

	// 既存の監視サービスがあれば終了する
	if a.srv != nil {
		if err := a.srv.Shutdown(); err != nil {
			log.Printf("古いサービスの終了に失敗しました: %v\n", err)
		}
		a.srv = nil
	}

	opts := server.Options{
		Paths: []string{path},
		Exts:  []string{".puml", ".plantuml", ".iuml", ".wsd"},
	}

	srv, err := server.New(a.ctx, opts)
	if err != nil {
		return err
	}

	if err := srv.Start(a.ctx); err != nil {
		return err
	}

	a.srv = srv

	// 設定を更新して保存
	a.cfg.LastFolder = path
	if err := a.cfg.Save(); err != nil {
		log.Printf("設定の保存に失敗しました: %v\n", err)
	}

	// フロントエンドにファイルツリーの変更を通知
	runtime.EventsEmit(a.ctx, "tree:changed")

	return nil
}

// shutdown は Wails フレームワークからシャットダウン時に呼ばれるコールバック
func (a *App) shutdown(ctx context.Context) {
	a.srvMu.Lock()
	defer a.srvMu.Unlock()

	if a.srv != nil {
		if err := a.srv.Shutdown(); err != nil {
			log.Printf("サービスのシャットダウンに失敗しました: %v\n", err)
		}
	}
}

// GetFiles はフロントエンドに公開する Wails バインディング
func (a *App) GetFiles() []server.FileEntry {
	a.srvMu.Lock()
	srv := a.srv
	a.srvMu.Unlock()

	if srv == nil {
		return []server.FileEntry{}
	}
	return srv.GetFiles()
}

// GetFileSource はフロントエンドに公開する Wails バインディング
func (a *App) GetFileSource(path string) (string, error) {
	a.srvMu.Lock()
	srv := a.srv
	a.srvMu.Unlock()

	if srv == nil {
		return "", fmt.Errorf("サービスが起動していません")
	}
	return srv.GetFileSource(path)
}

// SelectFolder は OS標準のフォルダ選択ダイアログを表示してパスを返す
func (a *App) SelectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "フォルダを開く",
		DefaultDirectory: a.cfg.LastFolder,
	})
}

// OpenFolder は指定されたフォルダを監視対象として開く
func (a *App) OpenFolder(path string) error {
	log.Printf("フォルダを開きます: %s\n", path)
	return a.openFolderInternal(path)
}

// GetLastFolder は前回開いたフォルダパスを返す
func (a *App) GetLastFolder() string {
	return a.cfg.LastFolder
}
