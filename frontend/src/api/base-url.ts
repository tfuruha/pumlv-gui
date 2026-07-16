/**
 * Wails 環境での API ベース URL を管理するモジュール。
 * initApiUrl() を起動時に一度だけ呼ぶことで URL をキャッシュする。
 * テスト環境では window.go が存在しないため空文字列（相対パス）のまま。
 */

let _apiBaseUrl = "";

/**
 * initApiUrl は Wails 起動後に一度だけ呼ぶ。
 * GetAPIAddress() Wails バインディングから API サーバーの URL を取得してキャッシュする。
 */
export async function initApiUrl(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).go?.main?.App?.GetAPIAddress) {
    _apiBaseUrl = await (window as any).go.main.App.GetAPIAddress();
  }
}

/**
 * getApiBaseUrl は現在キャッシュされている API ベース URL を返す。
 * initApiUrl() を呼ぶ前は空文字列（相対パス）を返す。
 */
export function getApiBaseUrl(): string {
  return _apiBaseUrl;
}
