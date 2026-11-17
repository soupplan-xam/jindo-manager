// 학부모의견서 양식 파일 — 이 기기 브라우저(IndexedDB)에만 넣어 둔다. 기기 연동·저장소에는 올라가지 않는다.
const DB = 'jindo-files', STORE = 'files', KEY = 'parentForm'
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
const run = async (mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode)
    const q = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); res(q ? q.result : undefined) }
    tx.onerror = () => { db.close(); rej(tx.error) }
  })
}
// { name, type, blob } | undefined
export const loadFormFile = () => run('readonly', s => s.get(KEY))
export const saveFormFile = file => run('readwrite', s => s.put({ name: file.name, type: file.type || 'application/octet-stream', blob: file }, KEY))
export const clearFormFile = () => run('readwrite', s => s.delete(KEY))
