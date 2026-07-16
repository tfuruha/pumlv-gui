package server

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// FileEntry は検出可能な PlantUML ファイルを表す
type FileEntry struct {
	Path   string `json:"path"`   // 絶対パス
	Rel    string `json:"rel"`    // ソースルートからの相対パス
	Name   string `json:"name"`   // ファイル名
	Source string `json:"source"` // 絶対ソースルートパス
}

// Registry は配信されるファイルのセットを保持し、Watcher からのリフレッシュを受け付ける
type Registry struct {
	mu      sync.RWMutex
	sources []sourceRoot // 解決済みの入力引数
	exts    map[string]struct{}
	files   map[string]FileEntry // key: 絶対パス
}

type sourceRoot struct {
	path  string // 絶対パス
	isDir bool
}

// NewRegistry はユーザー提供のパスを解決し、初期ファイルリストを構築する
func NewRegistry(inputs []string, exts []string) (*Registry, error) {
	extMap := make(map[string]struct{}, len(exts))
	for _, e := range exts {
		if e == "" {
			continue
		}
		if !strings.HasPrefix(e, ".") {
			e = "." + e
		}
		extMap[strings.ToLower(e)] = struct{}{}
	}

	r := &Registry{
		exts:  extMap,
		files: map[string]FileEntry{},
	}
	for _, in := range inputs {
		abs, err := filepath.Abs(in)
		if err != nil {
			return nil, err
		}
		info, err := os.Stat(abs)
		if err != nil {
			return nil, err
		}
		r.sources = append(r.sources, sourceRoot{path: abs, isDir: info.IsDir()})
	}
	if err := r.Refresh(); err != nil {
		return nil, err
	}
	return r, nil
}

// Refresh はすべてのソースルートを再スキャンしてファイルマップを再構築する
func (r *Registry) Refresh() error {
	next := map[string]FileEntry{}
	for _, s := range r.sources {
		if s.isDir {
			err := filepath.WalkDir(s.path, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return nil // 読み取れないエントリはスキップ
				}
				if d.IsDir() {
					return nil
				}
				if !r.matchExt(path) {
					return nil
				}
				rel, _ := filepath.Rel(s.path, path)
				next[path] = FileEntry{
					Path:   path,
					Rel:    rel,
					Name:   filepath.Base(path),
					Source: s.path,
				}
				return nil
			})
			if err != nil {
				return err
			}
		} else {
			if !r.matchExt(s.path) {
				continue
			}
			next[s.path] = FileEntry{
				Path:   s.path,
				Rel:    filepath.Base(s.path),
				Name:   filepath.Base(s.path),
				Source: filepath.Dir(s.path),
			}
		}
	}
	r.mu.Lock()
	r.files = next
	r.mu.Unlock()
	return nil
}

// List は現在のファイルエントリのソート済みスナップショットを返す
func (r *Registry) List() []FileEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]FileEntry, 0, len(r.files))
	for _, f := range r.files {
		out = append(out, f)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Source != out[j].Source {
			return out[i].Source < out[j].Source
		}
		return out[i].Rel < out[j].Rel
	})
	return out
}

// Allowed は絶対パスが配信対象かどうかを報告する
func (r *Registry) Allowed(path string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.files[path]
	return ok
}

func (r *Registry) matchExt(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	_, ok := r.exts[ext]
	return ok
}
