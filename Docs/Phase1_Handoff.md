# Phase 1 申し送り事項

> **作成日**: 2026-07-16  
> **対象**: 次回セッション（Phase 2 着手時）  
> **前提ドキュメント**: [Plans/implementation_plan_260715.md](../Plans/implementation_plan_260715.md) | [AGENTS.md](../.agents/AGENTS.md)

---

## 1. Phase 1 完了状態

### 検証結果（全 V1〜V7 合格）

| # | テスト項目 | 結果 |
|---|---|---|
| V1 | `wails dev` でビルド・起動 | ✅ |
| V2 | WebView でファイルツリーが表示される | ✅ |
| V3 | PlantUML レンダリングが動作する | ✅ |
| V4 | ライブリロードが動作する | ✅ |
| V5 | SSE 接続が維持される | ✅ |
| V6 | CLI 引数でフォルダ指定できる | ✅（`-appargs` で確認） |
| V7 | アプリ終了時にリソースが解放される | ✅ |

### 実装済みファイル（pumlv-gui 側）

```
main.go                          Wails エントリポイント
app.go                           App 構造体・startup/shutdown/GetAPIAddress
go.mod / go.sum                  依存関係（Wails v2 + fsnotify）
wails.json                       Wails 設定
.gitignore                       ビルド成果物・plantuml.js 等を除外
internal/server/server.go        HTTP サーバー（donegroup 除去・Addr() 追加）
internal/server/handlers.go      API ハンドラー（handleStatic 除去・CORS 追加）
internal/server/files.go         Registry（変更なし）
internal/server/hub.go           Hub（変更なし）
internal/server/watcher.go       Watcher（donegroup 除去）
frontend/                        pumlv/internal/frontend/ からコピー + 下記修正
  src/api/base-url.ts            ★新規：Wails バインディング経由の URL キャッシュ
  src/api/files.ts               getApiBaseUrl() を使用するよう変更
  src/api/events.ts              getApiBaseUrl() を使用するよう変更
  src/plantuml/bootstrap.ts      fetch() + Blob URL 方式に変更（Vite 8 対応）
  src/main.tsx                   initApiUrl() 呼び出しを追加
  vite.config.ts                 outDir を dist に変更・proxy 設定を除去
```

---

## 2. Phase 1 実装で判明した技術的知見

### 2-1. `wails dev` での引数渡し（Windows / PowerShell）

**問題**: PowerShell では `wails dev -- .\pumlv\examples` が機能しない
- `--` がシェルに消費されて `os.Args` に届かない

**正しい方法**:
```powershell
wails dev -appargs "D:/work/pumlv-gui/pumlv/examples"
```
- バックスラッシュはエスケープされて化ける（`.\pumlv\examples` → `.pumlvexamples`）
- **フォワードスラッシュの絶対パスを使うこと**

### 2-2. Vite 8 の `/public` ディレクトリ制約

**問題**: Vite 8 では `/public` 配下のファイルを `import()` で動的インポートできない

```typescript
// NG（Vite 8 でエラー）
import(/* @vite-ignore */ "/plantuml/plantuml.js")
```

**解決策**: `fetch()` でテキスト取得 → Blob URL 経由で `import()`  
→ `frontend/src/plantuml/bootstrap.ts` の `importFromPublic()` 関数を参照

この制約は dev/production 両方に影響するが、production build では
Wails の AssetServer が静的に配信するためエラーにならない点に注意。

### 2-3. `go build ./...` は `frontend/dist` が必要

`main.go` に `//go:embed all:frontend/dist` があるため、
`frontend/dist` が存在しない状態でビルドするとエラーになる。

```bash
# 先に frontend をビルドしてから Go をビルドする
cd frontend && npm run build
cd .. && go build ./...
# または wails dev で自動的に両方ビルドされる
```

### 2-4. API URL 初期化タイミング

`base-url.ts` の `initApiUrl()` は `main.tsx` の `bootstrap()` 関数で
アプリレンダリング **前** に await される。

```
main.tsx: bootstrap() → await initApiUrl() → createRoot(...)
```

Wails の `window.go.main.App.GetAPIAddress` は `OnStartup` 完了後に呼べる。
`startup()` で HTTP サーバーを起動した後に `GetAPIAddress()` が意味を持つ設計。
引数なし起動時（サーバー未起動）は空文字列を返し、フロントエンドが
`/api/files`（相対パス）として fetch → 失敗する（想定内動作）。

---

## 3. Phase 1 の既知の課題・制限

| 課題 | 重要度 | Phase 2 での対処 |
|---|---|---|
| 引数なしで起動するとファイル一覧が空 | 高 | OS ダイアログで選択（F2）|
| 前回フォルダが記憶されない | 高 | 設定ファイル実装（F3）|
| DnD 非対応 | 中 | F4 で実装 |
| メニューなし | 中 | F5 で実装 |
| HTTP サーバーが内蔵（CORS ヘッダー付き） | 低 | Phase 2A で Wails バインディングに移行し除去 |
| `wails dev -appargs` のパス制約 | 低 | ドキュメント化済み（開発時の制約） |

---

## 4. Phase 2 実装方針（設計書からの補足）

詳細は [Plans/implementation_plan_260715.md §5](../Plans/implementation_plan_260715.md) を参照。

### Phase 2A: Wails ネイティブ通信への移行（実施順序に依存関係あり）

1. **ステップ 2-1**: `GetFiles()`, `GetFileSource()` バインディングを `app.go` に追加
   - フロントエンドの `api/files.ts` を Wails JS バインディングに置き換え
2. **ステップ 2-2**: `watcher.go` で `hub.Broadcast` → `runtime.EventsEmit` に変更
   - フロントエンドの `api/events.ts` を `EventsOn` に置き換え
   - `use-server-events.ts` を Wails Events 対応に書き換え
3. **ステップ 2-3**: `handlers.go` と `hub.go` を削除、`server.go` を簡素化

### Phase 2B: GUI 機能拡張

4. **ステップ 2-4**: OS ダイアログ（`runtime.OpenDirectoryDialog`）+ `os.Args` 解析
5. **ステップ 2-5**: 設定ファイル（`~/.pumlv-gui/config.json`）で前回フォルダ記憶
6. **ステップ 2-6**: DnD（`options.DragAndDrop` + `runtime.OnFileDrop`）
7. **ステップ 2-7**: メニューバー（`menu.NewMenu()` で「ファイル → フォルダを開く」）

### Phase 2 着手前に確認すべきこと

- `wailsjs/` ディレクトリが自動生成されている（`wails dev` 実行後に生成される）
  - `frontend/wailsjs/go/main/App.ts` に `GetAPIAddress` バインディングが含まれているはず
- Phase 2A で HTTP サーバーを除去した後、`go.mod` の `net/http` 依存は自然に消える
  （ただし `fsnotify` は Watcher で引き続き使用）

---

## 5. 現在のプロジェクト状態

```
未コミットのファイル（新規追加）:
  main.go, app.go, go.mod, go.sum
  internal/server/*.go（5 ファイル）
  frontend/（大量ファイル）
  .gitignore
  .agents/AGENTS.md
  Docs/Phase1_Handoff.md（このファイル）
```

**次回セッション開始時の推奨手順**:
1. `/commit` でコミットを作成する
2. Phase 2 の着手ステップを決定する
3. `wails dev -appargs "D:/work/pumlv-gui/pumlv/examples"` で動作を再確認する
