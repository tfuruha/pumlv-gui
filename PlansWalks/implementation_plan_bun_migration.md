# 実装計画書: フロントエンド・パッケージマネージャーの Bun への移行

実施日： 2026-07-30

## 目的
フロントエンドのパッケージマネージャーおよびスクリプトランナーを `npm` / `pnpm` から **`bun`** へ全面的に移行し、インストールスピード・ビルド速度・開発環境の統一を図る。

---

## 現状分析と影響範囲

| 領域 | 現状 (npm / pnpm) | 変更後 (Bun) |
|---|---|---|
| **Wails 設定** (`wails.json`) | `"frontend:install": "npm install"`<br>`"frontend:build": "npm run build"`<br>`"frontend:dev:watcher": "npm run dev"` | `"frontend:install": "bun install"`<br>`"frontend:build": "bun run build"`<br>`"frontend:dev:watcher": "bun run dev"` |
| **package.json** | `"packageManager": "pnpm@11.17.0"` | `"packageManager": "bun@1.2.2"` (または `bun`) |
| **ロックファイル** | `frontend/package-lock.json` | `frontend/bun.lock` (生成後、package-lock.json は削除) |
| **プロジェクト文書** | `AGENTS.md` (ビルド手順で `npm run build` を記載) | `bun run build` に変更 |
| **依存管理スキル** | `.agents/skills/dep-version-management/SKILL.md` | Bun のロックファイル (`bun.lock`) 及びコマンド方針へ更新 |

---

## 提案される変更点

### 1. `wails.json` の更新
`frontend:install`, `frontend:build`, `frontend:dev:watcher` のコマンドを `npm` から `bun` へ更新。

```json
{
  "frontend:install": "bun install",
  "frontend:build": "bun run build",
  "frontend:dev:watcher": "bun run dev"
}
```

### 2. `frontend/package.json` の更新
- `"packageManager"` フィールドを `bun` 仕様に変更。

### 3. ロックファイルの差し替え
- `cd frontend && bun install` を実行して `frontend/bun.lock` を生成。
- 既存の `frontend/package-lock.json` を削除。

### 4. ドキュメントおよびスキルの更新
- `AGENTS.md`: ビルドコマンド等の `npm` 表記を `bun` に更新。
- `.agents/skills/dep-version-management/SKILL.md`: `pnpm-lock.yaml` / `package-lock.json` に関する記述を `bun.lock` へ改訂。

---

## 検証計画

1. **パッケージインストール・ロックファイル生成**
   ```powershell
   cd frontend
   bun install
   ```
   `frontend/bun.lock` が正しく生成され、エラーが出ないことを確認。

2. **スクリプト動作確認**
   ```powershell
   bun run vendor:plantuml
   bun run build
   bun test
   ```
   PlantUML パッチおよび Vite ビルド・Vitest が正常終了することを確認。

3. **Go / Wails 全体ビルド確認**
   ```powershell
   go build ./...
   ```
   Wails Dev または Build プロセスとの連携を確認。

---

## リスク評価と対策

- **Bun と Vite / React 19 / Vitest の互換性**:
  - Vite および Node.js 組み込みモジュール (`node:fs` 等) を使用する `vendor-plantuml-core.mjs` は Bun でも完全上位互換で動作。
- **ロックファイルの二重管理防止**:
  - `package-lock.json` を確実に削除し、`.gitignore` で誤って混入しないか確認。
