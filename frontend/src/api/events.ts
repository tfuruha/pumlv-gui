import { getApiBaseUrl } from "./base-url";

export type ServerEvent = { type: "changed"; path: string } | { type: "tree" } | { type: "hello" };

export type EventHandler = (ev: ServerEvent) => void;

/**
 * subscribe は SSE 接続を開き、イベントハンドラーを登録する。
 * API URL は initApiUrl()（base-url.ts）でキャッシュされた値を使用する。
 * クリーンアップ関数を返す。
 */
export function subscribe(onEvent: EventHandler): () => void {
  const source = new EventSource(`${getApiBaseUrl()}/api/events`);
  source.addEventListener("changed", (e) => {
    const data = JSON.parse((e as MessageEvent).data) as { path: string };
    onEvent({ type: "changed", path: data.path });
  });
  source.addEventListener("tree", () => {
    onEvent({ type: "tree" });
  });
  source.addEventListener("hello", () => {
    onEvent({ type: "hello" });
  });
  return () => source.close();
}
