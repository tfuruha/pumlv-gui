# ファイルペインの幅調整・表示トグル機能の実装計画

この計画書では、ユーザーの要望に基づき、マウスドラッグによるファイルペイン（サイドバー）の幅調整と、表示/非表示（トグル）の切り替え機能を実装する手順を定義します。

---

## 1. 実装要件

- **幅調整機能 (マウスドラッグ)**
  - ファイルペイン（サイドバー）の右端をマウスでドラッグして幅を動的に変更できること。
  - 最小幅: `180px`
  - 最大幅: `600px` (または画面幅の `50%` など常識的な範囲)
  - デフォルト幅: `288px` (`w-72` に相当)
- **表示トグル機能**
  - メイン領域のヘッダー左端に、ペインの表示/非表示を切り替えるボタン（サイドバーアイコン）を配置する。
  - 非表示時はペインを非表示にし、プレビュー領域を広げる。
- **永続化 (Persistence)**
  - 設定されたペイン幅および表示状態（開いているか閉じているか）は、ブラウザの `localStorage` に保存・復元されること。
  - バックエンド（Go）への設定保存の変更は行わず、フロントエンドで完結させる。

---

## 2. 影響を受けるファイル

- **[frontend/src/app.tsx](file:///d:/work/pumlv-gui/frontend/src/app.tsx)**
  - サイドバー状態管理のステート（`sidebarWidth`, `sidebarOpen`）を追加。
  - マウスドラッグイベントハンドリング（`onMouseDown`）の追加。
  - レイアウトの更新（サイドバーの幅をインラインスタイルで適用、ドラッグ用ハンドラー `div` の挿入）。
  - ヘッダー左側へのトグルボタンの追加。
- **[frontend/src/api/files.test.ts](file:///d:/work/pumlv-gui/frontend/src/api/files.test.ts)**
  - 旧 `fetch` 方式から、Wails Go バインディング (`GetFiles`, `GetFileSource`) のモックを使用するようにテストを修正。
- **[frontend/src/api/events.test.ts](file:///d:/work/pumlv-gui/frontend/src/api/events.test.ts)**
  - 旧 `EventSource` 方式から、Wails Events (`EventsOn`) のモックを使用するようにテストを修正。
- **[frontend/src/app.test.tsx](file:///d:/work/pumlv-gui/frontend/src/app.test.tsx)**
  - UI変更に伴う既存テストの調整、およびトグルボタンの動作確認等のテストの追加（必要に応じて）。

---

## 3. 詳細設計

### 3.1. 状態定義と永続化 (`app.tsx`)

```typescript
const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
  const saved = localStorage.getItem("sidebarWidth");
  return saved ? parseInt(saved, 10) : 288;
});

const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
  const saved = localStorage.getItem("sidebarOpen");
  return saved !== "false"; // デフォルトは true (表示)
});
```

### 3.2. マウスドラッグハンドラー

マウスが動いている間、グローバルなイベントリスナー (`mousemove`, `mouseup`) を登録・削除し、ペインの幅を更新します。これにより、ドラッグ中にマウスが境界線から外れてもスムーズにドラッグを継続できます。

```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = sidebarWidth;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    // 最小 180px, 最大 600px の範囲にクランプ
    const newWidth = Math.max(180, Math.min(600, startWidth + (moveEvent.clientX - startX)));
    setSidebarWidth(newWidth);
    localStorage.setItem("sidebarWidth", String(newWidth));
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
};
```

### 3.3. レイアウトとドラッグハンドラーのUI設計

サイドバーの右境界として、ドラッグ可能な `div` を挿入します。

```tsx
<div className="flex h-full bg-slate-50 text-slate-800">
  {sidebarOpen && (
    <aside 
      style={{ width: `${sidebarWidth}px` }} 
      className="shrink-0 overflow-y-auto bg-white flex flex-col"
    >
      {/* 既存のサイドバーコンテンツ (border-r は削除し、ドラッグ境界線で代替) */}
    </aside>
  )}

  {sidebarOpen && (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 cursor-col-resize hover:bg-violet-400 active:bg-violet-600 transition-colors bg-slate-200 shrink-0"
      title="ドラッグして幅を調整"
    />
  )}

  <main className="flex min-w-0 flex-1 flex-col">
    {/* メイン領域 */}
  </main>
</div>
```

### 3.4. トグルボタンの配置

メイン領域の `<header>` の左端に配置します。

```tsx
<header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
  <div className="flex items-center gap-2 min-w-0">
    <button
      onClick={() => {
        const nextState = !sidebarOpen;
        setSidebarOpen(nextState);
        localStorage.setItem("sidebarOpen", String(nextState));
      }}
      title={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
      className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      {/* サイドバーの表示/非表示を示すアイコン */}
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={sidebarOpen ? "M4 6h16M4 12h10M4 18h16" : "M4 6h16M4 12h16M4 18h16"}
        />
      </svg>
    </button>
    <span className="min-w-0 truncate font-medium">{activeName || "ファイルを選択してください"}</span>
  </div>
  ...
</header>
```

---

## 4. 開発・検証手順

1. **実装の適用**
   - `frontend/src/app.tsx` に上記の変更を適用する。
2. **ビルドおよびテスト確認**
   - フロントエンドでテストスイート (`npm run test`) を実行し、既存テストが壊れていないことを確認する。
   - 必要に応じて `localStorage` やトグルに関するテストケースを追加。
3. **ローカル環境動作確認**
   - `wails dev` コマンドでアプリを起動し、実際にマウスドラッグで幅がスムーズに変更できるか、トグルボタンで表示/非表示が切り替わるか、リロード後に状態が保持されているか検証する。
