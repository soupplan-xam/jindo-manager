// 앱 설치(바탕화면·홈 화면 아이콘)를 위한 최소 서비스 워커.
// 화면 파일을 따로 저장해 두지 않는다 — 늘 새 버전을 받아 오도록 네트워크를 그대로 쓴다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
