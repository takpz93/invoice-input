# 請求書 追加明細入力 Webアプリ

動画・ショート動画は **YouTube RSS から自動取得**し、交通費・撮影費・投稿予定の追加分は **この Web アプリで入力**して請求書に統合します。

## 公開URL

**https://takpz93.github.io/invoice-input/**

## ローカル起動

```bash
cd "CFO/invoice-input"
python3 -m http.server 8765
```

ブラウザで http://localhost:8765 を開く。

## 使い方

1. 上部で **対象月** を選ぶ（例: 2026-06）
2. **撮影日** … フッター用リスト（`6/11_SUMISYOU_4時間` 形式で出力）
3. **動画以外の明細** … 交通費・駐車場・撮影費・密着オプションなど
   - ETC → 税込入力 → 税抜自動計算
   - ガソリン → 走行km → ガソリン単価・燃費から税抜自動計算
   - 電車 → 税込入力
   - その他 → 税抜を直接入力
4. **投稿予定の追加分** … RSS にまだ出ていない本（例: 6/27投稿分）
5. **📥 JSON保存** → `extras-2026-06.json` をダウンロード
6. ファイルを `data/extras-2026-06.json` に上書き保存（またはインポート）

入力内容はブラウザの **localStorage** にも自動保存されます。

## 請求書生成

```bash
cd "CFO/invoice-input"
python3 scripts/build_invoice.py 2026-06
```

- 読込: `data/extras-2026-06.json`
- RSS: `data/config.json` のチャンネル ID 一覧
- 出力: `CFO/invoices/請求書_2026年6月分_統合_スプレッドシート.xlsx`

エージェント（monthly-invoice スキル）も同じ JSON を読んで xlsx を生成します。

## データファイル

| ファイル | 役割 |
|---------|------|
| `data/config.json` | クライアント一覧・明細種別・単価 |
| `data/extras-YYYY-MM.json` | 月別の手入力データ（Git 管理推奨） |

## RSS 分類ルール（自動）

| クライアント | 動画制作 | ショート系 |
|-------------|---------|-----------|
| 綿久 | 3分超 | 3分以下 → 切り抜き |
| KINS | 90秒超 | 90秒以下 → ショート投稿 |
| BUDDICA | 10分超 | 90秒以下 → 切り抜き + 本編同日に X用ショート自動 |
| iStory | 3分超 | 3分以下 → 切り抜き |
| その他 | すべて動画制作 | — |

## デプロイ（管理者）

```bash
cd "CFO/invoice-input"
bash scripts/deploy.sh "Update invoice-input"
```

`data/extras-*.json` はデプロイ前に `preserve-extras.js` でリモート保護されます。
