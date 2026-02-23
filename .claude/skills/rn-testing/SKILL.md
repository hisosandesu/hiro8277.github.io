---
name: rn-testing
description: React Nativeアプリのテスト戦略。Jest、React Native Testing Library、Detox E2Eテストのパターン。
---

# React Native テストパターン

reactnative.dev/docs/testing-overview に基づくテスト戦略とパターン集。

## テストピラミッド

```
        /  E2E  \        ← 少数: 重要なユーザーフロー (Detox/Maestro)
       / 統合テスト \      ← 中程度: コンポーネント間連携
      / ユニットテスト \    ← 多数: 関数・ユーティリティ・フック
     / 静的解析 (Lint/TS) \ ← 常時: ESLint + TypeScript
```

## 1. 静的解析

```bash
# ESLint
npx eslint src/

# TypeScript型チェック
npx tsc --noEmit
```

## 2. ユニットテスト (Jest)

### セットアップ

```bash
# Jestは通常React Nativeに同梱
# 追加パッケージ
npx expo install jest-expo @testing-library/react-native @testing-library/jest-native
```

### ユーティリティ関数のテスト

```javascript
// utils/formatDate.js
export function formatDate(date) {
  return new Intl.DateTimeFormat('ja-JP').format(new Date(date))
}

// __tests__/formatDate.test.js
import { formatDate } from '../utils/formatDate'

describe('formatDate', () => {
  test('日本語フォーマットで日付を返す', () => {
    const result = formatDate('2026-01-15')
    expect(result).toBe('2026/1/15')
  })

  test('無効な日付でエラーをスロー', () => {
    expect(() => formatDate('invalid')).toThrow()
  })
})
```

### カスタムフックのテスト

```javascript
import { renderHook, act } from '@testing-library/react-native'
import { useCounter } from '../hooks/useCounter'

describe('useCounter', () => {
  test('初期値が正しい', () => {
    const { result } = renderHook(() => useCounter(0))
    expect(result.current.count).toBe(0)
  })

  test('incrementで1増加', () => {
    const { result } = renderHook(() => useCounter(0))
    act(() => { result.current.increment() })
    expect(result.current.count).toBe(1)
  })
})
```

## 3. コンポーネントテスト (React Native Testing Library)

### 基本パターン

```javascript
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SaveButton } from '../components/SaveButton'

describe('SaveButton', () => {
  test('テキストが表示される', () => {
    render(<SaveButton onPress={jest.fn()} text="保存" />)
    expect(screen.getByText('保存')).toBeTruthy()
  })

  test('押下時にonPressが呼ばれる', () => {
    const onPress = jest.fn()
    render(<SaveButton onPress={onPress} text="保存" />)

    fireEvent.press(screen.getByText('保存'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  test('disabled時にonPressが呼ばれない', () => {
    const onPress = jest.fn()
    render(<SaveButton onPress={onPress} text="保存" disabled />)

    fireEvent.press(screen.getByText('保存'))
    expect(onPress).not.toHaveBeenCalled()
  })
})
```

### 非同期コンポーネントのテスト

```javascript
import { render, screen, waitFor } from '@testing-library/react-native'
import { HistoryScreen } from '../screens/HistoryScreen'

// モック
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

describe('HistoryScreen', () => {
  test('データ読み込み後にリストを表示', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([{ id: '1', text: 'テストテキスト', date: '2026-01-15' }])
    )

    render(<HistoryScreen />)

    // ローディング表示
    expect(screen.getByText('読み込み中...')).toBeTruthy()

    // データ表示
    await waitFor(() => {
      expect(screen.getByText('テストテキスト')).toBeTruthy()
    })
  })

  test('データがない場合に空メッセージを表示', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)

    render(<HistoryScreen />)

    await waitFor(() => {
      expect(screen.getByText('履歴がありません')).toBeTruthy()
    })
  })
})
```

### ナビゲーション付きコンポーネントのテスト

```javascript
import { NavigationContainer } from '@react-navigation/native'

function renderWithNavigation(component, { route, ...options } = {}) {
  return render(
    <NavigationContainer>
      {component}
    </NavigationContainer>,
    options
  )
}

test('ナビゲーションが機能する', () => {
  renderWithNavigation(<AppNavigator />)
  fireEvent.press(screen.getByText('履歴'))
  expect(screen.getByText('保存された結果')).toBeTruthy()
})
```

## 4. スナップショットテスト

```javascript
import { render } from '@testing-library/react-native'
import { HomeScreen } from '../screens/HomeScreen'

test('HomeScreenのスナップショット', () => {
  const tree = render(<HomeScreen />)
  expect(tree.toJSON()).toMatchSnapshot()
})

// 注意: スナップショットテストは変更に脆弱
// 重要なUIのみに使用し、スタイルの微調整では更新
```

## 5. モック戦略

### ネイティブモジュールのモック

```javascript
// jest.setup.js
jest.mock('expo-camera', () => ({
  Camera: 'Camera',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}))

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
}))

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  default: {
    recognize: jest.fn().mockResolvedValue({
      text: 'テストテキスト',
      blocks: [],
    }),
  },
}))
```

### API呼び出しのモック

```javascript
// fetchのモック
global.fetch = jest.fn()

beforeEach(() => {
  fetch.mockClear()
})

test('APIからデータを取得', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  })

  const result = await fetchData('/api/data')
  expect(result).toEqual({ data: 'test' })
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/data'),
    expect.any(Object)
  )
})
```

## 6. テスト設定

### jest.config.js

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

## テスト命名規則

```javascript
// ✅ 良い例: 振る舞いを記述
test('空のテキストで保存ボタンを押すとエラーメッセージを表示する', () => {})
test('カメラ権限が拒否された場合に設定画面への案内を表示する', () => {})
test('OCR結果をクリップボードにコピーできる', () => {})

// ❌ 悪い例: 実装詳細や曖昧な記述
test('renders correctly', () => {})
test('works', () => {})
test('should call function', () => {})
```

## テストカバレッジ目標

| レイヤー | 目標 | テスト種別 |
|---------|------|----------|
| ユーティリティ関数 | 90%+ | ユニット |
| カスタムフック | 85%+ | ユニット |
| コンポーネント | 80%+ | コンポーネント |
| 画面 | 70%+ | 統合 |
| ユーザーフロー | 重要フロー100% | E2E |
