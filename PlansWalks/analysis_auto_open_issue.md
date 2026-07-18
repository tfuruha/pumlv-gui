# analysis_auto_open_issue.md

---

## 課題
初期状態で存在しないフォルダを引数に指定して起動した際、または前回開いたフォルダが存在しない状態で起動した際、フォルダ選択ダイアログが表示されず、その後のUI操作（「別のフォルダを開く」ボタンやメニューなど）が一切反応しなくなる。

---

## 要因解析結果

コードベースを確認したところ、以下の2つの要因が複合してこの問題を引き起こしている可能性が高いことが判明しました。

### 要因1: `OnDomReady` 直後のダイアログ表示の競合とスレッドロック
[app.go](file:///d:/work/pumlv-gui/app.go) の `domReady`（WebViewのDOM読み込み完了コールバック）において、以下の処理が行われています。

```go
func (a *App) domReady(ctx context.Context) {
	a.srvMu.Lock()
	srv := a.srv
	a.srvMu.Unlock()

	if srv == nil {
		// 少しディレイを入れるか、goroutineで非同期実行してUIブロックを回避
		go func() {
			log.Println("フォルダ未指定のため、フォルダ選択ダイアログを表示します")
			folder, err := a.SelectFolder()
			// ...
		}()
	}
}
```

- **問題点**: コメントには「少しディレイを入れるか」と記載されていますが、実際には **ディレイ（`time.Sleep`等）が一切実装されていません。**
- **影響**: `OnDomReady` が発火した直後は、WailsのメインウィンドウやWebView2の初期化処理がまだ完全に完了していない（またはウィンドウが表示・アクティブ化される途中の）デリケートなタイミングです。この瞬間にOSのモーダルダイアログ（`runtime.OpenDirectoryDialog`）を即座に表示しようとすると、親ウィンドウのハンドルが正しく割り当てられず、以下の不具合が発生します：
  1. ダイアログウィンドウがメインウィンドウの背後に隠れてしまう。
  2. メインウィンドウはモーダル状態（ダイアログの入力を待っている状態）としてロックされるため、UIのすべてのボタンがクリックしても「反応しない」状態になる。
  3. Wailsのダイアログサブシステムが内部でハングし、後からメニュー等で呼び出すダイアログもすべて無反応になる。

### 要因2: `DefaultDirectory` に存在しないパスが指定された場合の挙動
[app.go](file:///d:/work/pumlv-gui/app.go) の `SelectFolder()` 内で以下のようにダイアログのオプションを指定しています。

```go
func (a *App) SelectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "フォルダを開く",
		DefaultDirectory: a.cfg.LastFolder,
	})
}
```

- **問題点**: `a.cfg.LastFolder` に以前存在していたが現在は削除されたフォルダパス（例: `D:/work/pumlv-gui/pumlv/examples` など）が入っている場合、または引数として渡された不正なパスが保持されている場合、実在しないパスがそのまま `DefaultDirectory` に渡されます。
- **影響**: WindowsのダイアログAPI（Common Item Dialog）に無効な初期ディレクトリを渡した場合、OS側の挙動としてフォールバック処理に失敗し、ダイアログの生成自体がサイレントエラーとして失敗するか、呼び出しスレッドがハングする原因となります。

---

## 対策案

この問題を解決するため、以下の2つの修正を提案します。

### 対策1: `domReady` のダイアログ起動前にディレイ（待機時間）を設ける
ウィンドウのレンダリングと初期化が確実に完了するまで、goroutine内で数百ミリ秒〜1秒待機させてからダイアログを起動します。

```go
	if srv == nil {
		go func() {
			// ウィンドウとWebViewが完全に描画されるまで少し待機する
			time.Sleep(500 * time.Millisecond)
			log.Println("フォルダ未指定のため、フォルダ選択ダイアログを表示します")
			folder, err := a.SelectFolder()
			// ...
```

### 対策2: `SelectFolder()` における初期ディレクトリの実在性チェック
ダイアログを開く前に `DefaultDirectory` が実際にディレクトリとして存在するかチェックし、存在しない場合は空文字（OS標準のデフォルト位置）に安全にフォールバックさせます。

```go
func (a *App) SelectFolder() (string, error) {
	defaultDir := a.cfg.LastFolder
	if defaultDir != "" {
		// ディレクトリの実在チェック
		if info, err := os.Stat(defaultDir); err != nil || !info.IsDir() {
			defaultDir = "" // 存在しない場合はデフォルトにフォールバック
		}
	}
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "フォルダを開く",
		DefaultDirectory: defaultDir,
	})
}
```
