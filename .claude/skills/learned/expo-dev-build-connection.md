# Expo Development Build 接続トラブルシュート

**抽出日:** 2026-02-15
**コンテキスト:** Expo Development BuildをAndroid実機にインストール後、アプリが起動せずDev Client Launcher画面が表示される

## 問題

EAS Buildで`development`プロファイルでビルドしたAPKをインストールすると、アプリ本体ではなくDev Client Launcher画面が表示される。「Error loading app: failed to connect to /x.x.x.x (port 8081) after 10000ms」エラーが発生する。

## 解決策

### 1. Development Buildは開発サーバー接続が必須

Development Build (`developmentClient: true`) はMetro開発サーバーに接続して動作する設計。これは正常な動作。

```bash
# PCで開発サーバーを起動
npx expo start --dev-client
```

### 2. Windows環境でのポート8081ブロック

Windowsファイアウォールがデフォルトでポート8081をブロックする。

```powershell
# PowerShell（管理者）で許可
netsh advfirewall firewall add rule name="Expo Metro (8081)" dir=in action=allow protocol=TCP localport=8081
```

### 3. トンネルモード（ファイアウォール回避）

```bash
npx expo start --dev-client --tunnel
```

### 4. サーバー不要のビルドが必要な場合

```bash
# previewプロファイルで単体動作APKをビルド
eas build -p android --profile preview
```

## 使用タイミング

- Expo Development Buildが「起動しない」と報告された時
- Dev Client Launcher画面が表示されるがアプリに到達しない時
- "failed to connect" エラーが発生した時
- ビルドプロファイルの使い分けについて質問された時
