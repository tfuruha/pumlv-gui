package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// Options はサーバーの設定
type Options struct {
	Paths []string
	Host  string
	Port  int
	Exts  []string
}

// Server は pumlv 内蔵 HTTP サービス
type Server struct {
	opts     Options
	registry *Registry
	watcher  *Watcher
	hub      *Hub
	httpd    *http.Server
	addr     string // 解決済みのリスニングアドレス（例: "127.0.0.1:12345"）
}

// New はサーバーを構築する（まだリスニングしない）
func New(ctx context.Context, opts Options) (*Server, error) {
	if opts.Host == "" {
		opts.Host = "127.0.0.1"
	}
	reg, err := NewRegistry(opts.Paths, opts.Exts)
	if err != nil {
		return nil, err
	}
	hub := NewHub()
	w, err := NewWatcher(reg, hub)
	if err != nil {
		return nil, err
	}
	s := &Server{opts: opts, registry: reg, watcher: w, hub: hub}
	mux := http.NewServeMux()
	s.registerRoutes(mux)
	s.httpd = &http.Server{
		Handler:           corsMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	return s, nil
}

// Start はリスナーをバインドし、HTTP サーバーとウォッチャーを起動する（donegroup なし）
// 解決済みのリスニングアドレス文字列（例: "127.0.0.1:PORT"）を返す
func (s *Server) Start(ctx context.Context) (string, error) {
	addr := fmt.Sprintf("%s:%d", s.opts.Host, s.opts.Port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return "", err
	}
	s.addr = ln.Addr().String()

	if err := s.watcher.Start(ctx); err != nil {
		_ = ln.Close()
		return "", err
	}

	go func() {
		if err := s.httpd.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			// ErrServerClosed は正常なシャットダウン。それ以外はログ出力
		}
	}()

	return s.addr, nil
}

// Addr は起動後のリスニングアドレスを返す（例: "127.0.0.1:PORT"）
func (s *Server) Addr() string {
	return s.addr
}

// Shutdown はグレースフルシャットダウンを行う
func (s *Server) Shutdown() error {
	s.hub.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.httpd.Shutdown(ctx); err != nil {
		return err
	}
	return s.watcher.Close()
}
