# バックエンド OCR アーキテクチャ計画

> **分析日**: 2026-02-24 | **状態**: 計画中（未実装）| **対象フェーズ**: スケール後 Phase 3

## 概要

PaddleOCR をアプリ内に組み込む代わりに、**セルフホスト型バックエンドサービス**として運用する案。
月間 OCR 回数が1万回を超えた段階で Cloud Vision API から移行する。

## アーキテクチャ図

```
[React Native App]
      │ POST /ocr (JPEG base64 + Bearer token)
      │ HTTPS
      ▼
[ConoHa VPS Tokyo]
  ┌──────────────────────────────────┐
  │  Nginx (リバースプロキシ + SSL)   │
  └──────────────┬───────────────────┘
                 │
  ┌──────────────▼───────────────────┐
  │  FastAPI                          │
  │  ├─ JWT/APIKey 認証              │
  │  ├─ レートリミット               │
  │  ├─ 画像バリデーション           │
  │  └─ PaddleOCR 推論              │
  └──────────────────────────────────┘
  ↕ Docker Compose
```

## ConoHa VPS プランと推奨構成

| プラン | RAM | CPU | 月額 | PaddleOCR |
|--------|-----|-----|------|-----------|
| 1GB | 1GB | 2コア | ¥550 | ❌ 不可 |
| 2GB | 2GB | 3コア | ¥880 | △ slim モデルのみ |
| **4GB** | 4GB | 6コア | **¥1,650** | ✅ **推奨**（standard モデル動作） |
| 8GB | 8GB | 8コア | ¥3,300 | ✅ 余裕あり |

## コスト比較（Break-even 分析）

| 月間OCR回数 | Cloud Vision費用 | VPS費用(4GB) | 差額 |
|-----------|-----------------|-------------|------|
| ≤1,000 | ¥0 | ¥1,650 | VPS が¥1,650高い |
| 5,000 | ¥600 | ¥1,650 | VPS が¥1,050高い |
| **≈11,000** | **≈¥1,650** | **¥1,650** | **損益分岐点** |
| 50,000 | ¥6,150 | ¥1,650 | VPS が¥4,500安い |

## 推奨移行タイミング

```
【現在 = Phase 1】ML Kit + Cloud Vision API（.env.local）
  → MVP・無料枠(1000回/月)で十分

【Phase 2: BFF Proxy（ユーザー増加時）】
  ConoHa VPS 1GB + Nginx + Node.js → ¥880/月
  → Cloud Vision の APIキーをサーバー管理（アプリから排除）

【Phase 3: PaddleOCR 移行（月1万回超）】
  ConoHa VPS 4GB + Docker + PaddleOCR + FastAPI → ¥1,650/月
  → コスト固定化・プライバシー強化
```

## React Native 側の変更（実装時）

```javascript
// src/utils/paddleOCRApi.js（新規作成予定）
const BACKEND_URL = process.env.EXPO_PUBLIC_PADDLEOCR_API_URL;
const BACKEND_KEY = process.env.EXPO_PUBLIC_PADDLEOCR_API_KEY;

export const isBackendOCRAvailable = () =>
  Boolean(BACKEND_URL && BACKEND_KEY);

export const recognizeTextWithBackend = async (imageUri) => {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64"  // expo-file-system/legacy
  });
  const response = await fetch(`${BACKEND_URL}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BACKEND_KEY}`,
    },
    body: JSON.stringify({ image_base64: base64 }),
  });
  if (!response.ok) throw new Error(`Backend OCR failed: ${response.status}`);
  const { text } = await response.json();
  return text;
};
```

フォールバック戦略（移行後）:
```
Backend PaddleOCR → 失敗 → Cloud Vision → 失敗 → ML Kit
```

## Docker Compose 構成

```yaml
services:
  paddleocr-api:
    build: ./api
    restart: unless-stopped
    volumes:
      - paddleocr_models:/root/.paddleocr
    environment:
      - API_SECRET_KEY=${API_SECRET_KEY}
    mem_limit: 3g
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]

  certbot:
    image: certbot/certbot
    # Let's Encrypt 自動更新
```

## FastAPI 実装の核心

```python
# PaddleOCR は同期ライブラリ → ThreadPoolExecutor で async に変換
ocr = PaddleOCR(use_angle_cls=True, lang='japan', use_gpu=False)
executor = ThreadPoolExecutor(max_workers=2)

@app.post("/ocr")
async def recognize_text(request: OCRRequest):
    img = decode_base64_image(request.image_base64)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, lambda: ocr.ocr(img, cls=True))
    lines = [line[1][0] for page in result if page for line in page]
    return {"text": "\n".join(lines), "engine": "paddleocr-v4"}
```

## 総合評価

| 観点 | 評価 |
|------|------|
| 技術的実現可能性 | ✅ 高 |
| 日本語OCR精度 | ✅ 非常に高（縦書き対応） |
| 現時点でのROI | ⚠️ 低（月1万回以上でないとコスト優位なし） |
| **総合判断** | **Phase 3 向き。スケール後の最有力移行先** |
