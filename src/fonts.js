// 글꼴 고르기 — data.cfg.font 에 저장(기기 연동으로 위젯·다른 기기도 같이 바뀐다).
// 웹 글꼴은 jsDelivr(@fontsource)에서 고를 때만 불러온다. 못 불러오면 기본 글꼴(Pretendard)로 보인다.
const BASE = "'Pretendard Variable', Pretendard, sans-serif"
const fs = (pkg, ver, weights) => weights.map(w => 'https://cdn.jsdelivr.net/npm/@fontsource/' + pkg + '@' + ver + '/' + w + '.css')

export const FONTS = [
  { k: '', n: 'Pretendard (기본)', family: null, css: [] },
  { k: 'malgun', n: '맑은 고딕 (윈도우)', family: "'Malgun Gothic', '맑은 고딕'", css: [] },
  { k: 'noto', n: 'Noto Sans KR', family: "'Noto Sans KR'", css: fs('noto-sans-kr', '5.3.1', [400, 700]) },
  { k: 'nanumgothic', n: '나눔고딕', family: "'Nanum Gothic'", css: fs('nanum-gothic', '5.3.0', [400, 700]) },
  { k: 'plex', n: 'IBM Plex Sans KR', family: "'IBM Plex Sans KR'", css: fs('ibm-plex-sans-kr', '5.3.0', [400, 700]) },
  { k: 'gowundodum', n: '고운돋움', family: "'Gowun Dodum'", css: fs('gowun-dodum', '5.3.0', [400]) },
  { k: 'nanummyeongjo', n: '나눔명조', family: "'Nanum Myeongjo'", css: fs('nanum-myeongjo', '5.3.0', [400, 700]) },
  { k: 'gowunbatang', n: '고운바탕', family: "'Gowun Batang'", css: fs('gowun-batang', '5.3.0', [400, 700]) },
  { k: 'jua', n: '주아 (둥근 글씨)', family: "'Jua'", css: fs('jua', '5.3.0', [400]) },
  { k: 'gaegu', n: '개구 (손글씨)', family: "'Gaegu'", css: fs('gaegu', '5.3.0', [400, 700]) },
]
// 글씨 굵기 — 모든 글씨에 같은 만큼 획을 더한다(굵은 글씨·보통 글씨의 차이는 그대로). data.cfg.fontWeight 0·1·2
export const WEIGHTS = [[0, '보통'], [1, '조금 굵게'], [2, '굵게']]
export const weightClass = w => (w ? ' fw-' + w : '')
// 위젯 글씨 크기(기기마다 — 창 크기가 달라서)
export const WIDGET_SCALES = [[0.9, '작게'], [1, '보통'], [1.12, '크게'], [1.25, '더 크게']]

export const fontOf = k => FONTS.find(f => f.k === (k || '')) || FONTS[0]
export const fontFamily = k => { const f = fontOf(k); return f.family ? f.family + ', ' + BASE : BASE }

// 그 문서(본 창 또는 위젯 작은 창)에 글꼴을 입힌다
export function applyFont(k, doc = document) {
  const f = fontOf(k)
  for (const href of f.css) {
    if ([...doc.querySelectorAll('link[data-font]')].some(l => l.getAttribute('href') === href)) continue
    const l = doc.createElement('link')
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-font', f.k)
    doc.head.appendChild(l)
  }
  if (doc.body) doc.body.style.fontFamily = f.family ? fontFamily(k) : ''
}

// 고른 글꼴이 실제로 쓸 수 있게 됐는지(몇 초 기다려 본다). 기본·시스템 글꼴은 확인하지 않는다
export async function fontReady(k, doc = document) {
  const f = fontOf(k)
  if (!f.css.length || !doc.fonts || !doc.fonts.load) return true
  const name = f.family.split(',')[0]
  for (let i = 0; i < 12; i++) {
    try { const r = await doc.fonts.load('16px ' + name, '가나다 ABC 123'); if (r && r.length) return true } catch { /* 다시 */ }
    await new Promise(r => setTimeout(r, 400))
  }
  return false
}
