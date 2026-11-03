import { useEffect, useRef, useState } from 'react'
import { syncAvailable, watchAuth, subscribeRemote, pushRemote, syncJSON, isBlank, deviceId, decideInitial } from './sync.js'
import { coerceData } from './storage.js'

// 기기 연동 상태.
// status: off(설정 없음) · loading · out(로그인 전) · connecting · saving · saved · offline · conflict · error
//
// 처음 연결할 때:
//  - 온라인에 아무것도 없으면 이 기기 내용을 올린다
//  - 이 기기가 비어 있거나 지난 연동 뒤로 이 기기에서 고친 게 없으면 온라인 내용을 받는다
//  - 온라인 쪽이 지난 연동 뒤로 그대로면 이 기기 내용을 올린다
//  - 양쪽 다 바뀌었으면 어느 쪽을 쓸지 묻는다(conflict) — 말없이 덮어쓰지 않는다
// 그 뒤로는 고칠 때마다 1초쯤 뒤 올리고, 다른 기기에서 바뀌면 바로 받아 온다.
export default function useCloudSync(data, setData) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(syncAvailable ? 'loading' : 'off')
  const [conflict, setConflict] = useState(null) // { remote }
  const [lastSaved, setLastSaved] = useState(null)
  const ready = useRef(false)
  const lastJSON = useRef(null) // 온라인과 같다고 알고 있는 내용
  const dataRef = useRef(data)
  dataRef.current = data
  const timer = useRef(null)

  const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* 저장 공간이 막힌 브라우저 */ } }
  const read = k => { try { return localStorage.getItem(k) } catch { return null } }
  const baseKey = uid => 'jindo.sync.base.' + uid

  // 로그인 상태
  useEffect(() => {
    if (!syncAvailable) return
    let unsub = null
    let alive = true
    watchAuth(u => {
      setUser(u)
      if (!u) { ready.current = false; setStatus('out'); setConflict(null) }
    })
      .then(f => { if (alive) unsub = f; else f() })
      .catch(() => setStatus('error'))
    return () => { alive = false; if (unsub) unsub() }
  }, [])

  const markSynced = (uid, json) => {
    lastJSON.current = json
    store(baseKey(uid), json)
  }

  const applyRemote = (uid, remote) => {
    // 덮어쓰기 전 이 기기 내용을 한 벌 남겨 둔다
    store('jindo.data.backup', JSON.stringify(dataRef.current))
    let next
    try {
      next = coerceData(JSON.parse(remote.json))
    } catch {
      setStatus('error')
      return false
    }
    next.ui = dataRef.current.ui
    markSynced(uid, syncJSON(next))
    setData(next)
    return true
  }

  const push = async (uid, json) => {
    setStatus(navigator.onLine === false ? 'offline' : 'saving')
    try {
      await pushRemote(uid, json)
      markSynced(uid, json)
      setLastSaved(Date.now())
      setStatus('saved')
    } catch (e) {
      setStatus(e && e.code === 'permission-denied' ? 'error' : navigator.onLine === false ? 'offline' : 'error')
    }
  }

  // 로그인되면 온라인 문서를 지켜본다
  useEffect(() => {
    if (!user) return
    const uid = user.uid
    let unsub = null
    let alive = true
    let first = true
    ready.current = false
    setStatus('connecting')
    subscribeRemote(uid, (remote, meta) => {
      if (meta.pending) return // 내가 올리는 중인 변경
      if (first) {
        if (meta.fromCache) { setStatus(navigator.onLine === false ? 'offline' : 'connecting'); return } // 서버 응답을 기다린다
        first = false
        const local = dataRef.current
        const localJSON = syncJSON(local)
        const base = read(baseKey(uid))
        const what = decideInitial({ remoteJSON: remote ? remote.json : null, localJSON, base, localBlank: isBlank(local) })
        if (what === 'push') { ready.current = true; push(uid, localJSON); return }
        if (what === 'same') { markSynced(uid, localJSON); ready.current = true; setStatus('saved'); return }
        if (what === 'pull') { applyRemote(uid, remote); ready.current = true; setStatus('saved'); return }
        setConflict({ remote })
        setStatus('conflict')
        return
      }
      if (!ready.current) return
      if (remote && remote.device !== deviceId && remote.json !== lastJSON.current) {
        applyRemote(uid, remote)
        setLastSaved(remote.updatedAt || Date.now())
      }
      setStatus(s => (s === 'saving' ? s : meta.fromCache ? 'offline' : 'saved'))
    }, () => setStatus('error'))
      .then(f => { if (alive) unsub = f; else f() })
      .catch(() => setStatus('error'))
    return () => { alive = false; if (unsub) unsub(); clearTimeout(timer.current) }
  }, [user])

  // 고칠 때마다 잠시 뒤 올린다
  useEffect(() => {
    if (!user || !ready.current) return
    const json = syncJSON(data)
    if (json === lastJSON.current) return
    clearTimeout(timer.current)
    setStatus('saving')
    timer.current = setTimeout(() => push(user.uid, json), 1200)
  }, [data, user])

  const resolve = which => {
    if (!user || !conflict) return
    if (which === 'remote') applyRemote(user.uid, conflict.remote)
    else push(user.uid, syncJSON(dataRef.current))
    setConflict(null)
    ready.current = true
    if (which === 'remote') setStatus('saved')
  }

  return { available: syncAvailable, user, status, conflict, resolve, lastSaved }
}
