import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import WidgetView from './views/WidgetView.jsx'
import './index.css'

// 클릭재킹 방지 — GitHub Pages 는 X-Frame-Options 헤더를 보낼 수 없고
// meta 로 넣은 CSP frame-ancestors 는 브라우저가 무시하므로 코드로 막는다.
if (window.top !== window.self) {
  try {
    window.top.location = window.self.location
  } catch {
    document.documentElement.innerHTML =
      '<p style="font-family:sans-serif;padding:24px">이 페이지는 다른 사이트 안에서 열 수 없습니다.</p>'
  }
}

// 앱 설치 — 브라우저가 설치를 제안하면 붙잡아 두었다가 설정의 [앱으로 설치]에서 띄운다
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  window.__installPrompt = e
  window.dispatchEvent(new Event('installable'))
})
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}

// #widget 이면 바탕화면 위젯 화면만 그린다
const isWidget = location.hash === '#widget'
// 주소의 #widget 을 붙이거나 떼면 화면을 다시 그린다
window.addEventListener('hashchange', e => {
  if ((new URL(e.oldURL).hash === '#widget') !== (location.hash === '#widget')) location.reload()
})
createRoot(document.getElementById('root')).render(isWidget ? <WidgetView /> : <App />)
