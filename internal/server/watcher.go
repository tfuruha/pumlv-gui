package server

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const debounceInterval = 100 * time.Millisecond

// Watcher は登録されたソースを監視し、Hub を通じてイベントを発行する
type Watcher struct {
	registry *Registry
	hub      *Hub
	fsw      *fsnotify.Watcher

	mu      sync.Mutex
	pending map[string]*time.Timer
}

// NewWatcher は Watcher を生成し、すべてのソースルートを fsnotify ウォッチャーに登録する
func NewWatcher(reg *Registry, hub *Hub) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{
		registry: reg,
		hub:      hub,
		fsw:      fsw,
		pending:  map[string]*time.Timer{},
	}
	for _, s := range reg.sources {
		if err := w.addSource(s); err != nil {
			_ = fsw.Close()
			return nil, err
		}
	}
	return w, nil
}

func (w *Watcher) addSource(s sourceRoot) error {
	if s.isDir {
		return filepath.WalkDir(s.path, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				return w.fsw.Add(path)
			}
			return nil
		})
	}
	return w.fsw.Add(filepath.Dir(s.path))
}

// Start はウォッチループを goroutine で起動する（donegroup なし）
func (w *Watcher) Start(ctx context.Context) error {
	go func() {
		w.loop(ctx)
	}()
	return nil
}

func (w *Watcher) loop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			w.handleEvent(event)
		case _, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	// 監視下の新しいディレクトリ: 深い変更も報告されるよう登録する
	if event.Op&fsnotify.Create != 0 {
		if fi, err := os.Stat(event.Name); err == nil && fi.IsDir() {
			_ = w.fsw.Add(event.Name)
		}
	}

	if event.Op&(fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
		if err := w.registry.Refresh(); err == nil {
			w.hub.Broadcast(Event{Name: "tree", Data: map[string]any{}})
		}
	}

	if w.registry.matchExt(event.Name) && event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) != 0 {
		w.debounce(event.Name)
	}
}

func (w *Watcher) debounce(path string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if t, ok := w.pending[path]; ok {
		t.Stop()
	}
	w.pending[path] = time.AfterFunc(debounceInterval, func() {
		w.mu.Lock()
		delete(w.pending, path)
		w.mu.Unlock()
		if w.registry.Allowed(path) {
			w.hub.Broadcast(Event{Name: "changed", Data: map[string]string{"path": path}})
		}
	})
}

// Close は fsnotify ウォッチャーを終了する
func (w *Watcher) Close() error {
	w.mu.Lock()
	for _, t := range w.pending {
		t.Stop()
	}
	w.pending = map[string]*time.Timer{}
	w.mu.Unlock()
	return w.fsw.Close()
}
