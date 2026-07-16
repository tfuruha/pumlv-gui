package server

import "sync"

// Event は SSE でブロードキャストされるイベントの単位
type Event struct {
	Name string
	Data any
}

// Hub は SSE の全サブスクライバーへイベントをファンアウトする
type Hub struct {
	mu      sync.Mutex
	clients map[chan Event]struct{}
	closed  bool
}

// NewHub は空の Hub を生成する
func NewHub() *Hub {
	return &Hub{clients: map[chan Event]struct{}{}}
}

// Subscribe は新しいサブスクライバーを追加し、そのチャンネルを返す
func (h *Hub) Subscribe() chan Event {
	ch := make(chan Event, 16)
	h.mu.Lock()
	if !h.closed {
		h.clients[ch] = struct{}{}
	} else {
		close(ch)
	}
	h.mu.Unlock()
	return ch
}

// Unsubscribe はサブスクライバーを削除し、チャンネルを閉じる
func (h *Hub) Unsubscribe(ch chan Event) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// Broadcast はすべてのサブスクライバーにイベントを配信する（ブロッキングなし）
func (h *Hub) Broadcast(ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- ev:
		default:
			// バッファが満杯の場合はドロップ
		}
	}
}

// Close は全サブスクライバーを終了する。以降の Subscribe は閉じたチャンネルを返す
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return
	}
	h.closed = true
	for ch := range h.clients {
		close(ch)
	}
	h.clients = map[chan Event]struct{}{}
}
