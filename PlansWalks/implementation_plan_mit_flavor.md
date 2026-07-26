# 実装計画：plantuml.js を MIT flavor (@plantuml/core) に切り替え

> 作成日：2026-07-26  
> 参照 PR：[rin2yh/pumlv#130](https://github.com/rin2yh/pumlv/pull/130)  
> 参照 Issue：[plantuml/plantuml#2741](https://github.com/plantuml/plantuml/issues/2741)

---

## 1. 目的

現在の `fetch-plantuml-core.mjs` は、`plantuml/plantuml` の GitHub Releases にある
`js-plantuml-{version}.zip` を HTTP ダウンロードして PlantUML の TeaVM ビルドを取得している。
このアーカイブは **GPL-3.0-or-later** ライセンスのフレーバーで生成されたものである。

PlantUML v1.2026.6 より、npm パッケージ `@plantuml/core@1.2026.6` が公式に公開され、
こちらは同じ TeaVM ビルドを **MIT** ライセンスで提供している。

本実装計画は、pumlv-gui の取得元を GPL フレーバーのアーカイブから
**MIT フレーバーの npm パッケージ**に切り替えることを目的とする。

### 主なメリット
| 項目 | 現行（ZIP ダウンロード） | 変更後（npm パッケージ） |
|------|------------------------|------------------------|
| ライセンス | GPL-3.0-or-later | **MIT** |
| 取得方法 | GitHub Releases から HTTP fetch | `pnpm install` で解決 |
| ネットワーク依存 | ビルド時に外部 fetch が必要 | node_modules から `cp` するだけ |
| CI での GITHUB_TOKEN 不要 | 必要（rate limit 回避） | **不要** |
| fflate 依存 | ZIP 解凍に必要（devDep） | **不要（削除可）** |

---

## 2. 現状分析

### 2-1. 取得スクリプト（`frontend/scripts/fetch-plantuml-core.mjs`）

- `https://github.com/plantuml/plantuml/releases/download/v1.2026.6/js-plantuml-1.2026.6.zip` を fetch
- `fflate` でメモリ上で展開し、`plantuml.js` と `viz-global.js` を `public/plantuml/` に書き出す
- その後、`plantuml.js` 内の `4096.0` を `65536.0` にパッチ

### 2-2. npm パッケージ `@plantuml/core@1.2026.6`

```
@plantuml/core@1.2026.6 の構成（npm registry より）:
  - plantuml.js     ← ES module エクスポート（render, renderToString）
  - viz-global.js   ← グローバルスクリプト（sideEffects: true）
  - emoji.js
  - openiconic.js
  - package.json
  license: "MIT"    ← v1.2026.6 より MIT に変更
```

> **重要**: v1.2026.5 以前は GPL-3.0-or-later。v1.2026.6 から MIT。

### 2-3. パッチの必要性

アップストリームの TeaVM ビルドには 4096px のダイアグラムサイズ制限が hard-code されている。
MIT フレーバー版（npm）でも同様の制限が存在する（同一 Java ソースから生成）。
よってパッチ処理は引き続き必要。

PR #130 の `vendor-plantuml-core.mjs` では、パッチの検証が強化されており：
- `4096.0` の出現回数が **厳密に 2 回**であることを確認してから置換（誤 patch 防止）
- 旧スクリプトは「存在しなければスキップ、存在すれば置換」という緩い検証だった

---

## 3. 提案される変更

### 3-1. 変更対象ファイル一覧

| 変更種別 | ファイルパス |
|---------|-------------|
| **削除** | `frontend/scripts/fetch-plantuml-core.mjs` |
| **新規作成** | `frontend/scripts/vendor-plantuml-core.mjs` |
| **変更** | `frontend/package.json` |

---

### 3-2. `frontend/scripts/fetch-plantuml-core.mjs` → 削除

旧スクリプトを完全に削除する。

---

### 3-3. `frontend/scripts/vendor-plantuml-core.mjs`（新規作成）

PR #130 のスクリプトを参考に、pumlv-gui 用に移植する。
`credits/vendored.txt` 整合性チェック（PR #130 固有機能）は省略する。

```mjs
// @plantuml/core (MIT) パッケージから plantuml.js と viz-global.js を
// public/plantuml/ にコピーし、4096px ダイアグラムサイズ制限をパッチする。
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// エンジンが 4096px 超のレイアウトを拒否する制限をパッチする。
// render/renderToString API にサイズオプションは存在せず、
// scale/dpi プラグマも当該チェックには影響しないため、
// ベンダーコピーへの直接パッチが唯一の解決策。
const LIMIT_FROM = "4096.0";
const LIMIT_TO = "65536.0";
const LIMIT_OCCURRENCES = 2;

function patchDimensionLimit(filePath) {
  const src = readFileSync(filePath, "utf8");
  const found = src.split(LIMIT_FROM).length - 1;
  if (found !== LIMIT_OCCURRENCES) {
    console.error(
      `plantuml.js patch failed: "${LIMIT_FROM}" の出現数が ${LIMIT_OCCURRENCES} 個のはずが ${found} 個でした。\n` +
        "アップストリームの TeaVM ビルドが変更された可能性があります。" +
        "plantuml.js を確認し、vendor-plantuml-core.mjs を更新してください。",
    );
    process.exit(1);
  }
  writeFileSync(filePath, src.replaceAll(LIMIT_FROM, LIMIT_TO));
  console.log(`plantuml.js: ダイアグラムサイズ制限を ${LIMIT_FROM} → ${LIMIT_TO} に引き上げました`);
}

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "..", "public", "plantuml");
mkdirSync(dest, { recursive: true });

const requireFrom = createRequire(import.meta.url);
const pkgDir = dirname(requireFrom.resolve("@plantuml/core/package.json"));

for (const name of REQUIRED_FILES) {
  const target = resolve(dest, name);
  copyFileSync(resolve(pkgDir, name), target);
  console.log(`copied ${name} (${statSync(target).size} bytes)`);
}

patchDimensionLimit(resolve(dest, "plantuml.js"));
```

**旧スクリプトからの主な変更点：**

| 項目 | 旧（fetch-plantuml-core.mjs） | 新（vendor-plantuml-core.mjs） |
|-----|-------------------------------|-------------------------------|
| ファイル取得 | HTTP fetch + fflate で ZIP 解凍 | `copyFileSync`（node_modules から） |
| ネットワーク不要 | ❌ | ✅ |
| fflate 依存 | ✅ 必要 | ❌ 不要 |
| パッチ検証 | 存在しなければスキップ | **出現数が正確に 2 でなければ失敗** |
| キャッシュスキップ | ファイルが存在したらスキップ | 毎回コピー（常に最新化） |

---

### 3-4. `frontend/package.json` の変更

```diff
 "scripts": {
   "dev": "vite",
-  "fetch:plantuml": "node scripts/fetch-plantuml-core.mjs",
-  "build": "node scripts/fetch-plantuml-core.mjs && tsc --noEmit && vite build",
+  "vendor:plantuml": "node scripts/vendor-plantuml-core.mjs",
+  "build": "node scripts/vendor-plantuml-core.mjs && tsc --noEmit && vite build",
   ...
 }
 "devDependencies": {
+  "@plantuml/core": "1.2026.6",
   ...
-  "fflate": "^0.8.3",
   ...
 }
```

**設計上の意思決定：**

- `@plantuml/core` のバージョンは **exact（`1.2026.6`、キャレット `^` なし）** とする
  - 理由：`1.2026.5` は GPL。バージョンアップ時は必ずライセンスを再確認が必要
- `fflate` は ZIP 解凍専用だったため削除

---

## 4. リスク評価

### 4-1. パッチの適用可否（リスク：中）

**リスク：** MIT フレーバーの `plantuml.js` では `4096.0` の出現パターンが GPL 版と異なる可能性がある。

**対策：**
- 新スクリプトでは出現数が正確に 2 でない場合はビルドを即座に失敗させる
- 実装後に `public/plantuml/plantuml.js` を手動確認

```bash
grep -c "65536.0" frontend/public/plantuml/plantuml.js  # → 2
grep -c "4096.0" frontend/public/plantuml/plantuml.js   # → 0
```

### 4-2. ライセンスの正確性（リスク：低）

**リスク：** `@plantuml/core` の将来バージョンで MIT が維持される保証がない。

**対策：**
- バージョンを exact で `"1.2026.6"` と固定（`^` なし）
- バージョンアップ時は npm registry でライセンスを必ず再確認すること

### 4-3. fflate 削除の影響（リスク：低）

**リスク：** `fflate` を他の箇所が使用している可能性。

**対策：** 削除前に確認すること：

```bash
grep -r "fflate" frontend/src frontend/scripts
```

---

## 5. 検証計画

### Step 1: インストール & コピー確認

```bash
cd frontend
pnpm install          # @plantuml/core をインストール
node scripts/vendor-plantuml-core.mjs
```

期待する出力：
```
copied plantuml.js (XXXXXXX bytes)
copied viz-global.js (XXXXXXX bytes)
plantuml.js: ダイアグラムサイズ制限を 4096.0 → 65536.0 に引き上げました
```

### Step 2: パッチ確認

```bash
grep -c "65536.0" frontend/public/plantuml/plantuml.js  # 2 が出ること
grep -c "4096.0" frontend/public/plantuml/plantuml.js   # 0 が出ること
```

### Step 3: ビルド確認

```bash
cd frontend && pnpm build
```

エラーなくビルドが完了することを確認。

### Step 4: 動作確認（wails dev）

```bash
wails dev -appargs "D:/work/pumlv-gui/pumlv/examples"
```

- PlantUML ファイルが正常にプレビューされること
- 大きなダイアグラム（4096px 超）が表示されること

---

## 6. 実装ノート：pumlv オリジナル PR との差分

PR #130 には以下が含まれるが、pumlv-gui では **対象外** とするもの：

| PR #130 の変更 | pumlv-gui での扱い |
|---------------|-------------------|
| `credits/vendored.txt` の追加 | **省略**（Wails バイナリ配布形態のため） |
| `generate-frontend-credits.mjs` の新規追加 | **省略** |
| `main.go` の `//go:embed CREDITS` 変更 | **対象外**（pumlv-gui の Go コードは別構成） |
| CI ワークフローの GITHUB_TOKEN 削除 | **対象外**（pumlv-gui は GitHub CI 未使用） |
| E2E テストの追加 | **省略**（必要であれば後追加） |

pumlv-gui で必要な変更は以下 **3点のみ**：
1. `scripts/fetch-plantuml-core.mjs` を削除し `scripts/vendor-plantuml-core.mjs` を新規作成
2. `package.json`：スクリプト名変更 + `@plantuml/core` 追加 + `fflate` 削除
3. `pnpm install` の実行

---

> [!IMPORTANT]
> `@plantuml/core@1.2026.6` の `license: "MIT"` は npm registry で確認済み。
> ただし **v1.2026.5 は GPL-3.0-or-later** であり、バージョン固定が必須。

> [!WARNING]
> `@plantuml/core` をバージョンアップする際は、npm registry でライセンスを必ず再確認すること。
> `pnpm update @plantuml/core` を安易に実行しないこと。
