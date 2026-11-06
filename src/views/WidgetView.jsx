import React, { useEffect, useMemo, useState } from 'react'
import { loadData, saveData } from '../storage.js'
import { compute, toISO, fromISO, DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, colorOf, subjectOf, contentOf, ddayText, upcomingDdays } from '../logic.js'
import useTodayInfo from '../useTodayInfo.js'
import useCloudSync from '../useCloudSync.js'
import { periodLabel } from './TodayCards.jsx'
import { TODO_COLORS } from './MonthCalendar.jsx'
import { MiniWeek, MiniMonth } from './WidgetParts.jsx'

// 바탕화면 위젯 — 오늘 수업 · 지금 교시 · 오늘 할 일 · 고사 D-day · 급식 · 날씨.
// 윈도우 프로그램은 이 화면(#widget)을 테두리 없는 작은 창으로 띄운다. 브라우저에서도 열린다.
// 데이터는 진도계획표와 같은 브라우저 저장소를 쓰고, 다른 창에서 바뀌면 바로 따라온다.

const desk = typeof window !== 'undefined' ? window.jindoDesktop : null
const PREF_KEY = 'jindo.widget'
const DEFAULT_PREF = { dday: true, opacity: 0.94, tab: 'month', glassA: 0.55, glassColor: '#1E2530' }
// 바탕화면 모드 바탕색 고르기 — 흰 글씨가 잘 보이는 어두운 색들
const GLASS_COLORS = [['#000000', '검정'], ['#1E2530', '먹색'], ['#14284B', '남색'], ['#0F3D4A', '청록'], ['#1F3A2E', '초록'], ['#3B2A4A', '보라'], ['#4A3426', '갈색'], ['#5A2330', '와인']]
const rgba = (hex, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  const n = m ? parseInt(m[1], 16) : 0x1E2530
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
}
// 바탕화면 모드(윈도우 프로그램이 ?glass=1 로 연다): 창 바탕이 투명하고 바탕화면에 붙는다.
// 밝은 화면을 반전해 어두운 유리 위 흰 글씨로 보이게 한다(.wg-glass). 브라우저에서 ?glass=1#widget 으로 미리 볼 수 있다
const GLASS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('glass') === '1'
// 마우스를 받을 곳 — 나머지 빈 곳은 바탕화면으로 통과한다
const HIT = 'button, input, textarea, select, a, label, [data-hit]'
const readPref = () => { try { return { ...DEFAULT_PREF, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') } } catch { return { ...DEFAULT_PREF } } }
const todoColor = k => (TODO_COLORS.find(x => x.k === (k || '')) || TODO_COLORS[0]).c

// shared: 본 창(진도계획표) 안에서 항상 위 작은 창(문서 PIP)으로 띄울 때 본 창의 데이터를 그대로 쓴다
export default function WidgetView({ shared = null }) {
  const [ownData, setDataState] = useState(loadData)
  const setOwn = fn => setDataState(d => { const n = typeof fn === 'function' ? fn(d) : fn; saveData(n); return n })
  const data = shared ? shared.data : ownData
  const setData = shared ? shared.setData : setOwn
  const [pref, setPrefState] = useState(readPref)
  const setPref = p => setPrefState(o => { const n = { ...o, ...p }; try { localStorage.setItem(PREF_KEY, JSON.stringify(n)) } catch { /* 무시 */ } return n })
  const [menu, setMenu] = useState(false)
  const [onTop, setOnTop] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const glass = GLASS && !shared

  // 바탕화면 모드: 마우스가 날짜·할 일·버튼 위에 있을 때만 창이 받는다
  useEffect(() => {
    if (!glass || !desk || !desk.setHit) return
    let last = null
    const on = e => {
      const hit = !!(e.target && e.target.closest && e.target.closest(HIT))
      if (hit !== last) { last = hit; desk.setHit(hit) }
    }
    const out = () => { if (last !== false) { last = false; desk.setHit(false) } }
    document.addEventListener('mousemove', on)
    document.addEventListener('mouseleave', out)
    return () => { document.removeEventListener('mousemove', on); document.removeEventListener('mouseleave', out) }
  }, [glass])

  // 다른 창(진도계획표)에서 고치면 따라온다
  useEffect(() => {
    const on = e => { if (!e.key || e.key === 'jindo.data.v1') setDataState(loadData()) }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])
  useEffect(() => {
    if (!shared) document.documentElement.classList.add('widget-mode')
    if (desk) {
      desk.getAlwaysOnTop().then(setOnTop).catch(() => {})
      desk.getAutoStart().then(setAutoStart).catch(() => {})
    }
  }, [])

  // 진도계획표 창이 닫혀 있어도 로그인돼 있으면 온라인 내용(휴대폰에서 고친 것)과 맞춘다
  useCloudSync(data, setData, !shared)
  const info = useTodayInfo(data, { meal: false, weather: false })
  const today = info.today
  const computed = useMemo(() => compute(data), [data])
  const d = fromISO(today)

  const lessons = []
  for (let p = 1; p <= 7; p++) {
    const s = computed.sessions[today + '|' + p]
    if (s) lessons.push({ p, ...s })
  }
  const todos = (data.todos || {})[today] || []
  const toggleTodo = id => setData(dd => ({ ...dd, todos: { ...(dd.todos || {}), [today]: todos.map(t => (t.id === id ? { ...t, done: !t.done } : t)) } }))
  const exam = computed.exam
  const dday = exam ? Math.round((fromISO(exam.start) - d) / 86400000) : null
  const P = info.period
  const tab = pref.tab === 'week' ? 'week' : 'month'
  const ddays = [...(exam ? [{ id: 'exam', name: exam.name, days: dday }] : []), ...upcomingDdays(data, today)].slice(0, 5)

  const section = (title, body, extra) => (
    <section style={{ padding: '10px 14px', borderTop: '1px solid ' + LINE_SOFT }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>{title}</span>
        {extra}
      </div>
      {body}
    </section>
  )

  const iconBtn = { border: 'none', background: 'none', cursor: 'pointer', color: SUB, padding: '4px 6px', borderRadius: 6, fontSize: 13, lineHeight: 1, WebkitAppRegion: 'no-drag' }

  return (
    <div style={{ height: '100vh', boxSizing: 'border-box', padding: glass ? 0 : desk || shared ? 0 : 16, display: 'flex',
      // 바탕화면 모드: 고른 바탕색은 반전 필터 밖(여기)에 깐다 — 고른 색 그대로 보인다
      ...(glass ? { background: rgba(pref.glassColor, pref.glassA), borderRadius: 14, overflow: 'hidden' } : null) }}>
      <div
        className={'wg-wrap' + (glass ? ' wg-glass' : '')}
        style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: glass ? 'transparent' : desk || shared ? '#FFFFFF' : 'rgba(255,255,255,' + pref.opacity + ')', borderRadius: glass ? 14 : desk || shared ? 0 : 16,
          boxShadow: desk || shared ? 'none' : '0 8px 30px rgba(25,31,40,0.18)', border: desk || shared ? 'none' : '1px solid rgba(225,229,234,0.9)',
          backdropFilter: glass ? 'none' : 'blur(12px)', margin: desk || shared ? 0 : '0 auto',
          ...(glass ? { boxShadow: 'none', border: 'none' } : null),
        }}
      >
        {/* 머리줄 — 윈도우 프로그램에서는 여기를 끌어 창을 옮긴다 */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 8px 14px', WebkitAppRegion: glass ? 'no-drag' : 'drag', userSelect: 'none' }}>
          <span style={{ width: 4, height: 16, borderRadius: 2, background: GREEN, flex: 'none' }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>
              {d.getMonth() + 1}월 {d.getDate()}일 <span style={{ color: d.getDay() === 0 ? RED : d.getDay() === 6 ? '#185FA5' : SUB, fontWeight: 600 }}>{DAYS[d.getDay()]}</span>
              <span className="wg-dim" style={{ fontSize: 12.5, fontWeight: 600, color: FAINT, marginLeft: 8 }}>{String(info.now.getHours()).padStart(2, '0')}:{String(info.now.getMinutes()).padStart(2, '0')}</span>
            </div>
            {lessons.length > 0 && <div className={P && P.kind === 'class' ? '' : 'wg-dim'} style={{ fontSize: 12, color: P && P.kind === 'class' ? GREEN : FAINT, fontWeight: 700 }}>{periodLabel(P)}</div>}
          </div>
          <div role="tablist" aria-label="위젯 보기" style={{ display: 'flex', background: '#F2F4F6', borderRadius: 8, padding: 2, flex: 'none', WebkitAppRegion: 'no-drag' }}>
            {[['month', '달력'], ['week', '시간표']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setPref({ tab: k })}
                style={{ border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: tab === k ? '#FFFFFF' : 'transparent', color: tab === k ? INK : FAINT, boxShadow: tab === k ? '0 1px 3px rgba(25,31,40,0.12)' : 'none' }}>{label}</button>
            ))}
          </div>
          {desk && !glass && (
            <button type="button" onClick={async () => setOnTop(await desk.setAlwaysOnTop(!onTop))} title={onTop ? '항상 위 끄기' : '항상 위에 두기'} aria-pressed={onTop} style={{ ...iconBtn, color: onTop ? GREEN : FAINT }}><Ico d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v6" /></button>
          )}
          <button type="button" onClick={() => setMenu(m => !m)} title="위젯 설정" aria-expanded={menu} style={iconBtn}><Ico d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" dots /></button>
          {desk ? (
            <>
              <button type="button" onClick={() => desk.openMain()} title="진도계획표 열기" style={iconBtn}><Ico d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></button>
              <button type="button" onClick={() => desk.hideWidget()} title="위젯 숨기기 (작업표시줄 알림 영역 아이콘으로 다시 엽니다)" style={iconBtn}><Ico d="M6 6l12 12M18 6L6 18" /></button>
            </>
          ) : (
            shared ? (
              <button type="button" onClick={shared.onOpenMain} title="진도계획표 창으로" style={iconBtn}><Ico d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></button>
            ) : <a href={location.pathname} title="진도계획표 열기" style={{ ...iconBtn, textDecoration: 'none', display: 'flex' }}><Ico d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></a>
          )}
        </header>

        {menu && (
          <div className="wg-menu" style={{ padding: '8px 14px 12px', borderTop: '1px solid ' + LINE_SOFT, background: '#F9FAFB', fontSize: 13, color: INK, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['dday', 'D-day']].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!pref[k]} onChange={() => setPref({ [k]: !pref[k] })} style={{ accentColor: GREEN, margin: 0 }} /> {label}
              </label>
            ))}
            {glass ? (
              <>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ marginRight: 2 }}>바탕색</span>
                  {GLASS_COLORS.map(([c, name]) => (
                    <button key={c} type="button" className="wg-raw" title={name} aria-label={'바탕색 ' + name} aria-pressed={pref.glassColor === c} onClick={() => setPref({ glassColor: c })}
                      style={{ width: 20, height: 20, borderRadius: 999, background: c, border: '2px solid ' + (pref.glassColor === c ? '#FFFFFF' : 'rgba(255,255,255,0.35)'), boxShadow: pref.glassColor === c ? '0 0 0 2px ' + GREEN : 'none', cursor: 'pointer', padding: 0 }} />
                  ))}
                  <label title="다른 색 고르기" className="wg-raw" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="color" aria-label="바탕색 직접 고르기" value={pref.glassColor} onChange={e => setPref({ glassColor: e.target.value })} style={{ width: 26, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                  </label>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  진하기
                  <input type="range" min="0.1" max="0.95" step="0.05" value={pref.glassA} onChange={e => setPref({ glassA: Number(e.target.value) })} style={{ flex: 1, accentColor: GREEN }} />
                </label>
              </>
            ) : (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                투명도
                <input type="range" min="0.55" max="1" step="0.05" value={pref.opacity} onChange={e => { const v = Number(e.target.value); setPref({ opacity: v }); if (desk && desk.setOpacity) desk.setOpacity(v) }} style={{ flex: 1, accentColor: GREEN }} />
              </label>
            )}
            {desk && desk.setMode && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={glass} onChange={() => desk.setMode(glass ? 'normal' : 'desktop')} style={{ accentColor: GREEN, margin: 0 }} /> 바탕화면 모드 (투명하게 바탕화면에 붙이기)
              </label>
            )}
            {glass && <div style={{ fontSize: 11.5, color: FAINT, lineHeight: 1.45 }}>위치·크기는 바탕화면 모드를 끄고 맞춘 뒤 다시 켜세요. 빈 곳은 마우스가 바탕화면으로 통과합니다.</div>}
            {desk && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={autoStart} onChange={async () => setAutoStart(await desk.setAutoStart(!autoStart))} style={{ accentColor: GREEN, margin: 0 }} /> 컴퓨터 켤 때 위젯 자동 실행
              </label>
            )}
          </div>
        )}

        {pref.dday && ddays.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', alignItems: 'baseline', fontSize: 12, color: SUB, padding: '0 14px 6px' }}>
            {ddays.map(x => (
              <span key={x.id}><b style={{ fontSize: 13, color: x.days <= 7 ? '#D9480F' : INK }}>{ddayText(x.days)}</b> {x.name}</span>
            ))}
          </div>
        )}

        {/* 본문: 달력 탭 / 시간표 탭 — 각각 창 전체를 쓴다 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 12px 12px' }}>
          {tab === 'week'
            ? <MiniWeek glass={glass} data={data} setData={setData} computed={computed} today={today} period={P} periods={Math.max(7, (data.cfg.bells || []).length)} />
            : <MiniMonth glass={glass} data={data} setData={setData} today={today} />}
        </div>
      </div>
    </div>
  )
}

// 머리줄 아이콘 (선 그림). dots 는 설정(조절 막대) 모양의 손잡이 점
function Ico({ d, dots }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d={d} />
      {dots && (<><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>)}
    </svg>
  )
}
