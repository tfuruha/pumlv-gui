/**
 * Wails Events 経由でファイル変更通知を受け取る。
 * Phase 2A: SSE（EventSource）から Wails EventsOn/EventsOff へ移行済み。
 * Go 側の watcher.go が runtime.EventsEmit で "file:changed" / "tree:changed" を発行する。
 */
import { EventsOn } from "../../wailsjs/runtime/runtime";

export type ServerEvent = { type: "changed"; path: string } | { type: "tree" };

export type EventHandler = (ev: ServerEvent) => void;

/**
 * subscribe は Wails Events リスナーを登録し、クリーンアップ関数を返す。
 * useServerEvents フックから useEffect 内で呼ばれる。
 */
export function subscribe(onEvent: EventHandler): () => void {
  // "file:changed" イベント: Go 側から path が第一引数で渡される
  const offChanged = EventsOn("file:changed", (path: string) => {
    onEvent({ type: "changed", path });
  });

  // "tree:changed" イベント: ファイルツリー再取得が必要
  const offTree = EventsOn("tree:changed", () => {
    onEvent({ type: "tree" });
  });

  // クリーンアップ: Wails EventsOn の戻り値は登録解除関数
  return () => {
    offChanged();
    offTree();
  };
}
