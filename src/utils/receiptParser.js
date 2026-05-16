/**
 * receiptParser.js
 *
 * ML Kit の reconstructTextSpatially 出力テキストから
 * 正規表現でレシート情報を構造化抽出するパーサー。
 *
 * 用途: ML Kit テキストから Gemini 呼び出しなしで構造化 JSON を生成する主エンジン。
 * 対応フォーマット: 日本のスーパー・コンビニ・飲食店レシート（サンエー形式含む）
 */

/**
 * 全角数字・全角スペースを半角に正規化する。
 * ML Kit が日本語認識で全角数字（１２３）を返すケースに対応。
 * 対象: 数字（０-９）と全角スペース（　）のみ。カタカナ・ひらがなは変換しない。
 */
function normalizeText(text) {
  return text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/(\d),\s+(\d)/g, '$1,$2'); // "¥14, 151" → "¥14,151"（OCR スペース混入補正）
}

/** "¥16,629" / "16,629" / 16629 → 16629 | null */
function parsePrice(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

/**
 * 合計金額を抽出する。
 * 優先: 括弧なし「合計」行。
 * 除外: Edy支払計・クレジット・現金・お釣り・預かり・対象・税合計など。
 *
 * 3パターン対応:
 *   Pattern 1: キーワードと金額が同一行（通常ケース・大多数のレシート）
 *              "合計  ¥16,629" / "合計金額  ¥16,629" / "合計（税込）  ¥16,629"
 *              ※ EXCLUDE より優先チェック（合計行が Edy 等と同一行に再構築されても拾う）
 *   Pattern 2: キーワードのみ行 → 次行に金額（合計行が大きいフォントで
 *              reconstructTextSpatially が別行に分離したケース）
 *              "合計\n¥16,629"
 *   Pattern 3: フォールバック — 合計行が ML Kit で未検出の場合、
 *              「Edy支払計」「クレジット支払計」等の支払計行から支払総額を取得。
 *              例: "Edy支払計　¥14,151" → 14151（¥→4 誤認識にも対応）
 */
function extractTotal(lines) {
  const EXCLUDE =
    /支払計|お釣り|預かり|対象|税合計|クレジット|現金|ポイント|カード|Edy|QR/;

  // Pattern 1 用: キーワードと金額が同一行。
  // [^¥￥\d\n]* で "金額" "（税込）" 等のキーワード後の余分な文字を吸収する。
  const TOTAL_RE =
    /^(?:合計(?:金額)?|税込合計|税込計|お買上合計|お買い上げ合計|お会計|お支払い?合計|お支払い?|Grand\s*Total|TOTAL|total)[^¥￥\d\n]*[¥￥4]?\s*([\d,]+)/;

  // Pattern 2 用: キーワードのみ行（数値を含まない）。
  const KEYWORD_ONLY_RE =
    /^(?:合計(?:金額)?|税込合計|税込計|お買上合計|お買い上げ合計|お会計|お支払い?合計|お支払い?|Grand\s*Total|TOTAL|total)[^¥￥\d]*$/;

  // Pattern 2 用: 金額のみ行（¥ または数字で始まり数字とカンマのみ）。
  const AMOUNT_ONLY_RE = /^[¥￥4]?\s*([\d,]+)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Pattern 1: 同一行にキーワードと金額。
    // TOTAL_RE は EXCLUDE より先にチェック:
    // "合計（税込）  ¥16,629  Edy支払..." のように合計行が支払行と
    // 同一空間グループに再構築された場合でも正しく抽出できる。
    const m = TOTAL_RE.exec(trimmed);
    if (m) {
      // 合計行が (税合計 ¥1,071) 行と誤マージされた場合、
      // "[^¥￥\d\n]*" が "(税合計  " を先食いして ¥1,071 を先にキャプチャしてしまう。
      // 行内に "税合計" を含む場合は全価格候補を収集して最大値（実合計）を返す。
      if (/税合計/.test(trimmed)) {
        const allPriceRe = /[¥￥4]?\s*([\d,]{3,})/g;
        const candidates = [];
        let pm;
        while ((pm = allPriceRe.exec(trimmed)) !== null) {
          const p = parsePrice(pm[1]);
          if (p !== null && p >= 100) candidates.push(p);
        }
        if (candidates.length > 0) return Math.max(...candidates);
      }
      return parsePrice(m[1]);
    }

    if (EXCLUDE.test(line)) continue;

    // Pattern 2: キーワードのみ行 → 次行に金額
    // （reconstructTextSpatially がフォントサイズ差で別行に分離したケース）
    if (KEYWORD_ONLY_RE.test(trimmed) && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim();
      if (!EXCLUDE.test(nextTrimmed)) {
        const nextM = AMOUNT_ONLY_RE.exec(nextTrimmed);
        if (nextM) return parsePrice(nextM[1]);
      }
    }
  }

  // Pattern 3: フォールバック — 合計行が ML Kit で完全に未検出の場合
  // Edy支払計 / クレジット支払計 等「支払計」キーワード行から支払総額を取得する。
  //
  // 旧パターン（Edy支払 + greedy [^]*）の問題点:
  //   - "Edy支払計" にも Edy支払 でマッチし、「計　¥14,15」を [^]* が先食いして
  //     末尾の「1」だけをキャプチャ → total=1 の誤結果
  // 修正: 「支払計」キーワードで対象行を絞り、行内の全価格候補を収集して末尾値を採用。
  // ¥→4 誤認識（ML Kit が ¥ を 4 と読む）にも [¥￥4]? で対応。
  // Edy支払（計なし）も追加: 「Edy支払  ¥14,151」形式に対応
  const PAYMENT_TOTAL_KW_RE =
    /Edy支払(?:計)?|クレジット支払計|電子マネー支払計|お支払合計|支払合計/;
  for (const line of lines) {
    if (!PAYMENT_TOTAL_KW_RE.test(line)) continue;
    // 行内の全価格候補（¥/￥/4 プレフィックス + 数字列）を収集して末尾の値を採用
    const priceRe = /[¥￥4]?\s*([\d,]+)/g;
    const candidates = [];
    let pm;
    while ((pm = priceRe.exec(line)) !== null) {
      const p = parsePrice(pm[1]);
      if (p && p >= 100) candidates.push(p);
    }
    if (candidates.length > 0) return candidates[candidates.length - 1];
  }

  return null;
}

/**
 * 税合計を抽出する。
 * 対応: (税合計 ¥1,262) / 税合計 ¥1,262 / 消費税 ¥1,262
 */
function extractTax(lines) {
  const TAX_PATTERNS = [
    // [¥￥4]? で ¥→4 誤認識（ML Kit が ¥ を 4 と読む場合）にも対応
    // [\d,.] で OCR がカンマをピリオドに誤認識したケースも吸収（例: "1.071" → 1071）
    /[（(]税合計\s+[¥￥4]?\s*([\d,.]+)[）)]/,
    /^税合計\s+[¥￥4]?\s*([\d,.]+)/,
    /^消費税(?:\(\d+%?\))?\s+[¥￥4]?\s*([\d,.]+)/,
  ];

  for (const line of lines) {
    for (const re of TAX_PATTERNS) {
      const m = re.exec(line.trim());
      if (m) return parsePrice(m[1]);
    }
  }
  return null;
}

/**
 * テキスト先頭10行から店舗名を推定する。
 * 日付・電話番号・住所・レジ番号・敬称行を除外して最初に残った行を返す。
 */
function extractMerchant(lines) {
  // 電話番号を行内から除去して残りテキストで判定するための正規表現
  // （"V21食品館 宮里店 098-934-3000" → "V21食品館 宮里店" として抽出）
  const PHONE_RE = /\d{2,4}[-ー]\d{2,4}[-ー]\d{3,4}/;

  const EXCLUDE = [
    /^\d{4}[\/年.]\d{1,2}[\/月.]\d{1,2}/, // 日付（YYYY/MM/DD・YYYY年MM月DD日・YYYY.MM.DD）
    /^R\d{1,2}[./]\d{1,2}[./]/, // 令和日付短縮形（R8.4.7）
    /^令和\d{1,2}年/, // 令和年表記
    // 電話番号は PHONE_RE で先に除去するため EXCLUDE から削除
    /[都道府県市区町村]/, // 住所
    /^(?:登録番号|T\d|レジ|レシ|実No|売No|責No)/, // レジ情報
    /^(?:領収証?|領収書|レシート)$/, // タイトル行（「レシート」追加）
    /^[＊*※]\s*印/, // 軽減税率注記（"※印は..." / "* 印" など参照記号バリアント対応）
    /^[A-Z]?\d{3,4}[＊*\s]/, // PLUコード付き商品行（4桁コード + 記号/スペース）
    /^[¥￥Yy+]?\d{3,}$/, // 価格のみ行（"Y598" / "¥1,234" など）
    /^V\d{4}/, // 店舗コード行（"V0361" 等 4桁コード限定。"V21食品館" のような店名は除外しない）
    /^.{0,2}$/, // 2文字以下（「様」「No」等の非店名）
    /^様/, // 敬称（"領収証\n様" の "様" 行）
    /^\d{1,2}[：:]\d{2}/, // 時刻行（14:30）
    /^\d{1,2}時\d{1,2}分/, // 時刻（日本語形式: 14時30分）
    /^T\d{13}$/, // インボイス番号（T + 13桁）
    /^#\d+/, // 注文番号・整理番号
    /^[\d\s\-ー]+$/, // 数字・ハイフンのみ（電話番号断片・レジ番号等）
  ];

  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 電話番号を除去したテキストで判定（電話番号を含む店名行に対応）
    const candidate = trimmed.replace(PHONE_RE, '').trim();
    const checkTarget = candidate.length >= 3 ? candidate : trimmed;
    if (checkTarget.length < 3) continue;
    if (EXCLUDE.some((re) => re.test(checkTarget))) continue;
    return checkTarget;
  }
  return null;
}

/**
 * 日付を YYYY-MM-DD 形式で抽出する。
 * 対応フォーマット:
 *   YYYY/MM/DD, YYYY年M月D日 （既存）
 *   YYYY.MM.DD                （ドット区切り）
 *   令和N年M月D日              （令和表記）
 *   R\d{1,2}[./]\d+[./]\d+   （令和短縮形: R8.4.7 / R8/4/7）
 */
function extractDate(lines) {
  // 令和元号 → 西暦変換（令和1年 = 2019年）
  const reiwaToWestern = (n) => 2018 + parseInt(n, 10);

  const DATE_PATTERNS = [
    // YYYY/MM/DD or YYYY年MM月DD日
    {
      re: /(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/,
      toYMD: (m) => ({ y: parseInt(m[1], 10), mo: m[2], d: m[3] }),
    },
    // YYYY.MM.DD（ドット区切り）
    {
      re: /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
      toYMD: (m) => ({ y: parseInt(m[1], 10), mo: m[2], d: m[3] }),
    },
    // 令和N年M月D日
    {
      re: /令和(\d{1,2})年(\d{1,2})月(\d{1,2})日/,
      toYMD: (m) => ({ y: reiwaToWestern(m[1]), mo: m[2], d: m[3] }),
    },
    // R\d{1,2}[./]\d{1,2}[./]\d{1,2}（R8.4.7 / R8/4/7 短縮形）
    {
      re: /R(\d{1,2})[./](\d{1,2})[./](\d{1,2})/,
      toYMD: (m) => ({ y: reiwaToWestern(m[1]), mo: m[2], d: m[3] }),
    },
  ];

  for (const line of lines) {
    for (const { re, toYMD } of DATE_PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      const { y, mo, d } = toYMD(m);
      if (y < 1990 || y > 2100) continue; // 妥当性チェック
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * 商品明細行を抽出する。
 * 対応パターン:
 *   "0361＊ブラックサンダー袋      ¥258"  （コード番号付き）
 *   "ブラックサンダー袋            258"  （¥ 記号なし・コードなし）
 *   "単178  x 3コ              ¥534"  （数量×単価の小計行）
 *   割引行 "-164" はマイナス金額として items に含める
 *
 * 改善点（2026-03-23）:
 *   - アイテムゾーン限定スキャン（合計/小計行以降を除外してフッターの誤マッチを防ぐ）
 *   - ITEM_SIMPLE の ¥ を任意に変更（¥ 記号を印字しない店舗に対応）
 *   - 軽減税率アノテーション ＊ を品目名末尾から除去
 *   - 価格 < 10 の行をスキップ（数量・番号断片の誤キャプチャ防止）
 *   - LINE_EXCLUDE に日付パターン追加（ヘッダー残留行の誤マッチ防止）
 */
function extractItems(lines) {
  const LINE_EXCLUDE =
    /合計|税|小計|お会計|TOTAL|支払|お釣り|預かり|現金|クレジット|ポイント|カード|対象|領収|レシート|レジ|点数|残高|番号|担当|登録|Edy|QR|店No|%外|\d外|\d{5,}|\d{4}[\/年]\d/i;
  // %外: "10%タ外" を除外。\d外: "88外"（OCR誤読の税率行）を除外

  // PLU コードを品目名から除去するヘルパー
  // "0354:*わかめスープ8P" → "わかめスープ8P"
  const stripCode = (s) =>
    s.replace(/^[A-Z]?\d{3,4}[:\s]*[＊*\s]*/, '').trim() || s;

  // ¥ の OCR 誤認識プレフィックス: ¥/￥/+（¥→+ 誤認識）、
  // 4（¥→4 誤認識）は 3桁数字が直後に来る場合のみ（例: 4275→¥275）、
  // Y/y（¥→Y 誤認識: ラテン大文字/小文字）も 3桁以上の数字が直後の場合のみ。
  // ※ "436" のような 4 始まりの実数値は誤解釈しないよう 4(?=\d{3}\s*$) で制限。
  const PRICE_PREFIX = '(?:[¥￥+Yy]|4(?=\\d{3}\\s*$))?';

  // コード番号付き商品行 (2スペース区切り): "0361＊ブラックサンダー袋  ¥258"
  const ITEM_WITH_CODE = new RegExp(
    String.raw`^[A-Z]?\d{3,4}(?:[＊*]\s*|\s+)(.+?)\s{2,}${PRICE_PREFIX}\s*([\d,]+)\s*$`
  );
  // コード番号付き商品行 (単一スペース + 強制プレフィックス): "0321 *商品名 4458" / "0361 *商品 ¥138"
  // ¥/+/4(3桁) が必須なので誤マッチしにくい
  const ITEM_WITH_CODE_YEN = new RegExp(
    String.raw`^[A-Z]?\d{3,4}(?:[＊*]\s*|\s+)(.+?)\s+(?:[¥￥+]|4(?=\d{3}\s*$))\s*([\d,]+)\s*$`
  );
  // シンプルな商品行（¥ 記号は任意: 店によっては印字しない）
  const ITEM_SIMPLE = new RegExp(
    String.raw`^(.+?)\s{2,}${PRICE_PREFIX}\s*([\d,]+)\s*$`
  );
  // フォールバック: ¥/+/Y 記号直前で品目名と価格を分離（2スペースなしの場合）
  // 例: "コーヒー¥150" / "0361 *商品名 ¥138" / "0361 *商品名 Y138"（Y→¥ OCR誤認識）
  const ITEM_TRAILING_PRICE = /^(.+?)\s*[¥￥+Yy]\s*([\d,]+)\s*$/;
  // 数量×単価行（グループ1=単価, グループ2=数量）:
  //   "単178  x 3コ"（既存・サンエー形式）
  //   "@178 x 3コ"（@ プレフィックス形式）
  //   "単価¥178 × 3"（単価キーワード・全角×）
  const QTY_LINE = /(?:単価?|@)[¥￥]?(\d+(?:[,.]\d+)?)\s*[xX×]\s*(\d+)[コ個点]?/;
  // 割引行（マイナス記号あり）: "オオフクロヨリド゛リ3コ  -164"
  const DISCOUNT_LINE = /^(.+?)\s+-([\d,]+)\s*$/;
  // 値引きキーワード（マイナス記号なしでも負額として扱う）
  const DISCOUNT_KEYWORD_RE = /値引き?|割引|クーポン/;

  // アイテムゾーン終端: 最後の合計行の直前まで（フッター行をスキャン対象から除外）
  // 「小計」はゾーン終端に含めない:
  //   飲食店で「料理小計」「ドリンク小計」が途中に出現しても品目が途切れないようにするため。
  //   明確な合計行（合計/お会計/TOTAL）のみを終端とし、最後の出現位置を採用する。
  const ZONE_END_RE =
    /^(?:合計(?:金額)?|税込合計|税込計|お買上合計|お買い上げ合計|お会計|お支払い?合計|Grand\s*Total|TOTAL|total)/;
  let zoneEndIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (ZONE_END_RE.test(lines[i].trim())) {
      zoneEndIdx = i;
      break;
    }
  }
  const itemZone = zoneEndIdx > 0 ? lines.slice(0, zoneEndIdx) : lines;

  const items = [];
  let lastItem = null;

  for (const line of itemZone) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (LINE_EXCLUDE.test(trimmed)) {
      lastItem = null;
      continue;
    }

    // 数量×単価パターン（前行商品の数量・小計を上書き）
    const qtyMatch = QTY_LINE.exec(trimmed);
    if (qtyMatch && lastItem) {
      const qty = parseInt(qtyMatch[2], 10);
      lastItem.quantity = qty;
      // 行末の金額を小計として price に使用
      const parts = trimmed.split(/\s{2,}/);
      const totalStr = parts[parts.length - 1].trim();
      let total = parsePrice(totalStr);
      // ¥→4 誤認識補正: 先頭 '4' を除いたとき 単価×数量 に一致する場合のみ補正
      // 例: "単228 x2コ  4456" → 4456 先頭の4除去→456 === 228*2 → total=456
      if (total && /^4\d{3}/.test(totalStr)) {
        const unitPrice = parseInt(qtyMatch[1].replace(/[,.]/g, ''), 10);
        const adjusted = parsePrice(totalStr.slice(1));
        if (adjusted === unitPrice * qty) total = adjusted;
      }
      if (total) lastItem.price = total;
      continue;
    }

    // 割引行
    const discountMatch = DISCOUNT_LINE.exec(trimmed);
    if (discountMatch) {
      const amount = parsePrice(discountMatch[2]);
      if (amount && amount >= 10) {
        items.push({ name: discountMatch[1].trim(), price: -amount, quantity: 1 });
      }
      lastItem = null;
      continue;
    }

    // コード番号付き商品行
    let m = ITEM_WITH_CODE.exec(trimmed) ?? ITEM_WITH_CODE_YEN.exec(trimmed);
    if (m) {
      const price = parsePrice(m[2]);
      if (price !== null && price < 10) { lastItem = null; continue; }
      // 先頭・末尾の軽減税率アノテーション(＊/*)を除去
      const name = m[1].trim().replace(/^[＊*\s]+/, '').replace(/[＊*]$/, '');
      lastItem = { name, price, quantity: 1 };
      items.push(lastItem);
      continue;
    }

    // シンプルな商品行
    m = ITEM_SIMPLE.exec(trimmed);
    if (m && !LINE_EXCLUDE.test(m[1])) {
      const price = parsePrice(m[2]);
      if (price !== null && price < 10) { lastItem = null; continue; }
      // PLU コードが先頭に混入している場合は除去（"0354:*わかめスープ8P" → "わかめスープ8P"）
      const name = stripCode(m[1].trim().replace(/[＊*]$/, ""));
      const isDiscount = DISCOUNT_KEYWORD_RE.test(name);
      lastItem = {
        name,
        price: isDiscount ? -Math.abs(price) : price,
        quantity: 1,
      };
      items.push(lastItem);
      continue;
    }

    // フォールバック: ¥/+ 記号で品目名と価格を分離（2スペースなしのケース）
    m = ITEM_TRAILING_PRICE.exec(trimmed);
    if (m && !LINE_EXCLUDE.test(m[1]) && m[1].trim().length >= 2) {
      const price = parsePrice(m[2]);
      if (price !== null && price >= 10) {
        const name = stripCode(m[1].trim().replace(/[＊*]$/, ""));
        const isDiscount = DISCOUNT_KEYWORD_RE.test(name);
        lastItem = {
          name,
          price: isDiscount ? -Math.abs(price) : price,
          quantity: 1,
        };
        items.push(lastItem);
        continue;
      }
    }

    // 2行形式: コード付き商品名のみ（価格は次の数量行で補完）
    // 例: "0345 *脂肪0骨元気\n単228 x2コ  456"
    {
      const NAME_ONLY_RE = /^[A-Z]?\d{3,4}[:\s]*[＊*]?\s*(.{2,})$/;
      const nameOnlyM = NAME_ONLY_RE.exec(trimmed);
      if (nameOnlyM) {
        const rawName = nameOnlyM[1].trim()
          .replace(/^[＊*\s]+/, '')
          .replace(/[＊*\s]+$/, '');
        if (rawName.length >= 2 && !LINE_EXCLUDE.test(rawName)) {
          lastItem = { name: rawName, price: null, quantity: 1 };
          items.push(lastItem);
          continue;
        }
      }
    }

    lastItem = null;
  }

  // 価格が確定しなかった保留アイテムを除去（2行形式で数量行が来なかったケース）
  return items.filter((item) => item.price !== null);
}

/**
 * 税率別内訳を抽出する（2019年軽減税率対応）。
 * 対応フォーマット:
 *   "8%対象  ¥1,200  消費税  ¥96"（同一行）
 *   "8%対象  ¥1,200" + "消費税(8%)  ¥96"（別行）
 *
 * @returns {{ rate8: {subtotal:number, tax:number}|null, rate10: {subtotal:number, tax:number}|null } | null}
 */
function extractTaxBreakdown(lines) {
  // "8%対象  ¥1,200" / "10%対象  ¥2,000"
  const SUBTOTAL_RE = /(\d+)\s*%\s*(?:対象|軽減)[^¥￥\d]*[¥￥4]?\s*([\d,]+)/;
  // "消費税(8%)  ¥96" / "消費税8%  ¥200" / "8%消費税  ¥96"
  const TAX_AMOUNT_RE =
    /(?:消費税\s*[（(]?\s*(\d+)\s*%?\s*[）)]?|(\d+)\s*%\s*消費税)[^¥￥\d]*[¥￥4]?\s*([\d,]+)/;

  const acc = { rate8: null, rate10: null };

  for (const line of lines) {
    const t = line.trim();

    const subM = SUBTOTAL_RE.exec(t);
    if (subM) {
      const rate = parseInt(subM[1], 10);
      const amount = parsePrice(subM[2]);
      if (amount != null && (rate === 8 || rate === 10)) {
        const key = rate === 8 ? "rate8" : "rate10";
        acc[key] = { ...(acc[key] ?? {}), subtotal: amount };
      }
    }

    const taxM = TAX_AMOUNT_RE.exec(t);
    if (taxM) {
      const rate = parseInt(taxM[1] ?? taxM[2], 10);
      const amount = parsePrice(taxM[3]);
      if (amount != null && (rate === 8 || rate === 10)) {
        const key = rate === 8 ? "rate8" : "rate10";
        acc[key] = { ...(acc[key] ?? {}), tax: amount };
      }
    }
  }

  return acc.rate8 || acc.rate10 ? acc : null;
}

/**
 * パース結果の信頼度を 0.0〜1.0 で算出する。
 *
 * 配点:
 *   merchant   抽出成功  +0.15
 *   date       抽出成功  +0.15
 *   total > 0  抽出成功  +0.30
 *   items >= 1 抽出成功  +0.25
 *   items合計 ≈ total（±5%）  +0.15
 *              ≈ total（±15%）  +0.07
 */
function calculateConfidence(parsed) {
  let score = 0;
  if (parsed.merchant) score += 0.15;
  if (parsed.date) score += 0.15;
  if (parsed.total != null && parsed.total > 0) score += 0.30;
  if (parsed.items.length > 0) score += 0.25;

  if (parsed.total && parsed.items.length > 0) {
    const itemsSum = parsed.items.reduce((s, item) => s + (item.price ?? 0), 0);
    const diff = Math.abs(itemsSum - parsed.total);
    if (diff <= parsed.total * 0.05) score += 0.15;
    else if (diff <= parsed.total * 0.15) score += 0.07;
  }

  return Math.min(score, 1.0);
}

/**
 * ML Kit の再構築テキストからレシート情報を構造化抽出する。
 * ML Kit テキスト → 正規表現 → 構造化 JSON の主エンジン。
 * Gemini 呼び出しが不要な場合に使用する（コスト最適化）。
 *
 * @param {string} rawText - reconstructTextSpatially の出力テキスト
 * @returns {{
 *   merchant: string|null,
 *   date: string|null,
 *   total: number|null,
 *   tax: number|null,
 *   taxBreakdown: { rate8: {subtotal,tax}|null, rate10: {subtotal,tax}|null }|null,
 *   items: object[],
 *   confidence: number,
 * }}
 */
export function parseReceiptText(rawText) {
  if (!rawText) {
    return {
      merchant: null, date: null, total: null,
      tax: null, taxBreakdown: null, items: [], confidence: 0,
    };
  }

  const lines = normalizeText(rawText).split("\n");

  const result = {
    merchant:     extractMerchant(lines),
    date:         extractDate(lines),
    total:        extractTotal(lines),
    tax:          extractTax(lines),
    taxBreakdown: extractTaxBreakdown(lines),
    items:        extractItems(lines),
  };
  result.confidence = calculateConfidence(result);
  return result;
}
