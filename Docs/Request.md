# pumlvのGUI化

[pumlv](https://github.com/rin2yh/pumlv)のリポジトリをローカルにクローン後、
Wails2プラットフォームで個別アプリとしてGUI化する

## GUI化によるフォルダ指定方法の多様化
- CLIと同様に、起動時に引数でフォルダを指定する
- 引数なしで起動したときはOS標準のダイアログでフォルダを指定する
- 2回目以降の起動時に、引数なしで起動したときは前回使ったフォルダで開く
- ドラッグアンドドロップで指定する
- フォルダを開くメニューから指定する

## 進め方
### Step.1
- [pumlv](https://github.com/rin2yh/pumlv)のリポジトリをローカルにクローンする
- リポジトリの解析
  - Wails2 環境へのポーティング工程でのリスク抽出と対策策定

### Step.2
- プラン作成
  - 必要に応じて、Step by Stepでの部分検証策の策定
- AGENTS.mdを作成
- 実装、検証を行う

## 参照

- [pumlv](https://zenn.dev/rinrin_yuuki/articles/9b69cca81875f6)
- [plantuml.js](https://github.com/plantuml/plantuml.js)
- [PlantUML公式](https://plantuml.com/ja/)

