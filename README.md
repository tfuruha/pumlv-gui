# pumlv-gui

PlantUML ファイルをリアルタイムプレビューするデスクトップアプリ。  
CLI ツール [pumlv](https://github.com/rin2yh/pumlv) を [Wails v2](https://wails.io/) によりデスクトップ GUI アプリとして再構築したものです。

---

## 主な特徴

- **リアルタイムプレビュー** — `.puml` / `.plantuml` / `.iuml` / `.wsd` ファイルの保存を検知し、即座に SVG プレビューを更新
- **ネイティブ通信** — Wails Go バインディング + Events を使用。内蔵 HTTP サーバーなし
- **フォルダ指定の多彩な手段**
  - 起動引数（`pumlv-gui.exe <フォルダ>` または `pumlv-gui.exe`）
  - OS 標準フォルダ選択ダイアログ（引数なし起動時に自動表示）
  - メニューバー「ファイル → フォルダを開く...」（`Ctrl+O`）
  - ウィンドウへのドラッグ＆ドロップ
- **前回フォルダを自動復元** — `~/.pumlv-gui/config.json` に最後に開いたフォルダを記憶
- **単一バイナリ配布** — フロントエンドを `go:embed` で内蔵

---

## セットアップ

### 前提条件

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Go | 1.23 以上 | |
| Node.js | 20 以上 | |
| Wails CLI | v2.12 以上 | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| npm | — | `wails.json` 内で `npm` を使用（pnpm も可）|

---

## 開発

```bash
# 開発サーバー起動（フォルダ指定あり）
wails dev -appargs "D:/path/to/your/plantuml/folder"

# フォルダ未指定で起動 → OS ダイアログが自動表示される
wails dev
```

> **Windows / PowerShell の注意点**  
> `wails dev -- .\folder` はパスが化けるため、必ず `-appargs` を使用してください。  
> バックスラッシュもエスケープされる場合があるため、フォワードスラッシュの絶対パスを推奨します。

---

## ビルド

```bash
# 本番バイナリをビルド（build/bin/ に出力）
wails build

# フロントエンドのみビルド
cd frontend && npm run build

# Go コードのビルド確認
go build ./...
```

---

## 使い方

### フォルダ指定

```bash
# 方法 1: 引数で指定
pumlv-gui.exe C:\Users\you\diagrams

# 方法 2: 引数なしで起動 → OS ダイアログが自動表示
pumlv-gui.exe
```

- メニュー「ファイル → フォルダを開く...」または `Ctrl+O` でいつでも変更可能
- フォルダをウィンドウにドラッグ＆ドロップしても切り替えられます

### サポートする拡張子

`.puml` / `.plantuml` / `.iuml` / `.wsd`

---

## プロジェクト構成

```
pumlv-gui/
├── main.go                  # Wails エントリポイント（メニュー・DnD設定）
├── app.go                   # App 構造体（起動・終了・バインディング定義）
├── go.mod / go.sum
├── wails.json               # Wails プロジェクト設定
│
├── internal/
│   ├── server/              # ファイル監視サービス
│   │   ├── server.go        # Service 構造体（GetFiles / GetFileSource）
│   │   ├── files.go         # Registry — ファイル管理・セキュリティチェック
│   │   └── watcher.go       # Watcher — fsnotify + Wails EventsEmit
│   └── config/
│       └── config.go        # 設定ファイル（~/.pumlv-gui/config.json）の読み書き
│
├── frontend/                # React + Vite + TypeScript SPA
│   └── src/
│       ├── api/
│       │   ├── files.ts     # GetFiles / GetFileSource バインディングラッパー
│       │   └── events.ts    # Wails EventsOn ラッパー
│       ├── hooks/
│       │   ├── use-file-list.ts
│       │   ├── use-active-render.ts
│       │   └── use-server-events.ts
│       └── components/
│
├── examples/                # サンプル PlantUML ファイル
├── Docs/                    # 設計ドキュメント
│   └── design_document.md
└── Plans/                   # 実装計画書
```

---

## アーキテクチャ

Go バックエンドとフロントエンドは HTTP を介さず、Wails ネイティブ IPC で通信します。

```
ユーザー操作
    │
    ▼
[フロントエンド: React + Vite]
    ├── GetFiles()        ─ Wails Go バインディング ──▶ Registry.List()
    ├── GetFileSource()   ─ Wails Go バインディング ──▶ os.ReadFile()
    └── EventsOn(...)     ─ Wails Events ◀─────────── Watcher → EventsEmit()
                                                              ▲
                                                       fsnotify（ファイル監視）
```

詳細は [`Docs/design_document.md`](Docs/design_document.md) を参照してください。

---

## ライセンス

MIT
