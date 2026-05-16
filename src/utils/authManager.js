import auth from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UID_CACHE_KEY = "firebase_anon_uid";

let _currentUser = null;
let _listenerAttached = false;

// Attach onAuthStateChanged lazily on first use, NOT at module-import time.
// Module-level auth calls run before any React lifecycle hook fires, which
// races the native Firebase initialization in AppDelegate (FirebaseApp.configure)
// and can throw "No Firebase App '[DEFAULT]' has been created".
// auth(getApp()) is the v21 non-deprecated form of auth().
function ensureAuthListener() {
  if (_listenerAttached) return;
  _listenerAttached = true;
  // Only clear _currentUser on sign-out.
  // Sign-in is handled exclusively by getOrCreateAnonymousUser() / forceReAuth()
  // so that an unvalidated cached user from a previous Firebase project cannot
  // bypass the getIdToken(true) validation via the fast-path.
  auth(getApp()).onAuthStateChanged((user) => {
    if (!user) _currentUser = null;
  });
}

/**
 * Firebase 匿名認証でサインイン（またはキャッシュ済み UID を返す）。
 * キャッシュされたユーザーのトークンが無効（別プロジェクト等）な場合は
 * サインアウトして再サインインする自己修復ロジックを含む。
 * @returns {Promise<string>} Firebase UID
 */
export async function getOrCreateAnonymousUser() {
  ensureAuthListener();

  if (_currentUser) return _currentUser.uid;

  const currentUser = auth(getApp()).currentUser;
  if (currentUser) {
    try {
      // force refresh でトークンが有効か（正しいプロジェクトか）を検証する
      await currentUser.getIdToken(true);
      _currentUser = currentUser;
      return _currentUser.uid;
    } catch (e) {
      // ネットワークエラーはキャッシュユーザーをそのまま使う（オフライン時の誤サインアウト防止）
      if (e?.code === "auth/network-request-failed") {
        _currentUser = currentUser;
        return _currentUser.uid;
      }
      // auth エラー（別プロジェクト・無効状態等）→ サインアウトして再サインイン
      try { await auth(getApp()).signOut(); } catch { /* ignore */ }
    }
  }

  const userCredential = await auth(getApp()).signInAnonymously();
  _currentUser = userCredential.user;

  await AsyncStorage.setItem(UID_CACHE_KEY, _currentUser.uid);
  return _currentUser.uid;
}

/**
 * 強制的に再認証する（signOut → signInAnonymously）。
 * サーバーから 401 を受け取った場合のリカバリ用。
 * @returns {Promise<string>} 新しい Firebase UID
 */
export async function forceReAuth() {
  _currentUser = null;
  try { await auth(getApp()).signOut(); } catch { /* ignore */ }
  const userCredential = await auth(getApp()).signInAnonymously();
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
  ensureAuthListener();
  const user = auth(getApp()).currentUser ?? _currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/**
 * 現在の UID を返す（同期・未認証なら null）。
 */
export function getCurrentUid() {
  ensureAuthListener();
  return (auth(getApp()).currentUser ?? _currentUser)?.uid ?? null;
}
