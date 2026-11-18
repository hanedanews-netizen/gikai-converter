# 議会文書表 変換ラボ（公開実験版）

静的HTML/CSS/JavaScriptのみで動作するPDF→Word試作アプリです。サーバーAPI・OpenAI API・APIキーは使用しません。

## 公開手順（GitHub Pages）
1. GitHubで新規Publicリポジトリを作成します（例: `gikai-converter`）。
2. `index.html`、`style.css`、`app.js`、`README.md` をリポジトリのルートにアップロードします。
3. Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save。
4. 公開URLは通常 `https://<ユーザー名>.github.io/gikai-converter/` です。実際のURLはPages画面で確認してください。
5. 千代田区議会の公開PDFをダウンロードし、公開ページでアップロードして動作を確認してください。

## 技術と制限
- PDF.js 3.11.174（CDN）: 埋め込み文字の抽出とPDF描画。
- Tesseract.js 5.1.1（CDN）: ブラウザ内の日本語・英語OCR。初回は言語データを取得します。
- docx 8.5.0（CDN）: Word文書の生成。
- PDFの内容をアプリ独自のサーバーへ送信するコードはありません。外部CDNからライブラリやOCRモデルを取得します。ホスティング側の通常のアクセスログは別途あり得ます。
- ブラウザがPDFの埋め込みテキストを認識できても、その文字が正確とは限りません。手書き文書では「全ページを画像OCRする」を選択してください。
- 日本語手書きのOCR精度は高くありません。人間による修正が必須です。
- Word書式は大田区議会の文書表を参考にした**簡易試作**であり、厳密な書式複製ではありません。
- 15MB / 20ページ上限。PDFは利用者の端末のメモリ内で処理します。
- 本番運用前に複数の端末・ブラウザで検証し、プライバシーポリシーと利用規約を整備してください。

## ローカルで試す
`python -m http.server 8000` をこのフォルダで実行し、`http://localhost:8000/` を開きます。インターネット接続が必要です。

## 課金
OpenAI APIを一切呼ばないため、公開アプリの利用者によって制作者のChatGPT契約枠やOpenAI API残高が消費されることはありません。ホスティングサービスの無料枠や規約は別途確認してください。
