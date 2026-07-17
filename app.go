package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"pumlv-gui/internal/server"
)

// App はアプリケーションのメイン構造体
type App struct {
	ctx context.Context
	srv *server.Server
}

// NewApp はアプリインスタンスを生成する
func NewApp() *App {
	return &App{}
}

// startup は Wails フレームワークから起動時に呼ばれるコールバック
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// CLI 引数からパスを取得
	paths := os.Args[1:]
	if len(paths) == 0 {
		// Phase 2B で OS ダイアログに変更予定（現状は空のまま）
		log.Println("起動引数なし: フォルダ未指定で起動します")
		return
	}

	// Service を起動（ファイル監視 + Wails Events 通知）
	opts := server.Options{
		Paths: paths,
		Exts:  []string{".puml", ".plantuml", ".iuml", ".wsd"},
	}

	srv, err := server.New(ctx, opts)
	if err != nil {
		log.Printf("サービスの初期化に失敗しました: %v\n", err)
		return
	}

	if err := srv.Start(ctx); err != nil {
		log.Printf("サービスの起動に失敗しました: %v\n", err)
		return
	}

	a.srv = srv
	log.Println("ファイル監視サービスを起動しました")
}

// shutdown は Wails フレームワークからシャットダウン時に呼ばれるコールバック
func (a *App) shutdown(ctx context.Context) {
	if a.srv != nil {
		if err := a.srv.Shutdown(); err != nil {
			log.Printf("サービスのシャットダウンに失敗しました: %v\n", err)
		}
	}
}

// GetFiles はフロントエンドに公開する Wails バインディング。
// 監視中のファイルエントリ一覧を返す。
func (a *App) GetFiles() []server.FileEntry {
	if a.srv == nil {
		return []server.FileEntry{}
	}
	return a.srv.GetFiles()
}

// GetFileSource はフロントエンドに公開する Wails バインディング。
// 指定パスのファイル内容を文字列で返す。
func (a *App) GetFileSource(path string) (string, error) {
	if a.srv == nil {
		return "", fmt.Errorf("サービスが起動していません")
	}
	return a.srv.GetFileSource(path)
}
