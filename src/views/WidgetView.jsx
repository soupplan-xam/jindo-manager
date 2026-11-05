import React, { useEffect, useMemo, useState } from 'react'
import { loadData, saveData } from '../storage.js'
import { compute, toISO, fromISO, DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, colorOf, subjectOf, contentOf } from '../logic.js'
import useTodayInfo from '../useTodayInfo.js'
import useCloudSync from '../useCloudSync.js'
import { WeatherLine, MealView, periodLabel, NOW_BG } from './TodayCards.jsx'
import { TODO_COLORS } from './MonthCalendar.jsx'

// 바탕화면 위젯 — 오늘 수업 · 지금 교시 · 오늘 할 일 · 고사 D-day · 급식 · 날씨.
// 윈도우 프로그램은 이 화면(#widget)을 테두리 없는 작은 창으로 띄운다. 브라우저에서도 열린다.
// 데이터는 진도계획표와 같은 브라우저 저장소를 쓰고, 다른 창에서 바뀌면 바로 따라온다.

const desk = typeof window !== 'undefined' ? window.jindoDesktop : null
const PREF_KEY = 'jindo.widget'
const DEFAULT_PREF = { lessons: true, todos: true, dday: true, meal: true, weather: true, opacity: 0.94 }
const readPref = () => { try { return { ...DEFAULT_PREF, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') } } catch { return { ...DEFAULT_PREF } } }
const todoColor = k => (TODO_COLORS.find(x => x.k === (k || '')) || TODO_COLORS[0]).c

export default function WidgetView() {
  const [data, setDataState] = useState(loadData)
  const setData = fn => setDataState(d => { const n = typeof fn === 'function' ? fn(d) : fn; saveData(n); return n })
  const [pref, setPrefState] = useState(readPref)
  const setPref = p => setPrefState(o => { const n = { ...o, ...p }; try { localStorage.setItem(PREF_KEY, JSON.stringify(n)) } catch { /* 무시 */ } return n })
  const [menu, setMenu] = useState(false)
  const [onTop, setOnTop] = useState(false)
  const [autoStart, setAutoStart] = useState(false)

  // 다른 창(진도계획표)에서 고치면 따라온다
  useEffect(() => {
    const on = e => { if (!e.key || e.key === 'jindo.data.v1') setDataState(loadData()) }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])
  useEffect(() => {
    document.documentElement.classList.add('widget-mode')
    if (desk) {
      desk.getAlwaysOnTop().then(setOnTop).catch(() => {})
      desk.getAutoStart().then(setAutoStart).catch(() => {})
    }
  }, [])

  // 진도계획표 창이 닫혀 있어도 로그인돼 있으면 온라인 내용(휴대폰에서 고친 것)과 맞춘다
  useCloudSync(data, setData)
  const info = useTodayInfo(data, { meal: pref.meal, weather: pref.weather })
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
    <div style={{ height: '100vh', boxSizing: 'border-box', padding: desk ? 0 : 16, display: 'flex' }}>
      <div
        style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: desk ? '#FFFFFF' : 'rgba(255,255,255,' + pref.opacity + ')', borderRadius: desk ? 0 : 16,
          boxShadow: desk ? 'none' : '0 8px 30px rgba(25,31,40,0.18)', border: desk ? 'none' : '1px solid rgba(225,229,234,0.9)',
          backdropFilter: 'blur(12px)', maxWidth: desk ? undefined : 380, margin: desk ? 0 : '0 auto',
        }}
      >
        {/* 머리줄 — 윈도우 프로그램에서는 여기를 끌어 창을 옮긴다 */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 8px 14px', WebkitAppRegion: 'drag', userSelect: 'none' }}>
          <span style={{ width: 4, height: 16, borderRadius: 2, background: GREEN, flex: 'none' }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>
              {d.getMonth() + 1}월 {d.getDate()}일 <span style={{ color: d.getDay() === 0 ? RED : d.getDay() === 6 ? '#185FA5' : SUB, fontWeight: 600 }}>{DAYS[d.getDay()]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: FAINT, marginLeft: 8 }}>{String(info.now.getHours()).padStart(2, '0')}:{String(info.now.getMinutes()).padStart(2, '0')}</span>
            </div>
            {lessons.length > 0 && <div style={{ fontSize: 12, color: P && P.kind === 'class' ? GREEN : FAINT, fontWeight: 700 }}>{periodLabel(P)}</div>}
          </div>
          {desk && (
            <button type="button" onClick={async () => setOnTop(await desk.setAlwaysOnTop(!onTop))} title={onTop ? '항상 위 끄기' : '항상 위에 두기'} aria-pressed={onTop} style={{ ...iconBtn, color: onTop ? GREEN : FAINT }}><Ico d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v6" /></button>
          )}
          <button type="button" onClick={() => setMenu(m => !m)} title="위젯 설정" aria-expanded={menu} style={iconBtn}><Ico d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" dots /></button>
          {desk ? (
            <>
              <button type="button" onClick={() => desk.openMain()} title="진도계획표 열기" style={iconBtn}><Ico d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></button>
              <button type="button" onClick={() => desk.hideWidget()} title="위젯 숨기기 (작업표시줄 알림 영역 아이콘으로 다시 엽니다)" style={iconBtn}><Ico d="M6 6l12 12M18 6L6 18" /></button>
            </>
          ) : (
            <a href={location.pathname} title="진도계획표 열기" style={{ ...iconBtn, textDecoration: 'none', display: 'flex' }}><Ico d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></a>
          )}
        </header>

        {menu && (
          <div style={{ padding: '8px 14px 12px', borderTop: '1px solid ' + LINE_SOFT, background: '#F9FAFB', fontSize: 13, color: INK, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['lessons', '오늘 수업'], ['todos', '오늘 할 일'], ['dday', '고사 D-day'], ['meal', '급식'], ['weather', '날씨']].map(([k, label]) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!pref[k]} onChange={() => setPref({ [k]: !pref[k] })} style={{ accentColor: GREEN, margin: 0 }} /> {label}
              </label>
            ))}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              투명도
              <input type="range" min="0.55" max="1" step="0.05" value={pref.opacity} onChange={e => { const v = Number(e.target.value); setPref({ opacity: v }); if (desk && desk.setOpacity) desk.setOpacity(v) }} style={{ flex: 1, accentColor: GREEN }} />
            </label>
            {desk && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={autoStart} onChange={async () => setAutoStart(await desk.setAutoStart(!autoStart))} style={{ accentColor: GREEN, margin: 0 }} /> 컴퓨터 켤 때 위젯 자동 실행
              </label>
            )}
          </div>
        )}

        <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {pref.lessons && section('오늘 수업', lessons.length === 0 ? (
            <div style={{ fontSize: 13, color: FAINT }}>수업 없음</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {lessons.map(s => {
                const isNow = P && P.kind === 'class' && P.period === s.p
                const isNext = P && P.kind !== 'class' && P.next === s.p
                const cont = !s.canceled && s.num ? contentOf(data, s.sec || 'start', subjectOf(data, s.cls), s.num) : ''
                return (
                  <div key={s.p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', margin: '0 -8px', borderRadius: 8, background: isNow ? NOW_BG : 'transparent', boxShadow: isNext ? 'inset 0 0 0 1px #C6E6FA' : 'none' }}>
                    <span style={{ width: 34, fontSize: 11.5, color: isNow ? GREEN : FAINT, fontWeight: isNow ? 800 : 500, flex: 'none' }}>{isNow ? '지금' : s.p + '교시'}</span>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.makeup ? '#E8EBEF' : colorOf(data, s.cls), border: '1px solid rgba(25,31,40,0.15)', flex: 'none' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: s.canceled && !s.makeup ? FAINT : INK, flex: 'none' }}>{s.makeup ? s.place || '보강' : s.cls}</span>
                    <span style={{ fontSize: 12, color: SUB, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cont}</span>
                    {s.canceled ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: s.perf ? RED : FAINT, flex: 'none' }}>{s.makeup ? '보강' : s.perf ? '수행' : s.reason}</span>
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 800, color: INK, flex: 'none' }}>{s.num}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {pref.todos && section('오늘 할 일', todos.length === 0 ? (
            <div style={{ fontSize: 13, color: FAINT }}>없음</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {todos.map(t => (
                <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)} style={{ accentColor: GREEN, width: 15, height: 15, margin: 0, flex: 'none' }} />
                  <span style={{ color: t.done ? FAINT : todoColor(t.color), fontWeight: t.color ? 600 : 400, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                </label>
              ))}
            </div>
          ), <span style={{ fontSize: 11, color: FAINT }}>{todos.filter(t => !t.done).length}개 남음</span>)}

          {pref.dday && exam && section('고사', (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>{dday > 0 ? 'D-' + dday : dday === 0 ? 'D-DAY' : 'D+' + -dday}</span>
              <span style={{ fontSize: 13, color: SUB }}>{exam.name} · {exam.start.slice(5).replace('-', '.')}</span>
            </div>
          ))}

          {pref.weather && section('날씨', <WeatherLine weather={info.weather} weatherErr={info.weatherErr} place={info.place} size={12.5} />)}
          {pref.meal && section('급식', <MealView meal={info.meal} mealErr={info.mealErr} school={info.school} size={13} />, info.meal && info.meal.length === 1 && info.meal[0].cal ? null : null)}
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
