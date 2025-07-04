# LibeCity to Notion Chrome拡張機能

LibeCityのチャット投稿を自動的にNotionデータベースに保存するChrome拡張機能です。

## 🚀 主な機能

### ✨ 自動投稿保存
- **ワンクリック保存**: 投稿に表示されるNotionアイコンをクリックするだけで簡単保存
- **つぶやき投稿対応**: 通常のチャット投稿とつぶやき投稿の両方に対応
- **重複防止**: 同じ投稿の重複保存を自動的に防止

### 📝 豊富なコンテンツ対応
- **テキスト**: フォーマット（太字、斜体、下線等）を保持して保存
- **画像**: 投稿内の画像を自動的にNotionに保存
- **リンク**: URLリンクを適切に処理
- **長文投稿**: 文字数制限を超える長文も自動的に最適化

### 🎯 スマートなエラーハンドリング
- **画像保存失敗**: 画像が保存できない場合もテキストは正常に保存
- **エラー表示**: ユーザーフレンドリーなエラーメッセージ
- **自動リトライ**: 失敗時の自動再試行機能

### 🔧 データベース管理
- **自動作成**: デフォルトデータベースの自動作成
- **親ページ選択**: 作成先のNotionページを選択可能
- **プロパティ自動調整**: データベーススキーマに合わせた自動調整

## 📦 インストール方法

### Chrome Web Store（推奨）
1. [Chrome Web Store](https://chrome.google.com/webstore)で「LibeCity to Notion」を検索
2. 「Chromeに追加」をクリック
3. 拡張機能が自動的にインストールされます

### 手動インストール（開発者向け）
1. このリポジトリをクローン
2. Chrome拡張機能の開発者モードを有効化
3. `LCchat2notion`フォルダを読み込み

## ⚙️ 初期設定

### 1. Notion Integration Token の取得
1. 拡張機能のポップアップを開く
2. 「Notion認証ページを開く」をクリック
3. Notion Integrationページで新しいIntegrationを作成
4. 生成されたTokenをコピー

### 2. 拡張機能の設定
1. 拡張機能のポップアップでAPIキーを入力
2. 「接続テスト」で正常に接続できることを確認
3. 「+ デフォルトデータベース作成」を選択
4. 作成先のページを選択してデータベースを作成

## 🎮 使用方法

### 基本的な使い方
1. LibeCityのチャット画面を開く
2. 保存したい投稿にマウスオーバー
3. 表示されるNotionアイコンをクリック
4. 自動的にNotionに保存されます

### 保存されるデータ
- **タイトル**: 投稿の最初の50文字
- **作成者**: 投稿者名
- **チャット**: 投稿の完全なテキスト内容
- **URL**: 投稿への直接リンク
- **日付**: 投稿日時

### 状態表示
- **🔄 保存中**: 黄色のローディングアイコン
- **✅ 保存完了**: 緑色のチェックマーク
- **❌ 保存失敗**: 赤色のエラーアイコン
- **✅ 保存済み**: 既に保存済みの投稿

## 🔧 技術仕様

### 対応ブラウザ
- Google Chrome 88+
- Microsoft Edge 88+
- その他Chromiumベースブラウザ

### 必要な権限
- `activeTab`: アクティブタブへのアクセス
- `storage`: 設定とデータの保存
- `scripting`: コンテンツスクリプトの実行
- `identity`: Notion API認証

### ホスト権限
- `https://libecity.com/*`: LibeCityサイトへのアクセス
- `https://api.notion.com/*`: Notion APIへのアクセス

## 🚀 バージョン履歴

### v1.1.0 (2024-12-19)
- ✅ エラー表示の完全修正
- ✅ ユーザーフレンドリーなエラーメッセージ
- ✅ コンソールエラーの完全除去
- ✅ 画像保存エラーハンドリングの改善
- ✅ つぶやき投稿の重複保存問題修正
- ✅ 長文投稿の自動最適化機能

### v1.0.0 (2024-12-15)
- 🎉 初回リリース
- ✅ 基本的な投稿保存機能
- ✅ Notionデータベース自動作成
- ✅ 画像とテキストの保存

## 🛠️ 開発者向け情報

### プロジェクト構造
```
LCchat2notion/
├── manifest.json          # 拡張機能の設定
├── src/
│   ├── background/         # バックグラウンドスクリプト
│   ├── content/           # コンテンツスクリプト
│   └── popup/             # ポップアップUI
└── assets/
    └── icons/             # アイコンファイル
```

### 開発環境
- Manifest V3 Chrome拡張機能
- Vanilla JavaScript (ES2020+)
- Notion API v2023-06-12

### ビルド・デプロイ
```bash
# 開発用パッケージ作成
cd LCchat2notion
zip -r chrome-extension-package.zip . -x "*.DS_Store" "*.git*"

# Chrome Web Store用パッケージ
# 上記ZIPファイルをChrome Web Store Developer Dashboardにアップロード
```

## 📝 ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 📞 サポート

問題や質問がある場合は、GitHubのIssuesページでお知らせください。

---

**LibeCity to Notion** - LibeCityの投稿を効率的にNotionで管理 