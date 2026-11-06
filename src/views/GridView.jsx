import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, RED, SECTION_TITLE, CHIP_BTN, CHIP_BTN_OFF, addDays, fromISO, toISO, colorOf, subjectOf, progressFor, progressGroups, contentOf, withContent, ddayText, upcomingDdays, printSizes, fitScale } from '../logic.js'
import ContentsPanel from './ContentsPanel.jsx'
import useTodayInfo from '../useTodayInfo.js'
import { WeatherLine, MealView, periodLabel, NOW_BG } from './TodayCards.jsx'
import DateField from './DateField.jsx'
import Palette from './Palette.jsx'
import useWindowWidth from '../useWindowWidth.js'
import useSplit from '../useSplit.js'

export default function GridView({ data, setData, computed, today, setSnack, go, goImport, weekOffset, setWeekOffset, stagger, fit }) {
  const { sessions, perClass, exam } = computed
  const cfg = data.cfg
  const min = !!cfg.minimal
  const { isMobile } = useWindowWidth()
  const [pop, setPop] = useState(null) // {key, mode:'menu'|'edit', draft}
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSubject, setActiveSubject] = useState(data.subjects[0] || '수학')
  const [mtab, setMtab] = useState('grid') // 모바일 탭: grid | dash | contents
  const [printOpen, setPrintOpen] = useState(false)
  const [printRemember, setPrintRemember] = useState(true)
  const [printAs, setPrintAs] = useState(null) // 이번 인쇄에 쓸 {scale, weeks} (기억 안 함 선택 대비)
  const [pickWeeks, setPickWeeks] = useState(data.cfg.printWeeks || 1) // 인쇄 메뉴에서 고른 범위
  const [gridH, setGridH] = useState(null)
  const gridRef = useRef(null)
  const touchRef = useRef(null)
  const { wrapRef, splitPct, dragging, startDrag } = useSplit(data, setData)

  useEffect(() => {
    const close = () => {
      setPop(null)
      setMenuOpen(false)
      setPrintOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // 한 화면 모드에서는 표가 남은 높이를 채우므로 패널도 100%로 맞추면 된다.
  // 그 외에는 표 높이를 재서 패널에 넘겨준다.
  useLayoutEffect(() => {
    if (!gridRef.current || isMobile || fit) {
      setGridH(null)
      return
    }
    const measure = () => gridRef.current && setGridH(gridRef.current.getBoundingClientRect().height)
    measure() // ResizeObserver는 비동기라 첫 값은 직접 잰다
    const ro = new ResizeObserver(measure)
    ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [isMobile, fit])

  const setUI = p => setData(d => ({ ...d, ui: { ...d.ui, ...p } }))
  const showContents = data.ui.contentsOpen

  const t = fromISO(today)
  // 주말에는 이미 지난 주가 아니라 다음 주 월요일부터 보여준다
  const dow0 = t.getDay()
  const mon0 = addDays(t, 1 - (dow0 || 7) + (dow0 === 0 || dow0 === 6 ? 7 : 0))
  // 보고 있는 주에서 off 주 뒤의 월~금. 인쇄에서 2주치를 뽑을 때 다음 주도 이 함수로 만든다.
  const weekOf = off => {
    const m = addDays(mon0, (weekOffset + off) * 7)
    const ds = []
    for (let i = 0; i < 5; i++) {
      const d = addDays(m, i)
      const iso = toISO(d)
      ds.push({ iso, label: DAYS[d.getDay()] + ' ' + d.getDate(), isToday: iso === today })
    }
    const f = addDays(m, 4)
    return { mon: m, fri: f, days: ds, label: m.getMonth() + 1 + '.' + m.getDate() + ' – ' + (f.getMonth() + 1) + '.' + f.getDate() }
  }
  const week = weekOf(0)
  const mon = week.mon
  const fri = week.fri
  const days = week.days
  const weekLabel = week.label

  const semD = data.semStart ? fromISO(data.semStart) : t
  const semM = semD.getMonth() + 1
  const semLabel = semD.getFullYear() + '-' + (semM >= 3 && semM <= 7 ? '1' : '2') + '학기'

  // 칸 내용 = 차시별 내용(contents)에서 파생. 칸에서 고치면 같은 과목·차시의 모든 칸에 반영된다.
  // 칸 내용 = 그 구간(고사로 나뉜 차시 구간)의 차시별 내용. 칸에서 고치면 같은 구간·과목·차시의 모든 칸에 반영된다.
  const contentAt = (cls, num, sec) => contentOf(data, sec || 'start', subjectOf(data, cls), num)
  const setContent = (cls, num, v, sec) => setData(d => withContent(d, sec || 'start', subjectOf(d, cls), num, v))

  const clearCancel = (key, msg) => {
    setData(d => {
      const c = { ...d.cancels }
      delete c[key]
      return { ...d, cancels: c }
    })
    setPop(null)
    setSnack({ text: msg, kind: 'none' })
  }

  // 그 날만의 보강·교체. 시간표는 그대로 두고 그 칸만 바꾼다.
  // kind: 'swap'(교환 — 진도 셈) | 'makeup'(보강 — 진도 안 셈)
  const undoExtras = { kind: 'extras', prev: data.extras, prevKind: data.extraKind || {}, prevClasses: data.classes }
  const withKind = (d, key, kind) => {
    const k = { ...(d.extraKind || {}) }
    if (kind) k[key] = kind
    else delete k[key]
    return k
  }
  const setExtra = (key, cls, kind = 'swap') => {
    const before = sessions[key]
    setData(d => {
      const next = { ...d.extras, [key]: cls }
      const classes = d.classes.includes(cls) ? d.classes : [...d.classes, cls]
      const makeups = { ...(d.makeups || {}) }
      delete makeups[key]
      return { ...d, extras: next, extraKind: withKind(d, key, kind), classes, makeups }
    })
    setPop(null)
    const label = kind === 'makeup' ? '보강' : '교환'
    setSnack({
      text: kind === 'makeup'
        ? cls + ' 보강을 넣었습니다. 진도 차시는 세지 않습니다.'
        : before && before.cls !== cls
          ? before.cls + ' 대신 ' + cls + ' ' + label + ' 수업으로 바꿨습니다.'
          : before
            ? cls + ' ' + label + ' 수업으로 표시했습니다. 진도 차시에 셉니다.'
            : cls + ' ' + label + ' 수업을 넣었습니다. 진도 차시에 셉니다.',
      ...undoExtras,
    })
  }
  // 수업을 다른 시간으로 옮긴 날 — 원래 칸은 비운다. 그 반의 뒤 차시가 하나씩 당겨진다.
  // 칸 메모 — 그 날 그 칸에만 남는다(수행평가 결시 번호 등). 차시별 내용과 따로 둔다
  const notes = data.notes || {}
  const saveNote = (key, text) => {
    const prev = notes
    const v = text.trim()
    setData(d => {
      const n = { ...(d.notes || {}) }
      if (v) n[key] = v
      else delete n[key]
      return { ...d, notes: n }
    })
    setPop(null)
    setSnack({ text: v ? '메모를 저장했습니다.' : '메모를 지웠습니다.', kind: 'notes', prev, ms: 4000 })
  }

  // 보강 — 반이 아니라 장소로 적는다. 진도를 세지 않고 회색으로 보인다
  const setMakeup = (key, place) => {
    const prev = data.makeups || {}
    setData(d => ({ ...d, makeups: { ...(d.makeups || {}), [key]: { place } } }))
    setPop(null)
    setSnack({ text: (place ? place + ' ' : '') + '보강을 넣었습니다. 진도 차시는 세지 않습니다.', kind: 'makeups', prev })
  }
  const clearMakeup = key => {
    const prev = data.makeups || {}
    setData(d => {
      const makeups = { ...(d.makeups || {}) }
      delete makeups[key]
      return { ...d, makeups }
    })
    setPop(null)
    setSnack({ text: '보강을 지웠습니다.', kind: 'makeups', prev })
  }
  // 매주 고정 시간(창체 등) — 요일·교시에 이름만 붙인다. 반이 아니고 진도를 세지 않는다
  const fixedKey = key => { const [iso, p] = key.split('|'); return fromISO(iso).getDay() + '-' + p }
  const setFixed = (key, name) => {
    if (!name) return
    const prev = data.fixed || {}
    const fk = fixedKey(key)
    setData(d => ({ ...d, fixed: { ...(d.fixed || {}), [fk]: name } }))
    setPop(null)
    setSnack({ text: '매주 ' + DAYS[Number(fk[0])] + ' ' + fk.split('-')[1] + '교시를 「' + name + '」으로 채웠습니다. 진도는 세지 않습니다.', kind: 'fixed', prev })
  }
  const clearFixed = key => {
    const prev = data.fixed || {}
    const fk = fixedKey(key)
    setData(d => { const f = { ...(d.fixed || {}) }; delete f[fk]; return { ...d, fixed: f } })
    setPop(null)
    setSnack({ text: '매주 ' + DAYS[Number(fk[0])] + ' ' + fk.split('-')[1] + '교시 고정 시간을 지웠습니다.', kind: 'fixed', prev })
  }
  const fixedNames = [...new Set(['창체', ...Object.values(data.fixed || {})])].slice(0, 6)
  const recentPlaces = [...new Set(Object.values(data.makeups || {}).map(m => m.place).filter(Boolean))].slice(-6)

  // swap 이면 '교환으로 빠짐' 표시를 남긴다
  const dropCell = (key, kind = null) => {
    const before = sessions[key]
    setData(d => ({ ...d, extras: { ...d.extras, [key]: '' }, extraKind: withKind(d, key, kind) }))
    setPop(null)
    setSnack({
      text: (before ? before.cls + ' ' : '') + (kind === 'swap' ? '수업을 교환으로 비웠습니다. 바꾼 시간 칸을 눌러 교환 수업을 넣으세요.' : '수업을 이 칸에서 뺐습니다.'),
      ...undoExtras,
    })
  }
  const clearExtra = key => {
    setData(d => {
      const next = { ...d.extras }
      delete next[key]
      return { ...d, extras: next, extraKind: withKind(d, key, null) }
    })
    setPop(null)
    setSnack({ text: '원래 시간표로 되돌렸습니다.', ...undoExtras })
  }

  // 결손·수행평가 모두 차시를 소모하지 않으므로 뒤 차시가 밀린다.
  const markCell = (key, kind, reason = '') => {
    const s = sessions[key]
    if (!s) return
    // 이미 결손인 칸은 사유만 고친다
    if (s.canceled) {
      setData(d => ({ ...d, cancels: { ...d.cancels, [key]: { ...(d.cancels[key] || {}), reason } } }))
      setPop(null)
      setSnack({ text: reason ? '결손 사유를 「' + reason + '」(으)로 고쳤습니다.' : '결손 사유를 지웠습니다.', kind: 'none' })
      return
    }
    if (!s.num) return
    const examStart = exam ? exam.start : null
    const cnt = (perClass[s.cls] || []).filter(x => x.num > s.num && (!examStart || x.iso < examStart)).length
    setData(d => ({ ...d, cancels: { ...d.cancels, [key]: { reason, kind } } }))
    setPop(null)
    setSnack({
      text: (kind === 'perf' ? '수행평가로 표시했습니다. ' : reason ? '「' + reason + '」 결손. ' : '') + s.num + '차시 이후 ' + cnt + '개 차시가 이동했습니다.',
      kind: 'cancel', key, canReason: kind !== 'perf' && !reason,
    })
  }

  let idx = 0
  const mkNum = num => {
    const i = idx++
    return (
      <span
        key={num + (stagger ? '-s' : '')}
        style={{
          display: 'inline-block', fontSize: isMobile ? 15 : 19, fontWeight: 700, lineHeight: 1.1,
          animation: cfg.anim ? 'numSlide 200ms ease both' : 'none',
          animationDelay: stagger ? i * 40 + 'ms' : '0ms',
        }}
      >
        {num}
      </span>
    )
  }

  // 칸 팝오버 — 표가 잘리지 않도록 화면 좌표(fixed)로 띄운다.
  const popCell = pop ? sessions[pop.key] : null
  const popPerf = !!(popCell && popCell.perf)
  const popExtra = !!(popCell && popCell.extra) || !!(pop && data.extras[pop.key])
  const W = 214
  const popover = pop && (
    <div
      onClick={e => e.stopPropagation()}
      data-print="hide"
      style={{
        position: 'fixed', width: W, background: '#FFFFFF', border: '1px solid ' + LINE, borderRadius: 8,
        boxShadow: '0 10px 28px rgba(26,26,26,0.16)', zIndex: 80, textAlign: 'left', cursor: 'default',
        maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', boxSizing: 'border-box',
        left: Math.max(8, Math.min(pop.x, window.innerWidth - W - 8)),
        top: Math.max(8, Math.min(pop.y + 2, window.innerHeight - (pop.mode === 'color' ? 250 : pop.mode === 'pick' ? 280 : pop.mode === 'loss' ? 200 : pop.mode === 'note' ? 210 : 370))),
      }}
    >
      <div style={{ padding: '9px 14px', fontSize: 13, color: SUB, borderBottom: '1px solid ' + LINE_SOFT }}>
        {popTitle(pop.key, sessions)}
      </div>
      {pop.mode === 'menu' && popCell && (
        <>
          {popCell.activity ? (
            <>
              <div style={{ ...menuItem(true), cursor: 'default', color: SUB }}>매주 고정 시간 · 진도에 세지 않음</div>
              <div className="hov2" onClick={() => setPop({ ...pop, mode: 'pick', kind: 'fixed', place: popCell.place })} style={menuItem(false)}>이름 고치기</div>
              <div className="hov2" onClick={() => clearFixed(pop.key)} style={{ ...menuItem(false), color: WARN, paddingBottom: 11 }}>매주 고정 시간 지우기</div>
            </>
          ) : popCell.makeup ? (
            <>
              <div style={{ ...menuItem(true), cursor: 'default', color: SUB }}>보강 · 진도에 세지 않음</div>
              <div className="hov2" onClick={() => setPop({ ...pop, mode: 'pick', kind: 'makeup', place: popCell.place })} style={menuItem(false)}>장소 고치기</div>
              <div className="hov2" onClick={() => clearMakeup(pop.key)} style={{ ...menuItem(false), color: WARN, paddingBottom: 11 }}>보강 지우기</div>
            </>
          ) : popCell.canceled ? (
            <>
              <div className="hov2" onClick={() => clearCancel(pop.key, popPerf ? '수행평가 표시를 해제했습니다.' : '결손을 해제했습니다.')} style={menuItem(true)}>
                {popPerf ? '수행평가 해제' : '결손 해제'}
              </div>
              {!popPerf && popCell.user && (
                <div className="hov2" onClick={() => setPop({ ...pop, mode: 'loss', reason: data.cancels[pop.key]?.reason || '' })} style={menuItem(false)}>
                  결손 사유 {data.cancels[pop.key]?.reason ? '고치기' : '입력'}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="hov2" onClick={() => setPop({ ...pop, mode: 'loss', reason: '' })} style={menuItem(true)}>결손 처리…</div>
              <div className="hov2" onClick={() => markCell(pop.key, 'perf')} style={{ ...menuItem(false), color: RED, fontWeight: 600 }}>수행평가</div>
            </>
          )}
          <div className="hov2" onClick={() => setPop({ ...pop, mode: 'note', note: notes[pop.key] || '' })} style={menuItem(false)}>
            {notes[pop.key] ? '메모 고치기' : '메모'} <span style={{ fontSize: 11.5, color: FAINT }}>· 이 칸에만</span>
          </div>
          {!popCell.canceled && <div className="hov2" onClick={() => setPop({ ...pop, mode: 'edit' })} style={menuItem(false)}>차시 내용 편집 <span style={{ fontSize: 11.5, color: FAINT }}>· 같은 차시 모두</span></div>}
          {!popCell.canceled && !popCell.swap && (
            <div className="hov2" onClick={() => setExtra(pop.key, popCell.cls, 'swap')} style={menuItem(false)}>교환 수업으로 표시</div>
          )}
          {!popCell.makeup && !popCell.activity && (
            <>
          <div className="hov2" onClick={() => dropCell(pop.key, 'swap')} style={menuItem(false)}>교환으로 비우기</div>
          <div className="hov2" onClick={() => dropCell(pop.key)} style={menuItem(false)}>이 칸 삭제</div>
          <div className="hov2" onClick={() => setPop({ ...pop, mode: 'color' })} style={{ ...menuItem(false), display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 11 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: colorOf(data, popCell.cls), border: '1px solid rgba(26,26,26,0.18)', flex: 'none' }} />
            반 색 바꾸기
          </div>
          {popExtra && (
            <div className="hov2" onClick={() => clearExtra(pop.key)} style={{ ...menuItem(false), color: WARN }}>원래 시간표로</div>
          )}
            </>
          )}
        </>
      )}
      {pop.mode === 'note' && (
        <form onSubmit={e => { e.preventDefault(); saveNote(pop.key, pop.note || '') }} style={{ padding: '10px 14px 12px' }}>
          <label htmlFor="cell-note" style={{ display: 'block', fontSize: 12, color: FAINT, marginBottom: 7 }}>이 칸 메모 (다른 반·다른 날에는 안 보입니다)</label>
          <textarea
            id="cell-note"
            value={pop.note || ''}
            onChange={e => setPop({ ...pop, note: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); saveNote(pop.key, pop.note || '') } }}
            placeholder="예: 3, 15번 결시"
            rows={3}
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: FAINT, flex: 1 }}>Shift+Enter 줄바꿈</span>
            {notes[pop.key] && (
              <button type="button" onClick={() => saveNote(pop.key, '')} style={{ ...linkBtn, color: WARN, marginRight: 14 }}>지우기</button>
            )}
            <button type="submit" style={{ ...linkBtn, fontWeight: 700 }}>저장</button>
          </div>
        </form>
      )}
      {pop.mode === 'loss' && (
        <form
          onSubmit={e => { e.preventDefault(); markCell(pop.key, 'loss', (pop.reason || '').trim()) }}
          style={{ padding: '10px 14px 12px' }}
        >
          <label htmlFor="loss-reason" style={{ display: 'block', fontSize: 12, color: FAINT, marginBottom: 7 }}>결손 사유 (비워 둬도 됩니다)</label>
          <input
            id="loss-reason"
            value={pop.reason || ''}
            onChange={e => setPop({ ...pop, reason: e.target.value })}
            placeholder="예: 출장"
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {LOSS_REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setPop({ ...pop, reason: r })}
                style={{
                  border: '1px solid ' + (pop.reason === r ? GREEN : LINE), borderRadius: 999, padding: '3px 9px', cursor: 'pointer',
                  background: pop.reason === r ? '#E9F6FE' : '#FFFFFF', color: pop.reason === r ? GREEN : SUB, fontSize: 12,
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="submit" style={{ ...linkBtn, fontWeight: 700 }}>{popCell && popCell.canceled ? '사유 저장' : '결손 처리'}</button>
          </div>
        </form>
      )}
      {pop.mode === 'pick' && (
        <div style={{ padding: '10px 14px 12px' }}>
          <div role="radiogroup" aria-label="수업 종류" style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {[['swap', '교환', '진도 셈'], ['makeup', '보강', '진도 안 셈'], ['fixed', '고정', '매주 · 창체 등']].map(([k, t, note]) => {
              const on = (pop.kind || 'swap') === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPop({ ...pop, kind: k })}
                  style={{
                    flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 8, padding: '5px 4px', cursor: 'pointer',
                    background: on ? '#E9F6FE' : '#FFFFFF', color: on ? GREEN : SUB, lineHeight: 1.25,
                  }}
                >
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{t}</span>
                  <span style={{ display: 'block', fontSize: 10.5 }}>{note}</span>
                </button>
              )
            })}
          </div>
          {pop.kind === 'fixed' ? (
            <form onSubmit={e => { e.preventDefault(); setFixed(pop.key, (pop.place || '').trim()) }}>
              <label htmlFor="fixed-name" style={{ display: 'block', fontSize: 12, color: FAINT, marginBottom: 7 }}>매주 이 요일·교시에 채울 이름 (반이 아니고 진도를 세지 않아요. 그 날 일은 칸 메모로)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id="fixed-name"
                  value={pop.place || ''}
                  onChange={e => setPop({ ...pop, place: e.target.value })}
                  placeholder="예: 창체"
                  autoFocus
                  style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px' }}
                />
                <button type="submit" style={{ ...linkBtn, fontWeight: 700, flex: 'none' }}>저장</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {fixedNames.map(nm => (
                  <button key={nm} type="button" onClick={() => setFixed(pop.key, nm)}
                    style={{ border: '1px solid ' + LINE, borderRadius: 999, padding: '3px 9px', cursor: 'pointer', background: ACT_BG, color: SUB, fontSize: 12 }}>{nm}</button>
                ))}
              </div>
            </form>
          ) : (pop.kind || 'swap') === 'makeup' ? (
            <form onSubmit={e => { e.preventDefault(); setMakeup(pop.key, (pop.place || '').trim()) }}>
              <label htmlFor="makeup-place" style={{ display: 'block', fontSize: 12, color: FAINT, marginBottom: 7 }}>어디서 하나요? (반으로 등록되지 않습니다)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id="makeup-place"
                  value={pop.place || ''}
                  onChange={e => setPop({ ...pop, place: e.target.value })}
                  placeholder="예: 2-9 교실, 과학실"
                  autoFocus
                  style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px' }}
                />
                <button type="submit" style={{ ...linkBtn, fontWeight: 700, flex: 'none' }}>저장</button>
              </div>
              {recentPlaces.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {recentPlaces.map(pl => (
                    <button
                      key={pl}
                      type="button"
                      onClick={() => setMakeup(pop.key, pl)}
                      style={{ border: '1px solid ' + LINE, borderRadius: 999, padding: '3px 9px', cursor: 'pointer', background: MAKEUP_BG, color: SUB, fontSize: 12 }}
                    >
                      {pl}
                    </button>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>어느 반 수업인가요?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.classes.map(c => (
              <button
                key={c}
                onClick={() => setExtra(pop.key, c, pop.kind || 'swap')}
                style={{
                  border: '1px solid rgba(26,26,26,0.16)', borderRadius: 5, cursor: 'pointer',
                  background: colorOf(data, c), color: INK, padding: '5px 9px',
                  fontSize: 12.5, fontWeight: 700, lineHeight: 1,
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <input
              value={pop.draft || ''}
              onChange={e => setPop({ ...pop, draft: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && (pop.draft || '').trim()) setExtra(pop.key, pop.draft.trim(), pop.kind || 'swap') }}
              placeholder="새 반 이름"
              style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px' }}
            />
            <button
              onClick={() => { const v = (pop.draft || '').trim(); if (v) setExtra(pop.key, v, pop.kind || 'swap') }}
              style={{ ...linkBtn, fontWeight: 700, flex: 'none' }}
            >
              추가
            </button>
          </div>
            </>
          )}
          {data.extras[pop.key] === '' && (
            <div onClick={() => clearExtra(pop.key)} style={{ ...linkBtn, color: WARN, marginTop: 10, fontSize: 12.5 }}>
              원래 시간표로 되돌리기
            </div>
          )}
        </div>
      )}
      {pop.mode === 'edit' && (
        <div style={{ padding: '11px 14px 12px' }}>
          <input
            value={pop.draft}
            onChange={e => setPop({ ...pop, draft: e.target.value })}
            placeholder="내용"
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={() => { if (popCell.num) setContent(popCell.cls, popCell.num, pop.draft, popCell.sec); setPop(null) }}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: GREEN }}
            >
              저장
            </button>
          </div>
        </div>
      )}
      {pop.mode === 'color' && (
        <div style={{ padding: '11px 14px 13px' }}>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>{popCell.cls}</div>
          <Palette
            simple
            value={colorOf(data, popCell.cls)}
            onPick={t => {
              setData(d => ({ ...d, colors: { ...d.colors, [popCell.cls]: t } }))
              setPop(null)
            }}
          />
          {/* 반에 따로 준 색을 지우면 그 반은 다시 과목 색을 따라간다 */}
          {data.colors[popCell.cls] && (
            <div
              onClick={() => {
                setData(d => {
                  const colors = { ...d.colors }
                  delete colors[popCell.cls]
                  return { ...d, colors }
                })
                setPop(null)
              }}
              style={{ ...linkBtn, marginTop: 10, fontSize: 12.5 }}
            >
              {subjectOf(data, popCell.cls)} 과목 색 따르기
            </div>
          )}
        </div>
      )}
    </div>
  )

  // 이번 주에 해당하는 차시 번호 — 차시별 내용 패널을 이 위치로 스크롤한다.
  // 이 주의 구간 — 주 안에 구간이 갈리면(고사 주) 더 많은 칸이 속한 구간
  const secCount = {}
  days.forEach(day => {
    for (let p = 1; p <= 7; p++) {
      const s = sessions[day.iso + '|' + p]
      if (s && !s.canceled && subjectOf(data, s.cls) === activeSubject) secCount[s.sec] = (secCount[s.sec] || 0) + 1
    }
  })
  const weekSec = Object.keys(secCount).sort((a, b) => secCount[b] - secCount[a])[0] || null
  const weekNums = []
  days.forEach(day => {
    for (let p = 1; p <= 7; p++) {
      const s = sessions[day.iso + '|' + p]
      if (s && !s.canceled && s.sec === weekSec && subjectOf(data, s.cls) === activeSubject) weekNums.push(s.num)
    }
  })
  const focusNum = weekNums.length ? Math.round(weekNums.reduce((a, b) => a + b, 0) / weekNums.length) : null
  // 그 주의 최소~최대 차시를 한 덩어리로 표시한다
  const weekRange = weekNums.length ? { min: Math.min(...weekNums), max: Math.max(...weekNums) } : null

  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = days.map(day => {
      const key = day.iso + '|' + p
      const s = sessions[key]
      const cont = s && !s.canceled ? contentAt(s.cls, s.num, s.sec) : ''
      // 빈 칸도 누를 수 있다 — 보강이 생기거나 수업을 바꿔 하는 날이 있으므로.
      // 다만 휴업일·행사로 그 시간 자체가 없는 날은 그대로 둔다.
      const dayOff = !s && data.events.some(e => e.start <= day.iso && day.iso <= e.end && (!e.period || e.period === p))
      const clickable = s ? !s.canceled || s.user || s.makeup || s.activity : !dayOff
      const perf = !!(s && s.perf)
      return (
        <div
          key={key}
          onClick={clickable ? e => {
            e.stopPropagation()
            // 칸을 누르면 차시별 내용도 그 반의 과목으로 따라간다
            if (s && !s.makeup && !s.activity) setActiveSubject(subjectOf(data, s.cls))
            // 표가 overflow:hidden 이라 팝오버는 화면 좌표로 띄운다
            const r = e.currentTarget.getBoundingClientRect()
            setPop({ key, mode: s ? 'menu' : 'pick', draft: s ? cont : '', x: r.left, y: r.bottom })
            setMenuOpen(false)
          } : undefined}
          style={{
            position: 'relative', minHeight: fit ? 0 : 58, padding: 0,
            boxSizing: 'border-box', minWidth: 0, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: clickable ? 'pointer' : 'default',
            boxShadow: day.isToday ? 'inset 1px 0 0 rgba(18, 132, 202,0.4), inset -1px 0 0 rgba(18, 132, 202,0.4)' : 'none',
            background: s && s.activity ? ACT_BG : s && s.makeup ? MAKEUP_BG : s && !s.canceled ? colorOf(data, s.cls) : '#FFFFFF',
          }}
        >
          {/* 교환으로 비운 칸 — 수업이 다른 시간으로 옮겨 갔다는 흔적 */}
          {!s && data.extras[key] === '' && (data.extraKind || {})[key] === 'swap' && (
            <div style={{ padding: isMobile ? '4px 5px' : '6px 9px', fontSize: isMobile ? 9.5 : 11.5, color: FAINT }}>교환으로 빠짐</div>
          )}
          {/* 윗줄: 반은 왼쪽, 차시는 오른쪽 끝 — 숫자가 한 열로 정렬돼 훑기 쉽다 */}
          {s && (
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: isMobile ? 3 : 5, minWidth: 0, flex: 1,
                padding: isMobile ? '4px 5px 2px' : '6px 9px 4px',
                position: 'relative',
              }}
            >
              {/* 결손·수행평가 모두 차시를 쓰지 않으므로 같은 빗금 배경을 쓴다 */}
              {s.canceled && !s.makeup && !s.activity && (
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent 0,transparent 5px,rgba(26,26,26,0.06) 5px,rgba(26,26,26,0.06) 6px)' }} />
              )}
              {/* 그 날만의 보강·교체라는 표시 */}
              {s.extra && !s.swap && !s.makeup && (
                <span
                  title="이 날만의 수업"
                  style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, flex: 'none', alignSelf: 'center', position: 'relative' }}
                />
              )}
              <span style={{ ...ellip(isMobile ? 10 : 12, 600), color: s.canceled && !s.makeup && !s.activity ? FAINT : SUB, minWidth: 0, position: 'relative' }}>{s.makeup || s.activity ? s.place : s.cls}</span>
              <div style={{ flex: 1 }} />
              {s.swap && <span title="교환 수업 — 진도에 셉니다" style={{ fontSize: isMobile ? 9.5 : 11, fontWeight: 700, color: GREEN, position: 'relative', flex: 'none' }}>교환</span>}
              {s.makeup && <span title="보강 — 진도에 세지 않습니다" style={{ fontSize: isMobile ? 10 : 12, fontWeight: 700, color: SUB, position: 'relative', flex: 'none' }}>보강</span>}
              {!s.canceled && mkNum(s.num)}
              {perf && (min
                ? <span title="수행평가" style={{ width: 8, height: 8, borderRadius: '50%', background: RED, position: 'relative', flex: 'none', alignSelf: 'center' }} />
                : <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 700, color: RED, position: 'relative', flex: 'none' }}>{isMobile ? '수행' : '수행평가'}</span>
              )}
              {s.canceled && !perf && !s.makeup && !s.activity && !min && (
                <span style={{ fontSize: isMobile ? 9 : 12, color: SUB, position: 'relative', minWidth: 0, ...ellipBase }}>{s.reason}</span>
              )}
            </div>
          )}
          {/* 칸 메모 — 그 날 그 칸에만. 휴대폰에서는 한 줄로 줄인다 */}
          {s && notes[key] && (
            <div
              title={notes[key]}
              style={{
                position: 'relative', padding: isMobile ? '0 5px 2px' : '0 9px 3px', fontSize: isMobile ? 9.5 : 11, lineHeight: 1.3,
                color: NOTE_FG, fontWeight: 600, flex: 'none', minWidth: 0, ...ellipBase,
              }}
            >
              ✎ {notes[key].replace(/\n/g, ' · ')}
            </div>
          )}
          {/* 아랫단: 내용은 옅은 흰 띠 위에 — 미니멀에서도 그대로 보인다 */}
          {s && !s.canceled && (isMobile ? !!cont : true) && (
            <div style={{ background: 'rgba(255,255,255,0.62)', padding: isMobile ? '2px 5px 3px' : '3px 9px 4px', flex: 'none' }}>
              {isMobile ? (
                <div style={{ fontSize: 10, color: INK, ...ellipBase }}>{cont}</div>
              ) : (
                <input
                  value={cont}
                  onChange={e => setContent(s.cls, s.num, e.target.value, s.sec)}
                  onFocus={() => setActiveSubject(subjectOf(data, s.cls))}
                  onClick={e => e.stopPropagation()}
                  placeholder="내용"
                  style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', fontSize: 12, color: INK, padding: 0, minWidth: 0 }}
                />
              )}
            </div>
          )}
        </div>
      )
    })
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: isMobile ? '6px 0 0 0' : '8px 0 0 10px', fontSize: isMobile ? 10 : 12, color: FAINT, textAlign: isMobile ? 'center' : 'left' }}>{p}</div>
        {cells}
      </div>
    )
  }

  const doPrint = scale => {
    if (printRemember) setData(d => ({ ...d, cfg: { ...d.cfg, printScale: scale, printWeeks: pickWeeks } }))
    setPrintAs({ scale, weeks: pickWeeks })
    setPrintOpen(false)
    setTimeout(() => {
      window.print()
      setPrintAs(null)
    }, 150)
  }

  const printButton = (
    <div data-print="hide" style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={e => {
          e.stopPropagation()
          if (!printOpen) setPickWeeks(cfg.printWeeks || 1) // 열 때마다 저장된 범위에서 시작
          setPrintOpen(!printOpen)
          setPop(null)
          setMenuOpen(false)
        }}
        style={{ ...CHIP_BTN, padding: min ? '6px 8px' : '6px 12px' }}
      >
        <PrinterIcon />
        {!min && '인쇄'}
      </button>
      {printOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: 34, width: 208, background: '#FFFFFF', border: '1px solid ' + LINE,
            borderRadius: 8, boxShadow: '0 8px 24px rgba(26,26,26,0.12)', padding: '6px 0', zIndex: 60,
          }}
        >
          <div style={{ padding: '2px 12px 8px', borderBottom: '1px solid ' + LINE_SOFT, marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[[1, '이번 주'], [2, '2주치']].map(([n, label]) => {
                const on = pickWeeks === n
                return (
                  <button
                    key={n}
                    onClick={() => setPickWeeks(n)}
                    style={{
                      flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 8, cursor: 'pointer',
                      background: on ? GREEN : '#FFFFFF', color: on ? '#FFFFFF' : SUB,
                      padding: '6px 0', fontSize: 12.5, fontWeight: on ? 700 : 500,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {pickWeeks > 1 && (
              <div style={{ marginTop: 6, fontSize: 11, color: FAINT, textAlign: 'center' }}>
                {weekLabel} + {weekOf(1).label}
              </div>
            )}
          </div>
          {printSizes(pickWeeks).map(({ k, label, note }) => {
            const on = fitScale(cfg.printScale || 'l', pickWeeks) === k
            return (
              <div
                key={k}
                className="hov2"
                onClick={() => doPrint(k)}
                style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer' }}
              >
                <span style={{ fontWeight: on ? 700 : 400 }}>{label}</span>
                <span style={{ fontSize: 11, color: FAINT }}>{note[pickWeeks > 1 ? 2 : 1]}</span>
                <div style={{ flex: 1 }} />
                {on && <span style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>✓</span>}
              </div>
            )
          })}
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px 8px', marginTop: 4, borderTop: '1px solid ' + LINE_SOFT, fontSize: 12, color: SUB, cursor: 'pointer' }}
          >
            <input type="checkbox" checked={printRemember} onChange={e => setPrintRemember(e.target.checked)} style={{ accentColor: GREEN, margin: 0 }} />
            이 기준 기억하기
          </label>
        </div>
      )}
    </div>
  )

  // 시간표 칼럼 안에 두어야 차시별 내용 제목줄과 높이가 맞는다
  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, marginBottom: 8, flex: 'none', height: 32, boxSizing: 'border-box' }}>
      <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{weekLabel}</div>
      {!isMobile && !min && <div style={{ fontSize: 12, color: FAINT }}>{semLabel}</div>}
      {printButton}
      <div style={{ flex: 1 }} />
      <div data-print="hide" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button className="hov" onClick={() => { setWeekOffset(weekOffset - 1); setPop(null) }} title="이전 주" style={navBtn('arrow')}>‹</button>
        <button className="hov" onClick={() => { setWeekOffset(0); setPop(null) }} style={navBtn('text')}>오늘</button>
        <button className="hov" onClick={() => { setWeekOffset(weekOffset + 1); setPop(null) }} title="다음 주" style={navBtn('arrow')}>›</button>
        {/* 요약(대시보드) 접기·펴기 — 화면 컨트롤을 이 줄에 모은다 */}
        {!isMobile && (
          <button
            onClick={() => setUI({ dashOpen: !data.ui.dashOpen })}
            title={data.ui.dashOpen ? '요약 접기' : '요약 펴기'}
            style={{
              ...(data.ui.dashOpen ? CHIP_BTN : CHIP_BTN_OFF),
              marginLeft: 6, padding: min ? '6px 8px' : '6px 12px',
            }}
          >
            <SummaryIcon open={data.ui.dashOpen} />
            {!min && '요약'}
          </button>
        )}
        {!isMobile && !showContents && (
          <button
            onClick={() => setUI({ contentsOpen: true })}
            title="차시별 내용 펴기"
            style={{ ...CHIP_BTN_OFF, marginLeft: 6, padding: min ? '6px 8px' : '6px 12px' }}
          >
            <PanelIcon open={false} />
            {!min && '차시별 내용'}
          </button>
        )}
      </div>
    </div>
  )

  const table = (
    <div
      ref={gridRef}
      style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', overflow: 'hidden', height: fit ? '100%' : undefined }}
    >
      <div
        style={{
          display: 'grid', gridTemplateColumns: (isMobile ? '22px' : '34px') + ' repeat(5,minmax(0,1fr))',
          gridTemplateRows: fit ? 'auto repeat(7, minmax(0,1fr))' : undefined, height: fit ? '100%' : undefined,
        }}
      >
        <div style={{ background: '#F2F4F6' }} />
        {days.map(day => (
          <div
            key={day.iso}
            style={{
              padding: isMobile ? '6px 4px 5px' : '8px 10px 7px', borderLeft: '1px solid ' + LINE_SOFT,
              fontSize: isMobile ? 11 : 13, textAlign: isMobile ? 'center' : 'left',
              color: day.isToday ? GREEN : SUB, background: day.isToday ? '#E9F6FE' : '#F2F4F6',
              ...ellipBase,
            }}
          >
            <span style={{ borderBottom: '2px solid ' + (day.isToday ? GREEN : 'transparent'), paddingBottom: 2, fontWeight: 700 }}>{day.label}</span>
          </div>
        ))}
        {rows}
      </div>
    </div>
  )

  // 인쇄 전용 시트 — 화면 레이아웃을 그대로 찍지 않고, 종이에 맞게 정돈된 표를 내보낸다.
  // 크기는 배율 축소가 아니라 지면별로 따로 조판한다 (한 주 기준):
  //   크게 = A4 한 장 · 중간 = 상단 절반(행 압축) · 작게 = 좌상단 1/4(폭 절반, 반+차시만)
  // 2주치는 이 덩어리를 두 번 쌓으므로, 두 장이 되는 '크게'는 아예 고를 수 없다 (printSizes).
  // 인쇄할 주: 1이면 보고 있는 주만, 2면 다음 주까지
  const nWeeks = (printAs && printAs.weeks) || cfg.printWeeks || 1
  // 2주치에 '크게'는 고를 수 없지만, 예전에 저장된 조합이면 여기서 한 장짜리로 내린다
  const pscale = fitScale((printAs && printAs.scale) || cfg.printScale || 'l', nWeeks)
  const printWeeks = nWeeks > 1 ? [week, weekOf(1)] : [week]
  const P = {
    l: { width: '100%', rowH: 90, cls: 11.5, num: 15, cont: 10.5, title: 19, sub: 12, day: 12, dayPad: '6px 4px', pcol: 26, showCont: true },
    m: { width: '100%', rowH: 52, cls: 10, num: 13, cont: 9.5, title: 15, sub: 10.5, day: 10.5, dayPad: '4px 3px', pcol: 20, showCont: true },
    s: { width: '50%', rowH: 34, cls: 9, num: 11.5, cont: 0, title: 12.5, sub: 9.5, day: 9.5, dayPad: '3px 2px', pcol: 15, showCont: false },
  }[pscale]
  const pth = { border: '1px solid #A7B0BA', background: '#EEF1F4', padding: P.dayPad, fontSize: P.day, fontWeight: 700, textAlign: 'center', color: '#333' }
  const ptd = { border: '1px solid #A7B0BA', height: P.rowH, verticalAlign: 'top', padding: 0, overflow: 'hidden' }
  // 한 주 = 제목줄 + 표 한 벌. 2주치는 이 덩어리를 두 번 쌓는다.
  // break-inside: avoid 덕분에 한 주가 지면에 다 안 들어가면 통째로 다음 장으로 넘어간다.
  const weekBlock = (w, i) => (
    <div key={w.days[0].iso} style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: i ? (P.rowH > 40 ? 14 : 10) : 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: P.rowH > 40 ? 8 : 5 }}>
        <span style={{ fontSize: P.title, fontWeight: 800, letterSpacing: '-0.01em' }}>{w.label}</span>
        <span style={{ fontSize: P.sub, color: '#666' }}>{semLabel} 진도계획표</span>
        <span style={{ flex: 1 }} />
        {P.showCont && !i && <span style={{ fontSize: 11, color: '#888' }}>인쇄 {today}</span>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: P.pcol }} />
          {w.days.map(d => <col key={d.iso} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={pth} />
            {w.days.map(day => <th key={day.iso} style={pth}>{day.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map(p => (
            <tr key={p}>
              <td style={{ ...ptd, background: '#F2F4F6', textAlign: 'center', verticalAlign: 'middle', fontSize: Math.max(9, P.day - 1.5), color: '#777' }}>{p}</td>
              {w.days.map(day => {
                const s = sessions[day.iso + '|' + p]
                if (!s) return <td key={day.iso} style={ptd} />
                if (s.activity) {
                  return (
                    <td key={day.iso} style={{ ...ptd, background: ACT_BG }}>
                      <div style={{ padding: '4px 6px', fontSize: P.cls, fontWeight: 700, color: '#555' }}>{s.place}</div>
                      {P.showCont && notes[day.iso + '|' + p] && <div style={{ padding: '0 6px 4px', fontSize: Math.max(8.5, P.cont - 0.5), lineHeight: 1.35, color: NOTE_FG, wordBreak: 'break-all' }}>✎ {notes[day.iso + '|' + p]}</div>}
                    </td>
                  )
                }
                if (s.makeup) {
                  return (
                    <td key={day.iso} style={{ ...ptd, background: MAKEUP_BG }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 6px' }}>
                        <span style={{ fontSize: P.cls, fontWeight: 700, color: '#555' }}>{s.place}</span>
                        <span style={{ fontSize: Math.max(8.5, P.cls - 1), color: '#555', marginLeft: 'auto' }}>보강</span>
                      </div>
                    </td>
                  )
                }
                if (s.canceled && !s.perf) {
                  return (
                    <td key={day.iso} style={{ ...ptd, background: 'repeating-linear-gradient(45deg,#FFF 0,#FFF 5px,#F2F4F6 5px,#F2F4F6 6px)' }}>
                      <div style={{ display: 'flex', flexDirection: P.showCont ? 'column' : 'row', gap: P.showCont ? 0 : 4, alignItems: P.showCont ? 'stretch' : 'center', height: P.showCont ? undefined : '100%', padding: P.showCont ? '4px 6px' : '0 5px' }}>
                        <span style={{ fontSize: P.cls, fontWeight: 700, color: '#999' }}>{s.cls}</span>
                        {P.showCont && <span style={{ fontSize: Math.max(8.5, P.cls - 1), color: '#777' }}>{s.reason}</span>}
                        {P.showCont && notes[day.iso + '|' + p] && <span style={{ fontSize: Math.max(8.5, P.cls - 1), color: NOTE_FG, wordBreak: 'break-all' }}>✎ {notes[day.iso + '|' + p]}</span>}
                      </div>
                    </td>
                  )
                }
                const cont = s.canceled || !P.showCont ? '' : contentAt(s.cls, s.num, s.sec)
                return (
                  <td key={day.iso} style={{ ...ptd, background: colorOf(data, s.cls) }}>
                    <div
                      style={{
                        display: 'flex', justifyContent: 'space-between', gap: 5,
                        alignItems: P.showCont ? 'baseline' : 'center',
                        height: P.showCont ? undefined : '100%',
                        padding: P.showCont ? '4px 6px 0' : '0 5px',
                      }}
                    >
                      <span style={{ fontSize: P.cls, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.cls}</span>
                      {s.canceled
                        ? <span style={{ fontSize: P.cls, fontWeight: 700, color: RED, flex: 'none' }}>{P.showCont ? '수행평가' : '수행'}</span>
                        : <span style={{ fontSize: P.num, fontWeight: 700, flex: 'none' }}>{s.num}</span>}
                    </div>
                    {cont && (
                      <div style={{ padding: '2px 6px 5px', fontSize: P.cont, lineHeight: 1.4, color: '#222', wordBreak: 'break-all' }}>{cont}</div>
                    )}
                    {P.showCont && notes[day.iso + '|' + p] && (
                      <div style={{ padding: '0 6px 4px', fontSize: Math.max(8.5, P.cont - 0.5), lineHeight: 1.35, color: NOTE_FG, wordBreak: 'break-all' }}>✎ {notes[day.iso + '|' + p]}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const printSheet = (
    <div className="print-sheet" style={{ width: P.width }}>
      {printWeeks.map(weekBlock)}
    </div>
  )

  // 모바일: 좌우로 밀어 주를 넘긴다
  const swipe = {
    onTouchStart: e => {
      const t0 = e.touches[0]
      touchRef.current = { x: t0.clientX, y: t0.clientY }
    },
    onTouchEnd: e => {
      const s0 = touchRef.current
      if (!s0) return
      touchRef.current = null
      const t1 = e.changedTouches[0]
      const dx = t1.clientX - s0.x
      const dy = t1.clientY - s0.y
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      setPop(null)
      setWeekOffset(weekOffset + (dx < 0 ? 1 : -1))
    },
  }

  // 모바일: 진도표 · 대시보드 · 차시별 내용을 탭으로 나눠 각각 한 화면에 담는다.
  if (isMobile) {
    const tab = (id, label) => (
      <button
        key={id}
        onClick={() => setMtab(id)}
        style={{
          flex: 1, border: 'none', background: mtab === id ? '#FFFFFF' : 'transparent',
          borderRadius: 8, padding: '7px 0', cursor: 'pointer',
          fontSize: 13, fontWeight: mtab === id ? 700 : 500, color: mtab === id ? INK : SUB,
          boxShadow: mtab === id ? '0 1px 3px rgba(26,26,26,0.10)' : 'none',
        }}
      >
        {label}
      </button>
    )
    return (
      <>
      <div data-print="hide" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 3, background: '#E8EBEF', borderRadius: 12, padding: 3, marginBottom: 10, flex: 'none' }}>
          {tab('grid', '진도표')}
          {tab('dash', '대시보드')}
          {tab('contents', '차시별 내용')}
        </div>

        {mtab === 'grid' && (
          <>
            {toolbar}
            <div {...swipe} style={{ flex: 1, minHeight: 0 }}>{table}</div>
          </>
        )}
        {mtab === 'dash' && (
          <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <DashStrip data={data} setData={setData} computed={computed} today={today} setUI={setUI} setWeekOffset={setWeekOffset} mon0={mon0} isMobile alwaysOpen />
          </div>
        )}
        {mtab === 'contents' && (
          <>
            {/* 음영 구간이 주차에 따라 달라지므로 여기서도 주를 옮길 수 있어야 한다 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flex: 'none', height: 32, boxSizing: 'border-box' }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{weekLabel}</div>
              <div style={{ flex: 1 }} />
              <button className="hov" onClick={() => setWeekOffset(weekOffset - 1)} title="이전 주" style={navBtn('arrow')}>‹</button>
              <button className="hov" onClick={() => setWeekOffset(0)} style={navBtn('text')}>오늘</button>
              <button className="hov" onClick={() => setWeekOffset(weekOffset + 1)} title="다음 주" style={navBtn('arrow')}>›</button>
            </div>
            <div {...swipe} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} height="100%" focusNum={focusNum} weekRange={weekRange} weekSec={weekSec} setSnack={setSnack} />
            </div>
          </>
        )}
        {popover}
      </div>
      {printSheet}
      </>
    )
  }

  return (
    <>
    <div data-print="hide" style={{ width: '100%', maxWidth: 1320, margin: '0 auto', height: fit ? '100%' : undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <DashStrip data={data} setData={setData} computed={computed} today={today} setUI={setUI} setWeekOffset={setWeekOffset} mon0={mon0} isMobile={isMobile} />

      <div ref={wrapRef} style={{ display: 'flex', alignItems: fit ? 'stretch' : 'flex-start', flex: fit ? 1 : undefined, minHeight: fit ? 300 : 0 }}>
        <div style={{ width: showContents ? splitPct + '%' : '100%', minWidth: 0, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {toolbar}
          <div style={{ flex: fit ? 1 : undefined, minHeight: 0 }}>{table}</div>
          {exam && toISO(fri) < exam.start && !fit && (
            <div style={{ marginTop: 20, borderTop: '1px solid ' + LINE, paddingTop: 8, fontSize: 12, color: FAINT }}>
              {exam.name} 이전 구간
            </div>
          )}
        </div>
        {showContents && (
          <div
            data-print="hide"
            onMouseDown={startDrag}
            title="드래그해서 너비 조절"
            style={{ width: 18, alignSelf: 'stretch', cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
          >
            <div style={{ width: 3, borderRadius: 2, background: dragging ? GREEN : '#DDE2E7' }} />
          </div>
        )}
        {showContents && (
          <div data-print="hide" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} height={fit ? '100%' : gridH} focusNum={focusNum} weekRange={weekRange} weekSec={weekSec} setSnack={setSnack} onCollapse={() => setUI({ contentsOpen: false })} />
          </div>
        )}
      </div>
      {popover}
    </div>
    {printSheet}
    </>
  )
}

// 대시보드: 한눈에 읽히는 게 목적이라 숫자를 키우고 라벨은 눌러 위계를 만든다.
function DashStrip({ data, setData, computed, today, setUI, setWeekOffset, mon0, isMobile, alwaysOpen }) {
  const { sessions, perClass, exam } = computed
  const min = !!data.cfg.minimal
  const open = alwaysOpen || data.ui.dashOpen
  const rowRef = useRef(null)
  const [dragW, setDragW] = useState(null)

  // 카드 사이 손잡이를 끌어 너비를 나눈다. 안쪽 항목은 너비에 맞춰 자동으로 줄을 바꾼다.
  const startWDrag = (aKey, bKey) => e => {
    e.preventDefault()
    const rect = rowRef.current.getBoundingClientRect()
    const base = { ...(dragW || data.ui.dashW) }
    const startX = e.clientX
    const pair = base[aKey] + base[bKey]
    const move = ev => {
      const d = ((ev.clientX - startX) / rect.width) * 100
      const a = Math.min(pair - 8, Math.max(8, base[aKey] + d))
      setDragW({ ...base, [aKey]: a, [bKey]: pair - a })
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      setDragW(w => {
        if (w) setUI({ dashW: w })
        return null
      })
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }
  const todayD = fromISO(today)
  const dateLabel = todayD.getMonth() + 1 + '.' + todayD.getDate() + ' ' + DAYS[todayD.getDay()] + '요일'

  const todayRows = []
  for (let p = 1; p <= 7; p++) {
    const s = sessions[today + '|' + p]
    if (s) todayRows.push({ p, cls: s.cls, place: s.place, makeup: s.makeup, activity: s.activity, num: s.num, canceled: s.canceled, perf: s.perf, reason: s.reason })
  }

  const curOf = c => progressFor(data, computed, c, today).current
  // 진도 칸에는 진도를 세는 반만 — 보강으로만 들어간 반(정규 시간표에 없고 센 차시도 없는 반)은 뺀다
  const regular = new Set(Object.values(data.pattern))
  const progClasses = data.classes.filter(c => regular.has(c) || (perClass[c] || []).length)
  // 같은 학년·과목 묶음 안에서 가장 빠른 반과 견준다 (1학년과 2학년은 따로 센다)
  const groups = progressGroups(data, progClasses)
  const maxOf = {}
  groups.forEach(g => g.classes.forEach(c => { maxOf[c] = Math.max(...g.classes.map(curOf), 0) }))
  const behindOf = c => (maxOf[c] || 0) - curOf(c)

  const goBehind = c => {
    const ent = Object.entries(sessions).find(kv => kv[1].cls === c && kv[1].canceled)
    if (!ent) return
    const iso = ent[0].split('|')[0]
    const dm = fromISO(iso)
    const m = addDays(dm, 1 - (dm.getDay() || 7))
    setWeekOffset(Math.round((m - mon0) / (7 * 86400000)))
  }

  const dday = exam ? Math.round((fromISO(exam.start) - todayD) / 86400000) : null
  const ddays = upcomingDdays(data, today)
  const [ddAdd, setDdAdd] = useState(null) // { name, date } 넣는 중
  // 최대 차시보다 2차시 이상 느린 반 — 고사 카드에서 경고로 보여준다
  const risky = progClasses
    .map(c => ({ c, behind: behindOf(c) }))
    .filter(x => x.behind >= 2)
    .sort((a, b) => b.behind - a.behind)
  const chip = c => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: colorOf(data, c), border: '1px solid rgba(26,26,26,0.16)', flex: 'none' })
  const show = data.cfg.dash
  const tileCount = (show.today ? 1 : 0) + (show.progress ? 1 : 0) + (show.exam ? 1 : 0) + (show.meal ? 1 : 0)
  const info = useTodayInfo(data, { meal: !!show.meal, weather: !!show.meal })
  const nowP = info.today === today ? info.period : null
  // 반이 많아도 겹치지 않도록 칸 최소 너비를 정해두고 자동으로 줄을 채운다.
  const autoCols = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '6px 12px' }
  // 손잡이 폭을 뺀 나머지를 비율대로 나눠 갖는다
  const rawW = dragW || data.ui.dashW
  const growOf = k => rawW[k] || 1
  const handle = (a, b) => (
    <div
      onMouseDown={startWDrag(a, b)}
      title="드래그해서 너비 조절"
      style={{ width: 10, alignSelf: 'stretch', cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
    >
      <div style={{ width: 3, borderRadius: 2, background: dragW ? GREEN : 'transparent' }} />
    </div>
  )

  return (
    <div data-print="hide" style={{ marginBottom: open ? 12 : 0, flex: 'none' }}>
      {/* 접기 버튼은 아래 툴바에 있다 — 여기서 한 줄을 쓰지 않는다 */}

      {open && tileCount > 0 && (
        <div
          ref={rowRef}
          style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0, alignItems: 'stretch' }}
        >
          {/* 오늘의 수업 */}
          {show.today && (
            <Tile label="오늘" sub={dateLabel + (todayRows.length && nowP ? ' · ' + periodLabel(nowP) : '')} min={min} grow={isMobile ? undefined : growOf('today')}>
              {todayRows.length === 0 ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: FAINT }}>수업 없음</div>
              ) : (
                <div style={autoCols}>
                  {todayRows.map(r => {
                    const isNow = nowP && nowP.kind === 'class' && nowP.period === r.p
                    const isNext = nowP && nowP.kind !== 'class' && nowP.next === r.p
                    return (
                    <div key={r.p} style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, flexWrap: 'nowrap', borderRadius: 6, margin: '-2px -6px', padding: '2px 6px', background: isNow ? NOW_BG : 'transparent', boxShadow: isNext ? 'inset 0 0 0 1px #C6E6FA' : 'none' }}>
                      <span style={{ fontSize: 11, color: isNow ? GREEN : FAINT, fontWeight: isNow ? 700 : 400, flex: 'none' }}>{isNow ? '지금' : r.p + '교시'}</span>
                      <span style={{ ...chip(r.cls), ...(r.activity ? { background: ACT_BG } : r.makeup ? { background: MAKEUP_BG } : null), alignSelf: 'center' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, minWidth: 0, ...ellipBase }}>{r.makeup || r.activity ? r.place || '보강' : r.cls}</span>
                      {r.activity ? null : r.canceled ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.perf ? RED : FAINT, ...ellipBase }}>{r.perf ? '수행' : r.reason}</span>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{r.num}</span>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </Tile>
          )}

          {!isMobile && show.today && show.progress && handle('today', 'progress')}

          {/* 반별 진도 */}
          {show.progress && (
            <Tile label="진도" sub={exam ? exam.name + '까지' : '학기 말까지'} min={min} grow={isMobile ? undefined : growOf('progress')}>
              {progClasses.length === 0 ? (
                <div style={{ fontSize: 13, color: FAINT }}>등록된 반이 없습니다</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {groups.map(g => (
                <div key={g.key}>
                {groups.length > 1 && g.label && (
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: FAINT, marginBottom: 3, letterSpacing: '0.02em' }}>{g.label}</div>
                )}
                <div style={autoCols}>
                  {g.classes.map(c => {
                    const cur = curOf(c)
                    const { total, remaining } = progressFor(data, computed, c, today)
                    const behind = behindOf(c)
                    return (
                      <div key={c} style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, flexWrap: 'nowrap' }}>
                        <span style={{ ...chip(c), alignSelf: 'center' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 0, ...ellipBase }}>{c}</span>
                        <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, flex: 'none' }}>{cur}</span>
                        <span style={{ fontSize: 11, color: FAINT, flex: 'none' }}>/{total}</span>
                        <span style={{ fontSize: 11, color: GREEN, flex: 'none' }}>남은 {remaining}</span>
                        {behind > 0 && (
                          <button
                            onClick={() => goBehind(c)}
                            title={(g.label || '같은 묶음') + '에서 가장 빠른 반보다 ' + behind + '차시 뒤처짐'}
                            style={{
                              border: 'none', borderRadius: 3, padding: '1px 4px', cursor: 'pointer',
                              fontSize: 10, fontWeight: 700, color: '#FFFFFF', background: WARN, lineHeight: 1.3, flex: 'none',
                            }}
                          >
                            −{behind}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                </div>
                ))}
                </div>
              )}
            </Tile>
          )}

          {!isMobile && show.progress && show.exam && handle('progress', 'exam')}

          {/* 고사 — D-day와, 최대 차시보다 2차시 이상 느린 반 */}
          {show.exam && (
            <Tile label={exam ? exam.name : 'D-day'} sub={exam ? exam.start.slice(5).replace('-', '.') : ''} min={min} grow={isMobile ? undefined : growOf('exam')} minWidth={isMobile ? undefined : 180}>
              {exam ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'nowrap', flex: 'none' }}>
                    D-{dday}
                  </div>
                  {risky.length > 0 && (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: WARN, marginBottom: 2 }}>진도 주의</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
                        {risky.map(x => (
                          <button
                            key={x.c}
                            onClick={() => goBehind(x.c)}
                            title={'같은 학년에서 가장 빠른 반보다 ' + x.behind + '차시 뒤처짐'}
                            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: WARN, whiteSpace: 'nowrap' }}
                          >
                            {x.c} −{x.behind}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              {/* 직접 넣은 D-day */}
              <div style={{ marginTop: exam ? 10 : 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ddays.map(d => (
                  <div key={d.id} className="dd-row" style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: d.days <= 7 ? WARN : INK, letterSpacing: '-0.02em', flex: 'none', minWidth: 44 }}>{ddayText(d.days)}</span>
                    <span style={{ fontSize: 12.5, color: INK, minWidth: 0, flex: 1, wordBreak: 'keep-all', lineHeight: 1.35 }}>
                      {d.name} <span style={{ fontSize: 11, color: FAINT, whiteSpace: 'nowrap' }}>{d.date.slice(5).replace('-', '.')}</span>
                    </span>
                    <button type="button" onClick={() => setData(x => ({ ...x, ddays: (x.ddays || []).filter(y => y.id !== d.id) }))} aria-label={d.name + ' D-day 지우기'} className="dd-x" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: FAINT, fontSize: 13, lineHeight: 1, flex: 'none' }}>×</button>
                  </div>
                ))}
                {ddAdd ? (
                  <form onSubmit={e => { e.preventDefault(); if (!ddAdd.name.trim() || !ddAdd.date) return; setData(x => ({ ...x, ddays: [...(x.ddays || []), { id: Date.now(), name: ddAdd.name.trim(), date: ddAdd.date }] })); setDdAdd(null) }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <input aria-label="D-day 이름" value={ddAdd.name} onChange={e => setDdAdd(v => ({ ...v, name: e.target.value }))} placeholder="이름 (예: 수행평가 마감)" autoFocus style={{ border: '1px solid ' + LINE, borderRadius: 8, fontSize: 12.5, padding: '5px 8px', minWidth: 0 }} />
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <DateField value={ddAdd.date} onChange={v => setDdAdd(x => ({ ...x, date: v }))} label="D-day 날짜" width={136} />
                      <button type="submit" style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '5px 10px', cursor: 'pointer' }}>넣기</button>
                      <button type="button" onClick={() => setDdAdd(null)} style={{ border: 'none', background: 'none', color: FAINT, fontSize: 12, cursor: 'pointer', padding: 0 }}>취소</button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => setDdAdd({ name: '', date: today })} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: GREEN }}>+ D-day</button>
                )}
              </div>
            </Tile>
          )}

          {!isMobile && show.meal && (show.exam || show.progress || show.today) && handle(show.exam ? 'exam' : show.progress ? 'progress' : 'today', 'meal')}

          {/* 급식 · 날씨 */}
          {show.meal && (
            <Tile label="급식 · 날씨" min={min} grow={isMobile ? undefined : growOf('meal')} minWidth={isMobile ? undefined : 220}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <WeatherLine weather={info.weather} weatherErr={info.weatherErr} place={info.place} size={12.5} />
                {/* 급식 메뉴는 접어 두고, 볼 때 편다(이 기기에서만 기억) */}
                <div style={{ borderTop: '1px solid ' + LINE_SOFT, paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setUI({ mealOpen: !data.ui.mealOpen })}
                    aria-expanded={!!data.ui.mealOpen}
                    style={{ border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%', fontSize: 12.5, fontWeight: 700, color: SUB }}
                  >
                    <span>{data.ui.mealOpen ? '▾' : '▸'} 오늘 급식</span>
                    {info.meal && info.meal.length > 0 && (
                      <span style={{ fontWeight: 400, color: FAINT, fontSize: 11.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(info.meal.find(m => m.meal === '중식') || info.meal[0]).dishes.length}가지{(info.meal.find(m => m.meal === '중식') || info.meal[0]).cal ? ' · ' + (info.meal.find(m => m.meal === '중식') || info.meal[0]).cal.replace(/\s*Kcal/i, ' kcal') : ''}
                      </span>
                    )}
                  </button>
                  {data.ui.mealOpen && (
                    <div style={{ marginTop: 6 }}>
                      <MealView meal={info.meal} mealErr={info.mealErr} school={info.school} size={13} only="중식" />
                    </div>
                  )}
                </div>
              </div>
            </Tile>
          )}
        </div>
      )}
    </div>
  )
}

function Tile({ label, sub, children, grow, min, minWidth }) {
  return (
    <div
      style={{
        border: 'none', borderRadius: 16, background: '#FFFFFF', padding: '12px 16px 14px', boxShadow: '0 1px 3px rgba(25,31,40,0.05)',
        minWidth: minWidth || 0, flex: grow ? grow + ' 1 0' : undefined, boxSizing: 'border-box',
      }}
    >
      {/* 미니멀: 라벨은 걷어내되 날짜·기간 같은 정보(sub)는 남긴다 */}
      {(!min || sub) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
          {!min && <span style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{label}</span>}
          {sub && <span style={{ fontSize: 12, color: FAINT }}>{sub}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

function PrinterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 3 18 3 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  )
}

// 위쪽 요약 카드가 열렸는지 보이는 아이콘
function SummaryIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      {open && <line x1="12" y1="4" x2="12" y2="10" />}
    </svg>
  )
}

// 오른쪽 패널이 열렸는지 닫혔는지 한눈에 보이는 아이콘
function PanelIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="14" y1="4" x2="14" y2="20" />
      {open ? <polyline points="19 9 16.5 12 19 15" /> : <polyline points="16 9 18.5 12 16 15" />}
    </svg>
  )
}

function Chevron({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }}>
      <polyline points="5 9 12 16 19 9" />
    </svg>
  )
}

function popTitle(key, sessions) {
  const [iso, ps] = key.split('|')
  const s = sessions[key]
  const dd = fromISO(iso)
  const when = dd.getMonth() + 1 + '.' + dd.getDate() + ' ' + DAYS[dd.getDay()] + ' ' + ps + '교시'
  if (!s) return when + ' · 빈 시간'
  if (s.activity) return when + ' · ' + s.place + ' (매주 고정)'
  if (s.makeup) return when + ' · 보강' + (s.place ? ' · ' + s.place : '')
  return s.cls + ' · ' + when + (s.num ? ' · ' + s.num + '차시' : '')
}

const ellipBase = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const ellip = (size, weight) => ({ fontSize: size, fontWeight: weight, lineHeight: 1.3, ...ellipBase })
// 보강 칸 — 진도를 세지 않는 수업이라 반 색 대신 회색
const MAKEUP_BG = '#E8EBEF'
const ACT_BG = '#EFEBFA' // 매주 고정 시간(창체 등)
// 칸 메모 글씨 — 진한 갈색이라 파랑·노랑·회색 칸 위에서 모두 읽힌다
const NOTE_FG = '#7A4B12'
const LOSS_REASONS = ['출장', '연수', '학교 행사', '학급 사정', '시험 감독']
const menuItem = first => ({ padding: first ? '9px 14px' : '9px 14px', fontSize: 14, cursor: 'pointer', fontWeight: first ? 600 : 400 })
const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }
const navBtn = kind => ({
  border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer', color: SUB,
  padding: kind === 'arrow' ? '3px 9px 5px' : '6px 9px',
  fontSize: kind === 'arrow' ? 19 : 13, fontWeight: kind === 'arrow' ? 400 : 600, lineHeight: 1,
})
