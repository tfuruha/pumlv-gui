# pumlv-gui — AGENTS.md

## プロジェクト概要

[pumlv](https://github.com/rin2yh/pumlv)（CLI ベースの PlantUML ローカルプレビューサーバー）を
[Wails v2](https://wails.io/) プラットフォームでデスクトップ GUI アプリケーションとして再構築したもの。

PlantUML ファイルを監視し、WebView2 上でリアルタイムプレビューを行う。

---

## ビルドコマンド

```bash
# 開発モード（ホットリロード）
wails dev -appargs "<フォルダパス>"
# 例: wails dev -appargs "D:/work/pumlv-gui/pumlv/examples"

# 本番バイナリビルド
wails build

# フロントエンドのみビルド
cd frontend && npm run build

# Go コードのビルド確認
go build ./...
```

> **Note**: `wails dev -- path` は PowerShell でバックスラッシュが化けるため、
> `-appargs` を使用すること。パスはフォワードスラッシュまたは絶対パスを推奨。

---

## ディレクトリ構造

```
pumlv-gui/
├── main.go                    # Wails エントリポイント
├── app.go                     # App 構造体（startup/shutdown/GetAPIAddress）
├── go.mod / go.sum            # Go モジュール定義
├── wails.json                 # Wails 設定
├── .gitignore
│
├── internal/
│   └── server/                # 内蔵 HTTP サーバー（pumlv から移植）
│       ├── server.go          # Server 構造体（donegroup 除去済み）
│       ├── handlers.go        # API ハンドラー（/api/files, /api/file, /api/events）
│       ├── files.go           # Registry — ファイル管理
│       ├── hub.go             # Hub — SSE ブロードキャスト
│       └── watcher.go         # Watcher — fsnotify ファイル監視
│
├── frontend/                  # React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── api/
│   │   │   ├── base-url.ts    # API URL キャッシュ（Wails バインディング経由）
│   │   │   ├── files.ts       # /api/files, /api/file クライアント
│   │   │   └── events.ts      # SSE クライアント
│   │   ├── hooks/
│   │   │   ├── use-file-list.ts
│   │   │   ├── use-active-render.ts
│   │   │   └── use-server-events.ts
│   │   ├── plantuml/
│   │   │   ├── bootstrap.ts   # plantuml.js ローダー（Vite 8 対応）
│   │   │   └── renderer.ts
│   │   └── components/
│   └── public/
│       └── plantuml/          # ビルド時にダウンロード（.gitignore 対象）
│           ├── plantuml.js
│           └── viz-global.js
│
├── build/                     # Wails ビルド設定（アイコン等）
├── pumlv/                     # 参照用：オリジナル pumlv リポジトリ
├── Docs/                      # 要件定義・基本設計書などの恒久ドキュメント
└── PlansWalks/                # 実装計画書や作業ログなどの過渡ドキュメント
```

---

## pumlv オリジナルとの差分

| 層 | pumlv オリジナル | pumlv-gui |
|---|---|---|
| エントリポイント | Cobra CLI | `os.Args` + `wails.Run()` |
| バックエンド通信 | `net/http` REST + SSE | 内蔵 HTTP + Wails バインディング |
| フロントエンド API | `fetch()` + `EventSource`（相対パス） | `fetch()` + `EventSource`（`initApiUrl()` で動的 URL 取得） |
| ファイル監視 | `fsnotify` + `donegroup` | `fsnotify` + 標準 `goroutine/context` |
| SPA 配信 | `go:embed` + `handleStatic()` | Wails AssetServer |
| plantuml.js ロード | `import()` 直接 | `fetch()` + Blob URL（Vite 8 対応） |

---

## フェーズ構成

- **Phase 1 (完了)**: pumlv の内部 HTTP サーバーをそのまま内蔵し、Wails WebView からアクセス
- **Phase 2 (予定)**: HTTP サーバーを Wails バインディング + Events に置き換え、GUI 機能（DnD、メニュー、設定記憶）を実装

詳細は [PlansWalks/implementation_plan_260715.md](PlansWalks/implementation_plan_260715.md) を参照。

---

## コーディング規約

### Go

- パッケージ名はディレクトリ名に合わせる（`package server`）
- エラーハンドリングは `log.Printf()` でログ出力し、`return` で早期リターン
- `donegroup` は使用しない（標準 `context.Context` + goroutine で管理）
- `Server.Shutdown()` は必ずグレースフルシャットダウンを実装

### TypeScript / React

- API URL は `frontend/src/api/base-url.ts` の `initApiUrl()` で一元管理
- `/public` ディレクトリのファイルは `import()` ではなく `fetch()` + Blob URL で読み込む（Vite 8 制約）
- テストは Vitest（ユニット）+ Playwright（E2E）
- スタイルは Tailwind CSS v4

---

## 既知の制約・注意事項

1. **`wails dev -appargs` のパス**: バックスラッシュがエスケープされるため、フォワードスラッシュ（`/`）または絶対パスを使用すること
2. **Phase 1 の HTTP サーバー**: CORS ヘッダー (`Access-Control-Allow-Origin: *`) を付与しているが、`127.0.0.1` のみにバインドしているので安全
3. **plantuml.js の容量**: 約 4MB。ビルド時に `fetch-plantuml-core.mjs` で自動ダウンロードされる

---

## 主要ライブラリ・外部リンク

開発およびレンダリングで参照される主要なプロジェクト・ライブラリのリンク集です。

* **公式サイト**
  * **[PlantUML 公式サイト](https://plantuml.com/ja/)**
* **コア技術**
  * **[Wails v2](https://wails.io/)** — デスクトップアプリ構築フレームワーク
  * **[React 19](https://react.dev/)** / **[Tailwind CSS v4](https://tailwindcss.com/)** — UI構築・スタイリング
* **依存ライブラリ**
  * **[fsnotify/fsnotify](https://github.com/fsnotify/fsnotify)** — ファイルシステム監視 (Go)
  * **[shikijs/shiki](https://shiki.style/)** — コードシンタックスハイライト (JS/TS)
  * **[react-zoom-pan-pinch](https://github.com/prc5/react-zoom-pan-pinch)** — プレビュー操作 (React)
  * **[plantuml.js](https://github.com/plantuml/plantuml.js)** / **[viz.js](https://github.com/mdaines/viz.js)** — クライアントサイド PlantUML レンダラー

