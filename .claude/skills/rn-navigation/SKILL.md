---
name: rn-navigation
description: React Navigation v7+を使ったナビゲーション設計パターン。Stack、Tab、Drawer、Deep Linking、認証フロー。
---

# React Navigation パターン集

reactnative.dev/docs/navigation および reactnavigation.org に基づくナビゲーションパターン。

## セットアップ

```bash
# React Navigation v7+ のインストール
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

## Stack Navigator

### 基本パターン

```javascript
import { createNativeStackNavigator } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator()

function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'ホーム' }}
      />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={({ route }) => ({ title: route.params?.title ?? '詳細' })}
      />
    </Stack.Navigator>
  )
}
```

### 画面遷移

```javascript
// パラメータ付き遷移
navigation.navigate('Detail', { id: item.id, title: item.title })

// パラメータ取得
const { id, title } = route.params

// 戻る
navigation.goBack()

// スタックリセット
navigation.reset({
  index: 0,
  routes: [{ name: 'Home' }],
})
```

## Tab Navigator

```javascript
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

const Tab = createBottomTabNavigator()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = route.name === 'Home' ? 'home' : 'settings'
          return <Icon name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}
```

## 認証フローパターン

```javascript
import { NavigationContainer } from '@react-navigation/native'

function App() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return <SplashScreen />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          // 認証済み: メイン画面
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          // 未認証: ログイン画面
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
```

## モーダルパターン

```javascript
function RootStack() {
  return (
    <Stack.Navigator>
      {/* 通常の画面 */}
      <Stack.Group>
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Group>

      {/* モーダル画面 */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="ImagePreview" component={ImagePreviewModal} />
        <Stack.Screen name="TextResult" component={TextResultModal} />
      </Stack.Group>
    </Stack.Navigator>
  )
}
```

## ネストされたナビゲーター

```javascript
// ✅ 推奨構造: 3階層以内
// Root (Stack)
//   ├── Auth (Stack)
//   │   ├── Login
//   │   └── Register
//   └── Main (Tab)
//       ├── Home (Stack)
//       │   ├── HomeScreen
//       │   └── DetailScreen
//       ├── History
//       └── Settings

// ❌ 避ける: 深いネスト（4階層以上）
```

## カスタムヘッダー

```javascript
<Stack.Screen
  name="Home"
  component={HomeScreen}
  options={{
    headerTitle: (props) => <CustomTitle {...props} />,
    headerRight: () => (
      <Pressable onPress={handleSettings}>
        <Icon name="settings" size={24} />
      </Pressable>
    ),
    headerLeft: () => (
      <Pressable onPress={handleMenu}>
        <Icon name="menu" size={24} />
      </Pressable>
    ),
  }}
/>
```

## useFocusEffect（画面フォーカス時のデータ更新）

```javascript
import { useFocusEffect } from '@react-navigation/native'

function HistoryScreen() {
  const [data, setData] = useState([])

  useFocusEffect(
    useCallback(() => {
      // 画面にフォーカスが戻るたびにデータを更新
      loadHistory().then(setData)

      return () => {
        // クリーンアップ（画面離脱時）
      }
    }, [])
  )

  return <FlatList data={data} renderItem={renderItem} />
}
```

## Deep Linking

### 設定

```javascript
const linking = {
  prefixes: ['myapp://', 'https://myapp.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Detail: 'detail/:id',
          History: 'history',
        },
      },
      Auth: {
        screens: {
          Login: 'login',
        },
      },
    },
  },
}

function App() {
  return (
    <NavigationContainer linking={linking} fallback={<ActivityIndicator />}>
      <RootStack />
    </NavigationContainer>
  )
}
```

### セキュリティ注意

```javascript
// ✅ 安全: 非機密データのみ
// myapp://detail/123
// myapp://history

// ❌ 危険: トークンやシークレットをURLに含めない
// myapp://auth?token=abc123
// myapp://reset?code=xyz
```

## ナビゲーション状態の永続化

```javascript
function App() {
  const [isReady, setIsReady] = useState(false)
  const [initialState, setInitialState] = useState()

  useEffect(() => {
    async function restoreState() {
      try {
        const savedState = await AsyncStorage.getItem('NAVIGATION_STATE')
        if (savedState) {
          setInitialState(JSON.parse(savedState))
        }
      } finally {
        setIsReady(true)
      }
    }
    restoreState()
  }, [])

  if (!isReady) return null

  return (
    <NavigationContainer
      initialState={initialState}
      onStateChange={(state) => {
        AsyncStorage.setItem('NAVIGATION_STATE', JSON.stringify(state))
      }}
    >
      <RootStack />
    </NavigationContainer>
  )
}
```
