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
  auth(getApp()).onAuthStateChanged((user) => {
    _currentUser = user;
  });
}

/**
 * Firebase 匿名認証でサインイン（またはキャッシュ済み UID を返す）。
 * @returns {Promise<string>} Firebase UID
 */
export async function getOrCreateAnonymousUser() {
  ensureAuthListener();

  if (_currentUser) return _currentUser.uid;

  const currentUser = auth(getApp()).currentUser;
  if (currentUser) {
    _currentUser = currentUser;
    return currentUser.uid;
  }

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
