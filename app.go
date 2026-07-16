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
		// Phase 1 ではデフォルトで空のまま（ファイル一覧なし状態）
		log.Println("起動引数なし: フォルダ未指定で起動します")
		return
	}

	// 内部 HTTP サーバーを起動（API + SSE のみ、SPA 配信なし）
	opts := server.Options{
		Paths: paths,
		Host:  "127.0.0.1",
		Port:  0, // 空きポートを自動選択
		Exts:  []string{".puml", ".plantuml", ".iuml", ".wsd"},
	}

	srv, err := server.New(ctx, opts)
	if err != nil {
		log.Printf("サーバーの初期化に失敗しました: %v\n", err)
		return
	}

	addr, err := srv.Start(ctx)
	if err != nil {
		log.Printf("サーバーの起動に失敗しました: %v\n", err)
		return
	}

	a.srv = srv
	log.Printf("内蔵 HTTP サーバーを起動しました: %s\n", addr)
}

// shutdown は Wails フレームワークからシャットダウン時に呼ばれるコールバック
func (a *App) shutdown(ctx context.Context) {
	if a.srv != nil {
		if err := a.srv.Shutdown(); err != nil {
			log.Printf("サーバーのシャットダウンに失敗しました: %v\n", err)
		}
	}
}

// GetAPIAddress はフロントエンドが API サーバーの URL を取得するために呼ぶ Wails バインディングメソッド
func (a *App) GetAPIAddress() string {
	if a.srv == nil {
		return ""
	}
	return fmt.Sprintf("http://%s", a.srv.Addr())
}
