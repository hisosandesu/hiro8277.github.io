import auth from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UID_CACHE_KEY = "firebase_anon_uid";

let _currentUser = null;

// モジュールインポート時に認証状態リスナーを自動起動
auth().onAuthStateChanged((user) => {
  _currentUser = user;
});

/**
 * Firebase 匿名認証でサインイン（またはキャッシュ済み UID を返す）。
 * @returns {Promise<string>} Firebase UID
 */
export async function getOrCreateAnonymousUser() {
  if (_currentUser) return _currentUser.uid;

  const currentUser = auth().currentUser;
  if (currentUser) {
    _currentUser = currentUser;
    return currentUser.uid;
  }

  const userCredential = await auth().signInAnonymously();
  _currentUser = userCredential.user;

  await AsyncStorage.setItem(UID_CACHE_KEY, _currentUser.uid);
  return _currentUser.uid;
}

/**
 * Firebase ID トークンを取得する（API リクエスト認証用）。
 * @param {boolean} forceRefresh トークンを強制更新するか
 * @returns {Promise<string|null>}
 */
export async function getIdToken(forceRefresh = false) {
  const user = auth().currentUser ?? _currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/**
 * 現在の UID を返す（同期・未認証なら null）。
 */
export function getCurrentUid() {
  return (auth().currentUser ?? _currentUser)?.uid ?? null;
}

