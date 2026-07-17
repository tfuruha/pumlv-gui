package server

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// Options はサービスの設定
type Options struct {
	Paths []string
	Exts  []string
}

// Server はファイル監視と Wails バインディング向けデータアクセスを提供するサービス
type Server struct {
	opts     Options
	registry *Registry
	watcher  *Watcher
}

// New はサービスを構築する（まだ監視しない）
func New(ctx context.Context, opts Options) (*Server, error) {
	reg, err := NewRegistry(opts.Paths, opts.Exts)
	if err != nil {
		return nil, err
	}
	w, err := NewWatcher(ctx, reg)
	if err != nil {
		return nil, err
	}
	return &Server{opts: opts, registry: reg, watcher: w}, nil
}

// Start はファイル監視ループを goroutine で起動する
func (s *Server) Start(ctx context.Context) error {
	return s.watcher.Start(ctx)
}

// Shutdown はグレースフルシャットダウンを行う
func (s *Server) Shutdown() error {
	return s.watcher.Close()
}

// GetFiles は現在の監視ファイルエントリ一覧を返す（Wails バインディング経由で呼ばれる）
func (s *Server) GetFiles() []FileEntry {
	return s.registry.List()
}

// GetFileSource は指定パスのファイル内容を返す（Wails バインディング経由で呼ばれる）
func (s *Server) GetFileSource(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	if !s.registry.Allowed(abs) {
		return "", fmt.Errorf("file not allowed: %s", path)
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
