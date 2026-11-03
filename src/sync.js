// 기기 연동 — 구글 로그인 + Firestore 의 users/{uid} 문서 하나에 전체 데이터를 담는다.
// Firebase 는 연동을 쓸 때만 불러온다(첫 화면이 무거워지지 않도록).
import { firebaseConfig } from './firebaseConfig.js'

export const syncAvailable = !!firebaseConfig.apiKey

let fbPromise = null
function fb() {
  if (!fbPromise) {
    fbPromise = (async () => {
      const [{ initializeApp }, A, F] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ])
      const app = initializeApp(firebaseConfig)
      const auth = A.getAuth(app)
      let db
      try {
        // 오프라인에서 고친 내용도 저장해 두었다가 연결되면 올린다
        db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) })
      } catch {
        db = F.getFirestore(app)
      }
      return { A, F, auth, db }
    })()
  }
  return fbPromise
}

// 이 기기 표시 — 내가 올린 변경이 되돌아올 때 다시 적용하지 않으려고 쓴다
export const deviceId = (() => {
  try {
    let id = localStorage.getItem('jindo.deviceId')
    if (!id) {
      id = Math.random().toString(36).slice(2, 10)
      localStorage.setItem('jindo.deviceId', id)
    }
    return id
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
})()

export async function watchAuth(cb) {
  const { A, auth } = await fb()
  // 리디렉트 로그인에서 돌아온 경우 결과를 마무리한다
  A.getRedirectResult(auth).catch(() => {})
  return A.onAuthStateChanged(auth, cb)
}

export async function signIn() {
  const { A, auth } = await fb()
  const provider = new A.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await A.signInWithPopup(auth, provider)
  } catch (e) {
    // 팝업이 막힌 브라우저(일부 휴대폰 앱 안 브라우저)는 페이지 이동 방식으로
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      await A.signInWithRedirect(auth, provider)
      return
    }
    if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return
    throw e
  }
}

export async function signOutUser() {
  const { A, auth } = await fb()
  await A.signOut(auth)
}

// cb(remote | null, meta) — remote = { json, device, updatedAt(ms) }
export async function subscribeRemote(uid, cb, onError) {
  const { F, db } = await fb()
  const ref = F.doc(db, 'users', uid)
  return F.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
    const meta = { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites }
    if (!snap.exists()) return cb(null, meta)
    const d = snap.data()
    cb({ json: d.json, device: d.device, updatedAt: d.updatedAt ? d.updatedAt.toMillis() : null }, meta)
  }, onError)
}

export async function pushRemote(uid, json) {
  const { F, db } = await fb()
  await F.setDoc(F.doc(db, 'users', uid), { json, device: deviceId, updatedAt: F.serverTimestamp(), v: 1 })
}

// 올릴 내용 — 화면 배치(ui)는 기기마다 다르므로 빼고 맞춘다
export function syncJSON(data) {
  const { ui, ...rest } = data
  return JSON.stringify(rest)
}

// 처음 연결할 때 할 일: push(이 기기 → 온라인) · pull(온라인 → 이 기기) · same · conflict(사용자에게 묻기)
// base = 지난번에 양쪽이 같았던 내용
export function decideInitial({ remoteJSON, localJSON, base, localBlank }) {
  if (remoteJSON == null) return 'push'
  if (remoteJSON === localJSON) return 'same'
  if (localBlank || localJSON === base) return 'pull'
  if (remoteJSON === base) return 'push'
  return 'conflict'
}

// 아무것도 만들지 않은 상태인지 (처음 로그인한 휴대폰 등)
export function isBlank(data) {
  return !data.setupDone && !(data.classes || []).length && !(data.events || []).length && !Object.keys(data.pattern || {}).length
}
