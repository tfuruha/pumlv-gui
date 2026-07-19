# 実装計画書：クリップボードコピー＆ファイル出力機能

**作成日:** 2026-07-19  
**対象リポジトリ:** `pumlv-gui`  
**フェーズ:** Phase 2 追加機能

---

## 1. 目的

PlantUML プレビュー画面で表示中の図を、Microsoft Word 等の外部アプリで即座に利用できる形式で出力する。

- **クリップボードコピー**: ボタン1クリックで PNG 画像をクリップボードに転送 → Word に貼り付け可能
- **ファイル保存**: ネイティブ「名前を付けて保存」ダイアログ経由で PNG ファイルをローカルに書き出し

---

## 2. 現状分析

### 現在のデータフロー

```
renderPlantUML(source: string)
  → "data:image/svg+xml;charset=utf-8,<encoded>" (renderer.ts)
  → useActiveRender.render.svg (hooks)
  → <Preview svg={render.svg}> (app.tsx)
    → <img src={svg}> (components/preview/index.tsx)
```

### 問題点

- SVG Data URL はそのままクリップボードや PNG ファイルには使えない
- Canvas API で SVG → ラスタライズ変換が必要
- ファイル保存ダイアログはブラウザ API では実現不可（Wails の OS ダイアログが必要）

### Wails バインディング現状（`App.d.ts`）

```typescript
GetFileSource(arg1: string): Promise<string>
GetFiles(): Promise<Array<server.FileEntry>>
GetLastFolder(): Promise<string>
OpenFolder(arg1: string): Promise<void>
SelectFolder(): Promise<string>
```

→ PNG 出力用のバインディングが存在しない。新規追加が必要。

---

## 3. 提案する変更

### 3.1 実装方針の決定

| 機能 | 実装層 | 根拠 |
|---|---|---|
| **クリップボードコピー** | TypeScript のみ | `Canvas API` + `Clipboard API` でWails WebView2（Chromium系）上で完結。Go 側変更不要 |
| **ファイル保存** | Go バインディング + TypeScript | ネイティブ保存ダイアログ（`runtime.SaveFileDialog`）は Go 側でのみ呼び出し可能 |

### 3.2 解像度・余白設計

**解像度指定：**
- `scale = 3`（SVG の物理サイズ × 3倍でラスタライズ）
- Word A4縦の本文幅 ~14cm に挿入した場合、実効解像度が約 200〜300 dpi になるよう設計
- SVG の `viewBox` から幅・高さを取得してスケールを乗算

**余白設計：**
- PlantUML 側の SVG に既存の余白が含まれているためデフォルトは追加余白なし
- ただしキャンバスに `padding: 12px` を白塗りで追加（Word 貼り付け時の見切れ防止）

---

### 3.3 変更・新規作成ファイル一覧

#### 【新規作成】

| ファイル | 役割 |
|---|---|
| `frontend/src/lib/svg-to-png.ts` | SVG Data URL → Canvas → PNG Blob 変換ユーティリティ |
| `frontend/src/components/preview/export-controls.tsx` | エクスポートボタン UI コンポーネント |

#### 【変更】

| ファイル | 変更内容 |
|---|---|
| `app.go` | `SaveAsPNG(data string, defaultName string) error` バインディング追加 |
| `frontend/wailsjs/go/main/App.js` | `wails generate` で自動再生成 |
| `frontend/wailsjs/go/main/App.d.ts` | `wails generate` で自動再生成 |
| `frontend/src/components/preview/index.tsx` | `ExportControls` を組み込む |
| `frontend/src/app.tsx` | `svg` を `Preview` 経由で `ExportControls` に渡す（現状 props は既に渡っている） |

---

### 3.4 詳細ロジック

#### (A) `frontend/src/lib/svg-to-png.ts` （新規）

```typescript
const PADDING = 12;   // px (白余白)
const SCALE = 3;      // 解像度スケール (3x ≈ 250dpi 相当)

/**
 * SVG Data URL を PNG の Blob に変換する。
 * @param svgDataUrl  "data:image/svg+xml;charset=utf-8,..." 形式
 * @returns PNG Blob
 */
export async function svgDataUrlToPngBlob(svgDataUrl: string): Promise<Blob> {
  // 1. SVG テキストをデコードして viewBox から幅・高さを取得
  const svgText = decodeURIComponent(svgDataUrl.replace("data:image/svg+xml;charset=utf-8,", ""));
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.documentElement as unknown as SVGSVGElement;

  // viewBox または width/height 属性を参照して元サイズを決定
  const vb = svgEl.viewBox?.baseVal;
  const srcW = vb?.width  || Number(svgEl.getAttribute("width"))  || 800;
  const srcH = vb?.height || Number(svgEl.getAttribute("height")) || 600;

  // 2. Canvas を作成してスケーリング
  const canvas = document.createElement("canvas");
  canvas.width  = (srcW + PADDING * 2) * SCALE;
  canvas.height = (srcH + PADDING * 2) * SCALE;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // 白背景で塗りつぶし（透過 SVG 対策）
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width / SCALE, canvas.height / SCALE);

  // 3. SVG を Image として描画
  const img = new Image();
  img.src = svgDataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG 画像の読み込みに失敗しました"));
  });
  ctx.drawImage(img, PADDING, PADDING);

  // 4. PNG Blob を返す
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG 変換に失敗しました"))),
      "image/png"
    );
  });
}
```

---

#### (B) `frontend/src/components/preview/export-controls.tsx` （新規）

```typescript
interface ExportControlsProps {
  svg: string;           // SVG Data URL
  fileName?: string;     // ファイル名のベース（拡張子なし）
}

export function ExportControls({ svg, fileName = "diagram" }: ExportControlsProps): JSX.Element {
  const [status, setStatus] = useState<"idle" | "copying" | "saving">("idle");

  // クリップボードコピー
  const handleCopy = async () => {
    setStatus("copying");
    try {
      const blob = await svgDataUrlToPngBlob(svg);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      // 成功フィードバック（アイコン変化など）
    } catch (e) {
      console.error("クリップボードコピーに失敗:", e);
    } finally {
      setStatus("idle");
    }
  };

  // ファイル保存（Go バインディング経由）
  const handleSave = async () => {
    setStatus("saving");
    try {
      const blob = await svgDataUrlToPngBlob(svg);
      const arrayBuffer = await blob.arrayBuffer();
      // base64 に変換して Go へ渡す（バイナリ転送の最も互換性の高い方法）
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      await SaveAsPNG(base64, fileName);
    } catch (e) {
      console.error("ファイル保存に失敗:", e);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="flex gap-1">
      {/* クリップボードコピーボタン */}
      <button onClick={handleCopy} disabled={status !== "idle"} title="PNG をクリップボードにコピー" ...>
        {/* クリップボードアイコン */}
      </button>
      {/* PNG 保存ボタン */}
      <button onClick={handleSave} disabled={status !== "idle"} title="PNG として保存" ...>
        {/* ダウンロードアイコン */}
      </button>
    </div>
  );
}
```

---

#### (C) `app.go` — Go バインディング追加

```go
// SaveAsPNG は Base64 エンコードされた PNG データをファイルとして保存する。
// ネイティブの「名前を付けて保存」ダイアログを表示する。
func (a *App) SaveAsPNG(base64Data string, defaultName string) error {
    // 1. 保存先パスをダイアログで取得
    savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        Title:           "PNG として保存",
        DefaultFilename: defaultName + ".png",
        Filters: []runtime.FileFilter{
            {DisplayName: "PNG 画像 (*.png)", Pattern: "*.png"},
        },
    })
    if err != nil || savePath == "" {
        return nil  // キャンセルは正常処理
    }

    // 2. Base64 デコード
    data, err := base64.StdEncoding.DecodeString(base64Data)
    if err != nil {
        return fmt.Errorf("Base64 デコードに失敗しました: %w", err)
    }

    // 3. ファイル書き込み
    return os.WriteFile(savePath, data, 0644)
}
```

---

#### (D) `frontend/src/components/preview/index.tsx` — ExportControls 組み込み

```diff
- export function Preview({ svg }: { svg: string }): JSX.Element {
+ export function Preview({ svg, fileName }: { svg: string; fileName?: string }): JSX.Element {
    ...
    return (
      <div className="relative h-full overflow-hidden">
+       <ExportControls svg={svg} fileName={fileName} />
        <TransformWrapper ...>
```

> **配置場所の検討：**
> - `ExportControls` は `ZoomControls` と同じ `absolute bottom-3 right-3` 領域に置く候補もあるが、
>   ボタンが増えると狭くなるため **`absolute top-3 right-3 z-20`** （左上または右上）を推奨
> - `ZoomControls` が右下を占有しているため、エクスポートボタンは **右上** に配置する

---

#### (E) `app.tsx` — `fileName` を Preview に渡す

```diff
- {render.kind === "ok" && <Preview svg={render.svg} />}
+ {render.kind === "ok" && (
+   <Preview svg={render.svg} fileName={activeName.replace(/\.[^.]+$/, "")} />
+ )}
```

---

### 3.5 Wails バインディング再生成

`app.go` に `SaveAsPNG` を追加後、以下を実行：

```bash
wails generate module
```

→ `frontend/wailsjs/go/main/App.js` と `App.d.ts` に `SaveAsPNG` が自動追記される。

---

### 3.6 検証計画

#### 手動テスト

| # | テストシナリオ | 期待結果 |
|---|---|---|
| T1 | ファイルを選択し、クリップボードコピーボタンを押す | Word に貼り付けて図が表示される |
| T2 | 図が複雑な大サイズ SVG でコピー | 解像度が維持されていること（ぼやけていない） |
| T3 | PNG 保存ボタンを押す | OS のネイティブ保存ダイアログが開く |
| T4 | 保存先を指定して保存する | 指定パスに `.png` ファイルが生成される |
| T5 | 保存ダイアログをキャンセルする | エラーなし、状態が idle に戻る |
| T6 | ファイル未選択時（`active === null`） | ボタンが非表示である |
| T7 | エラー状態（`render.kind === "error"`）のとき | ボタンが非表示または無効である |

#### ユニットテスト

- `svg-to-png.test.ts`（新規）:
  - `svgDataUrlToPngBlob` が Blob を返すこと
  - `width` / `height` / `viewBox` なしの SVG でも fallback 値でクラッシュしないこと

---

## 4. リスク評価

| リスク | 深刻度 | 回避策 |
|---|---|---|
| **`ClipboardItem` が WebView2 で未サポートの可能性** | 中 | WebView2 / Chromium 版を確認。不可の場合は `execCommand('copy')` フォールバックまたはユーザー通知 |
| **大きな SVG（数 MB）の Canvas 変換でメモリ不足** | 低〜中 | `SCALE = 3` の上限を設けてある。将来的には設定可能にする |
| **Base64 経由で大きなバイナリを JS→Go に転送するオーバーヘッド** | 低 | PlantUML の PNG 出力は通常 < 1MB。実用上問題なし |
| **SVG の `<image>` タグや外部フォントの欠落（Canvas tainted）** | 低 | plantuml.js 出力の SVG は自己完結型のため問題なし |
| **`wails generate module` 実行後に既存バインディングが壊れる** | 低 | 自動生成ファイルは上書きのみ。既存メソッドは維持される |

---

## 5. 実装順序

```
Step 1: app.go に SaveAsPNG を追加
   ↓
Step 2: wails generate module でバインディング再生成
   ↓
Step 3: frontend/src/lib/svg-to-png.ts を新規作成
   ↓
Step 4: svg-to-png.test.ts を作成（ユニットテスト）
   ↓
Step 5: export-controls.tsx を新規作成
   ↓
Step 6: preview/index.tsx に ExportControls を組み込む
   ↓
Step 7: app.tsx で fileName を Preview へ渡す
   ↓
Step 8: 手動テスト (T1〜T7)
```

---

## 6. 将来的な拡張候補（スコープ外）

- SVG 形式での直接エクスポート
- エクスポートスケール（1x / 2x / 3x）の UI 選択
- 自動ファイル名（ファイルのベース名 + タイムスタンプ）
