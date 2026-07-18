# implementation_plan_plantuml_version.md

2026-07-18 20:10　作成

---

## 1. 目的

アプリケーションの安定動作のため、Viteビルドおよび実行時に使用しているTeaVMコンパイル版のPlantUML（`plantuml.js` / `viz-global.js`）のダウンロード元を、プレリリース版（snapshot）から安定版（v1.2026.6）に変更する。

- **現状**: `https://github.com/plantuml/plantuml/releases/download/snapshot/js-plantuml-SNAPSHOT.zip`
- **変更後**: `https://github.com/plantuml/plantuml/releases/download/v1.2026.6/js-plantuml-1.2026.6.zip`

---

## 2. 分析（現状 vs 理想の状態）

### 現状
- スクリプト [frontend/scripts/fetch-plantuml-core.mjs](file:///d:/work/pumlv-gui/frontend/scripts/fetch-plantuml-core.mjs) が `snapshot` リリースのZIPアーカイブ `js-plantuml-SNAPSHOT.zip` をダウンロードする。
- アーカイブから `plantuml.js` と `viz-global.js` を抽出し、`frontend/public/plantuml/` ディレクトリに配置する。
- 描画制限サイズを4096pxから65536pxへ引き上げるための置換パッチ（`4096.0` から `65536.0` への文字列置換）を `plantuml.js` に対して適用している。

### 理想の状態
- スクリプト [frontend/scripts/fetch-plantuml-core.mjs](file:///d:/work/pumlv-gui/frontend/scripts/fetch-plantuml-core.mjs) が安定版 `v1.2026.6` リリースのZIPアーカイブ `js-plantuml-1.2026.6.zip` をダウンロードする。
- 安定版の `plantuml.js` に対しても、描画制限サイズを引き上げる置換パッチがエラーなく正常に適用される。
- ダウンロードした安定版のPlantUMLコアを用いて、アプリのビルドとレンダリングが正常に行える。

### 事前検証結果
- 安定版 `v1.2026.6` のZIPを一時的にダウンロードして検証した結果、以下の内容を確認済み：
  - ZIPアーカイブ内の構成はフラットで、直下に `plantuml.js` と `viz-global.js` が存在するため、従来の展開ロジックがそのまま動作する。
  - `plantuml.js` 内に `"4096.0"` が正確に **2箇所** 存在しており、従来のパッチロジックがそのまま適用可能である。

---

## 3. 提案される変更

### 変更対象ファイル
- [frontend/scripts/fetch-plantuml-core.mjs](file:///d:/work/pumlv-gui/frontend/scripts/fetch-plantuml-core.mjs)

### 具体的な変更内容
ダウンロードURLの定数名および値を変更し、コード内のコメントを snapshot から stable 版のものに更新する。

```diff
-// Downloads the TeaVM-compiled PlantUML build (plantuml.js + viz-global.js)
-// from the upstream plantuml/plantuml release "snapshot" zip and places the
-// two required files into internal/frontend/public/plantuml/ so Vite copies
-// them into internal/static/dist/.
+// Downloads the TeaVM-compiled PlantUML build (plantuml.js + viz-global.js)
+// from the upstream plantuml/plantuml release "v1.2026.6" zip and places the
+// two required files into frontend/public/plantuml/ so Vite copies them.
 import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
 import { basename, dirname, resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 import { unzipSync } from "fflate";
 
-const SNAPSHOT_ZIP =
-  "https://github.com/plantuml/plantuml/releases/download/snapshot/js-plantuml-SNAPSHOT.zip";
+const PLANTUML_RELEASE_ZIP =
+  "https://github.com/plantuml/plantuml/releases/download/v1.2026.6/js-plantuml-1.2026.6.zip";
 const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];
```

---

## 4. 検証計画

変更が正しく機能することを以下のステップで検証します。

### ステップ1: キャッシュクリアと再ダウンロードの検証
1. `frontend/public/plantuml/` に配置されている既存の `plantuml.js` および `viz-global.js` を手動で削除する。
2. `pnpm run fetch:plantuml` を実行する。
3. 以下の点を確認する：
   - 指定した `v1.2026.6` のZIPが正常にダウンロードされること。
   - `plantuml.js` と `viz-global.js` が正常に抽出されること.
   - パッチが正常に適用され、コンソールに `plantuml.js: raised dimension limit from 4096 to 65536px` と表示されること。

### ステップ2: フロントエンドのビルド検証
1. `pnpm run build` を実行し、TypeScriptの型チェックおよびViteビルドが正常に完了することを確認する。

### ステップ3: テストの実行検証
1. `pnpm run test:e2e` を実行し、PlaywrightによるPlantUMLレンダリングとプレビュー変更の全テストケースがパスすることを確認する。

---

## 5. リスク評価

- **リスク**: プレリリース版から安定版への移行に伴い、独自のPlantUML記法で非互換性が発生する可能性。
  - **対策**: `v1.2026.6` は安定リリースであるため、プレリリース版（snapshot）よりも互換性と安定性は向上する。また、テストスイート（e2eテスト）でレンダリングが正しく行われることを確認する。
- **リスク**: 最大描画サイズ制限パッチの適用漏れ。
  - **対策**: 事前検証で `plantuml.js` 内に `"4096.0"` が含まれていることを確認しており、パッチが失敗した場合はスクリプトが `process.exit(1)` でエラー終了するため、適用漏れがサイレントに発生することはない。
