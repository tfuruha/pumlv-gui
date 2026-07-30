---
name: dep-version-management
description: |
  フロントエンド (Bun) および Go モジュールの依存バージョン管理方針を提供するスキル。
  ロックファイルの扱い、バージョン表記の使い分け、定期更新フロー、不要ファイルの検出を支援する。
---

# 依存バージョン管理スキル

## 1. 基本方針

### ロックファイル（最優先）

| ファイル | パッケージマネージャ | Git 管理 |
|---|---|---|
| `frontend/bun.lock` | Bun | **必須** (コミット対象) |
| `go.sum` | Go modules | **必須** (コミット対象) |

- ロックファイルが存在すれば `^` 表記でも自動的にバージョンが上がることはない
- CI・他メンバー・リリースビルドで **再現性** を保証する唯一の手段

> [!IMPORTANT]
> ロックファイルを `.gitignore` に追加してはならない。

---

## 2. `package.json` バージョン表記の使い分け

| 表記 | 例 | 自動更新範囲 | 適用対象 |
|---|---|---|---|
| **完全固定** | `"1.61.1"` | なし（固定） | E2Eテスト基盤・CLIツール・Storybook など破壊的変更が起きやすいもの |
| **チルダ** | `"~19.2.7"` | パッチのみ | バグ修正のみ取り込みたいコアライブラリ |
| **キャレット** | `"^19.2.7"` | マイナーまで | SemVer を守っている一般的なライブラリ（React, Vite 等） |

### このプロジェクトでの判断基準

**完全固定が推奨される依存**

```
@playwright/test  playwright  storybook  @storybook/*
```

これらはメジャー・マイナーを問わず API 破壊が起きやすく、
テストや UI カタログ全体に影響するためピン留めする。

**キャレット指定で良い依存**

```
react  react-dom  vite  tailwindcss  typescript  vitest  shiki
react-zoom-pan-pinch  @vitejs/plugin-react
```

SemVer が守られており、定期更新フローで安全にアップデートできる。

---

## 3. 定期更新フロー

### 前提：Bun の確認

`bun` が未インストールの場合、[bun.sh](https://bun.sh) に従ってインストールする。

```powershell
# Windows (PowerShell) でのインストール例
powershell -c "irm bun.sh/install.ps1 | iex"

# バージョン確認
bun --version
```

---

### フロントエンド (Bun)

```bash
# パッケージの更新（ロックファイルも更新される）
bun update

# 更新後は必ずビルドとテストを実行
cd frontend && bun run build && bun test
```

### Go モジュール

```bash
# パッチ・マイナーのみ更新
go get -u ./...

# go.sum を整理
go mod tidy

# ビルド確認
go build ./...
```

### 推奨頻度

| 種別 | 頻度 |
|---|---|
| セキュリティパッチ | 検知次第即時 |
| devDependencies 全体 | 月 1 回程度 |
| メジャーバージョンアップ | 機能開発の合間に個別判断 |

---

## 4. 不要なロックファイル検出

Go プロジェクトのルートに誤って `package-lock.json` や `pnpm-lock.yaml`, `bun.lock` が生成されることがある。
これはルートで `bun install` / `npm install` を誤実行した場合に発生する。

### 検出コマンド

```powershell
# ルート直下に不正なロックファイルがないか確認
Get-ChildItem -Path . -Depth 0 -Filter "*lock*" | Select-Object Name, Length
```

### 判断基準

- `frontend/bun.lock` → 正常（Git 管理対象）
- ルート直下の `package-lock.json` / `pnpm-lock.yaml` / `bun.lock` → **削除対象**
  - ルート直下のものは不要

### 削除手順

```powershell
# 内容確認後に削除
Remove-Item .\package-lock.json -ErrorAction SilentlyContinue
Remove-Item .\pnpm-lock.yaml -ErrorAction SilentlyContinue
Remove-Item .\bun.lock -ErrorAction SilentlyContinue
``````

---

## 5. Go `go.mod` のバージョン管理方針

- `require` ブロックは `go mod tidy` で自動整理する
- 直接依存は `go get github.com/xxx/yyy@v1.2.3` で明示的に追加
- 間接依存（`// indirect`）は `go mod tidy` に任せる
- `replace` ディレクティブの使用はローカルデバッグ時のみ、コミット前に必ず除去する

---

## Triggers（このスキルを適用するタイミング）

- `package.json` または `go.mod` を新規作成・編集する前
- 依存ライブラリのバージョン変更を提案するとき
- ルートディレクトリにロックファイルが存在するかを確認するとき
- `npm install` / `pnpm install` / `go get` コマンドを実行する前
