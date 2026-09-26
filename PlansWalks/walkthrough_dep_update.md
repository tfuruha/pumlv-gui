# 依存ライブラリ アップデート実施記録 (Walkthrough)

2026-09-26 実施

## 実施概要
Go モジュールおよびフロントエンド（Bun / npm）の依存関係の更新状況を確認し、最新安定版へのアップデートと動作・ビルド・テスト検証を実施しました。

---

## 実施内容

### 1. Go モジュールの更新
- **Wails**: `v2.15.0` → **`v2.16.0`**
- **間接依存**: `golang.org/x/crypto`, `golang.org/x/net`, `golang.org/x/sys`, `golang.org/x/text` 等を更新
- `go mod tidy` を実行し、`go build ./...` でコンパイルが正常に通ることを確認。

### 2. フロントエンドパッケージの更新
`dep-version-management` スキルの規約に基づき、以下をアップデートしました：

| パッケージ | 変更前 | 変更後 | 種別 |
|---|---|---|---|
| `react` / `react-dom` | `^19.2.8` | **`^19.3.0`** | マイナー |
| `react-zoom-pan-pinch` | `^4.0.4` | **`^4.2.0`** | マイナー |
| `vite` | `^8.2.2` | **`^8.3.1`** | マイナー |
| `@plantuml/core` | `1.2026.7` | **`1.2026.8`** | パッチ (固定) |
| `@playwright/test` / `playwright` | `1.62.1` | **`1.63.0`** | マイナー (固定) |
| `storybook` / `@storybook/*` | `10.5.10` | **`10.6.0`** | マイナー (固定) |
| `vitest` / `@vitest/*` | `^4.1.11` | **`^5.0.2`** | メジャー (v5) |
| `@types/*`, `jsdom`, `oxlint`, `oxfmt` 等 | 各種旧版 | **最新版** | マイナー / パッチ |

### 3. PlantUML 1.2026.8 へのパッチ追従 & オプション対応
- `@plantuml/core@1.2026.8` では upstream の Java/TeaVM 出力構造が更新され、デフォルト上限値が `8192px` へ変更されたほか、`renderToString` に `options.maxSvgSize` が導入されました。
- これに対応して [frontend/scripts/vendor-plantuml-core.mjs](file:///d:/work/pumlv-gui/frontend/scripts/vendor-plantuml-core.mjs) のパッチロジックを更新し、`AQx=8192;` (3箇所) および `c<0)c=8192;` (1箇所) を `65536` に確実に引き上げるよう修正しました。
- また、[frontend/src/plantuml/bootstrap.ts](file:///d:/work/pumlv-gui/frontend/src/plantuml/bootstrap.ts) と [frontend/src/plantuml/renderer.ts](file:///d:/work/pumlv-gui/frontend/src/plantuml/renderer.ts) においても型定義を拡張し、`mod.renderToString(..., { maxSvgSize: 65536 })` を明示指定する二重の安全策を施しました。

---

## 検証結果

- **リント & フォーマット**:
  - `bun run fmt:check`: 正常パス (0 件のエラー)
  - `bun run lint`: 正常パス (0 件のエラー)
- **フロントエンドビルド**:
  - `bun run build` (`vendor:plantuml` + `tsc --noEmit` + `vite build`): **正常完了 (6.65s)**
- **テストスイート**:
  - `bun run test:unit`: **20 ファイル 150 テスト 全件パス**
  - `bun run test:integration`: **8 ファイル 30 テスト 全件パス** (Chromium ブラウザ統合テスト)
  - 全体合計: **28 ファイル 180 テスト 全件パス**
- **Storybook ビルド**:
  - `bun run build-storybook`: **正常完了 (4.91s)**
- **Go アプリケーションビルド**:
  - `go build ./...`: **正常完了 (Exit Code 0)**
