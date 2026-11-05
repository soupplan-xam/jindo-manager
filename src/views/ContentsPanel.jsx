import React, { useEffect, useRef, useState } from 'react'
import { GREEN, INK, FAINT, LINE, LINE_SOFT, SUB, SECTION_TITLE, CHIP_BTN, subjectOf, contentOf, withContent, sectionKeyOn } from '../logic.js'
import Palette from './Palette.jsx'
import ScheduleCalendar, { CalendarIcon } from './ScheduleCalendar.jsx'

// 차시별 내용: 과목 탭 아래 차시 번호별 입력.
// 여기 적은 내용이 진도표의 같은 구간·차시 칸에 그대로 표시된다.
// 고사 뒤 차시를 1부터 다시 세면 구간(예: 1차 정기시험 전/후)마다 내용을 따로 적는다.
export default function ContentsPanel({ data, setData, computed, today, active, setActive, height, focusNum, weekRange, weekSec, onCollapse, setSnack }) {
  const scrollRef = useRef(null)
  const [adding, setAdding] = useState(false)
  const [newSubj, setNewSubj] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [colorFor, setColorFor] = useState(null) // 색을 고르는 중인 과목

  const min = !!data.cfg.minimal
  const calView = data.cfg.contentsView === 'cal'
  const subj = data.subjects.includes(active) ? active : data.subjects[0]
  const subjClasses = data.classes.filter(c => subjectOf(data, c) === subj)

  // 구간: 고른 구간 → 보고 있는 주의 구간 → 오늘의 구간. 주를 넘기면 다시 그 주를 따라간다.
  const sections = computed.sections || [{ key: 'start', label: '학기' }]
  const [secPick, setSecPick] = useState(null)
  useEffect(() => { setSecPick(null) }, [weekSec])
  const secKeys = sections.map(s => s.key)
  const sec = [secPick, weekSec, sectionKeyOn(sections, today)].find(k => k && secKeys.includes(k)) || 'start'
  const secIdx = secKeys.indexOf(sec)
  const prevSec = secIdx > 0 ? sections[secIdx - 1] : null
  const secHasContent = key => Object.values(((data.secContents || {})[key] || {})[subj] || {}).some(Boolean)
  const showWeek = weekSec === sec
  const copyPrev = () => {
    if (!prevSec) return
    const from = ((data.secContents || {})[prevSec.key] || {})[subj] || {}
    setData(d => {
      const all = { ...(d.secContents || {}) }
      all[sec] = { ...(all[sec] || {}), [subj]: { ...from } }
      return { ...d, secContents: all }
    })
    setSnack && setSnack({ text: prevSec.label + ' ' + subj + ' 내용을 복사했습니다.', kind: 'none', ms: 4000 })
  }

  // 이 과목 반들의 최대 차시 + 여유 5행. 진도가 없어도 최소 15행은 보여 미리 적을 수 있게.
  let maxNum = 0
  let curNum = 0
  subjClasses.forEach(c => {
    const list = (computed.perClass[c] || []).filter(x => (x.sec || 'start') === sec)
    list.forEach(x => {
      if (x.num > maxNum) maxNum = x.num
      if (x.iso <= today && x.num > curNum) curNum = x.num
    })
  })
  const rowCount = Math.max(maxNum, 10) + 5

  const setContent = (num, v) => setData(d => withContent(d, sec, subj, num, v))

  const addSubject = () => {
    const v = newSubj.trim()
    if (v && !data.subjects.includes(v)) {
      setData(d => ({ ...d, subjects: [...d.subjects, v] }))
      setActive(v)
    }
    setAdding(false)
    setNewSubj('')
  }

  const openEdit = () => {
    setDrafts(Object.fromEntries(data.subjects.map(s => [s, s])))
    setColorFor(null)
    setEditMode(true)
  }

  // 과목 색을 정하면 그 과목 반들이 함께 그 색으로 바뀐다 (반에 따로 준 색이 있으면 그게 우선)
  const setSubjectColor = (s, t) => {
    setData(d => ({ ...d, subjectColors: { ...d.subjectColors, [s]: t } }))
    setColorFor(null)
  }
  const clearSubjectColor = s => {
    setData(d => {
      const subjectColors = { ...d.subjectColors }
      delete subjectColors[s]
      return { ...d, subjectColors }
    })
    setColorFor(null)
  }

  // 과목 이름을 한꺼번에 고친다. 내용과 반-과목 연결도 새 이름으로 함께 옮긴다.
  const applyEdit = () => {
    setData(d => {
      const map = {}
      const taken = []
      d.subjects.forEach(s => {
        const v = (drafts[s] ?? s).trim()
        const ok = v && !taken.includes(v)
        map[s] = ok ? v : s
        taken.push(map[s])
      })
      // 구간마다 과목 이름을 옮긴다
      const secContents = {}
      Object.entries(d.secContents || {}).forEach(([k, bySubj]) => {
        secContents[k] = {}
        Object.entries(bySubj).forEach(([s, v]) => { secContents[k][map[s] || s] = v })
      })
      const clsSubject = {}
      Object.entries(d.clsSubject).forEach(([c, s]) => { clsSubject[c] = map[s] || s })
      const subjectColors = {}
      Object.entries(d.subjectColors || {}).forEach(([k, v]) => { subjectColors[map[k] || k] = v })
      setActive(map[subj] || subj)
      return { ...d, subjects: d.subjects.map(s => map[s]), secContents, clsSubject, subjectColors }
    })
    setEditMode(false)
  }

  const deleteSubject = s => {
    if (data.subjects.length <= 1) return
    setData(d => {
      const subjects = d.subjects.filter(x => x !== s)
      const secContents = {}
      Object.entries(d.secContents || {}).forEach(([k, bySubj]) => {
        secContents[k] = { ...bySubj }
        delete secContents[k][s]
      })
      const clsSubject = { ...d.clsSubject }
      Object.keys(clsSubject).forEach(c => { if (clsSubject[c] === s) clsSubject[c] = subjects[0] })
      const subjectColors = { ...d.subjectColors }
      delete subjectColors[s]
      return { ...d, subjects, secContents, clsSubject, subjectColors }
    })
    setDrafts(p => {
      const n = { ...p }
      delete n[s]
      return n
    })
    if (subj === s) setActive(data.subjects.filter(x => x !== s)[0])
  }

  // 보고 있는 주의 음영 구간이 패널 한가운데 오도록 옮긴다 — 주를 넘길 때마다 따라온다.
  const rMin = weekRange ? weekRange.min : focusNum
  const rMax = weekRange ? weekRange.max : focusNum
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !rMin) return
    const run = () => {
      if (el.scrollHeight <= el.clientHeight) return
      const a = el.querySelector('[data-row="' + rMin + '"]')
      const b = el.querySelector('[data-row="' + rMax + '"]') || a
      if (!a) return
      // offsetTop 은 기준 요소가 달라질 수 있어 화면 좌표로 잰다
      const base = el.getBoundingClientRect().top - el.scrollTop
      const mid = (a.getBoundingClientRect().top + b.getBoundingClientRect().bottom) / 2 - base
      // 즉시 이동 — 부드러운 스크롤은 렌더링이 멈춘 탭에서 반영되지 않는다
      el.scrollTop = Math.max(0, mid - el.clientHeight / 2)
    }
    run()
    // 탭 전환·높이 확정 직후에는 레이아웃이 아직이라 다음 프레임에 한 번 더 맞춘다
    const f1 = requestAnimationFrame(() => {
      run()
      requestAnimationFrame(run)
    })
    return () => cancelAnimationFrame(f1)
  }, [rMin, rMax, subj, height, sec])

  const rows = []
  for (let n = 1; n <= rowCount; n++) {
    const isCur = n === curNum
    // 보고 있는 주의 최소~최대 차시를 한 덩어리로 음영 처리
    const inWeek = !!(showWeek && weekRange && n >= weekRange.min && n <= weekRange.max)
    const first = !!(showWeek && weekRange && n === weekRange.min)
    const last = !!(showWeek && weekRange && n === weekRange.max)
    rows.push(
      <div
        key={n}
        data-row={n}
        style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 6px',
          borderBottom: inWeek && !last ? '1px solid rgba(15,92,77,0.10)' : '1px solid ' + LINE_SOFT,
          background: inWeek ? 'rgba(15,92,77,0.06)' : 'transparent',
          borderRadius: first && last ? 5 : first ? '5px 5px 0 0' : last ? '0 0 5px 5px' : 0,
          boxShadow: inWeek ? 'inset 2px 0 0 rgba(15,92,77,0.35)' : 'none',
        }}
      >
        <div style={{ width: 26, textAlign: 'right', fontSize: 13, fontWeight: isCur || inWeek ? 700 : 400, color: isCur ? GREEN : inWeek ? INK : FAINT, flex: 'none' }}>{n}</div>
        <input
          value={contentOf(data, sec, subj, n)}
          onChange={e => setContent(n, e.target.value)}
          placeholder=""
          style={{
            flex: 1, border: 'none', background: 'transparent', fontSize: 13, padding: '2px 0', minWidth: 0,
            color: INK,
          }}
        />
      </div>
    )
  }

  const tabBtn = s => {
    const on = s === subj
    if (editMode) {
      return (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <button
            onClick={() => setColorFor(colorFor === s ? null : s)}
            title="과목 색"
            style={{
              width: 18, height: 18, borderRadius: 4, flex: 'none', cursor: 'pointer', padding: 0,
              background: data.subjectColors[s] || '#FFFFFF',
              border: colorFor === s ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.2)',
            }}
          />
          <input
            value={drafts[s] ?? s}
            onChange={e => setDrafts(p => ({ ...p, [s]: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') applyEdit()
              if (e.key === 'Escape') setEditMode(false)
            }}
            style={{ width: 74, border: '1px solid ' + LINE, borderRadius: 5, background: '#FFFFFF', fontSize: 13, padding: '3px 6px' }}
          />
          {data.subjects.length > 1 && (
            <button onClick={() => deleteSubject(s)} title="과목 삭제" style={{ ...miniBtn, fontSize: 14, lineHeight: 1 }}>×</button>
          )}
        </span>
      )
    }
    return (
      <button
        key={s}
        onClick={() => setActive(s)}
        style={{
          border: 'none', background: 'none', padding: '2px 2px 4px', cursor: 'pointer', fontSize: 14, flex: 'none',
          fontWeight: on ? 700 : 500, color: on ? INK : SUB,
          borderBottom: '2px solid ' + (on ? GREEN : 'transparent'),
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        {data.subjectColors[s] && (
          <span style={{ width: 9, height: 9, borderRadius: 2, background: data.subjectColors[s], border: '1px solid rgba(26,26,26,0.18)', flex: 'none' }} />
        )}
        {s}
      </button>
    )
  }

  return (
    <div style={{ height: height || undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flex: 'none', height: 32, boxSizing: 'border-box' }}>
        {!min && <span style={SECTION_TITLE}>차시별 내용</span>}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setData(d => ({ ...d, cfg: { ...d.cfg, contentsView: d.cfg.contentsView === 'cal' ? 'list' : 'cal' } }))}
          title={calView ? '목록으로 보기' : '달력으로 보기'}
          className="hov"
          style={{
            border: 'none', borderRadius: 6, background: calView ? '#EAF1EE' : 'none',
            color: calView ? GREEN : SUB, padding: 5, cursor: 'pointer', display: 'flex', flex: 'none',
          }}
        >
          <CalendarIcon />
        </button>
        {editMode ? (
          <button
            onClick={applyEdit}
            style={{
              border: 'none', borderRadius: 6, background: GREEN, color: '#FFFFFF',
              padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1,
            }}
          >
            완료
          </button>
        ) : (
          <button
            onClick={openEdit}
            title="과목 이름 한꺼번에 수정"
            style={{
              display: 'flex', alignItems: 'center', border: 'none', borderRadius: 6, background: '#EFEDE8',
              padding: '6px 9px', cursor: 'pointer', color: SUB, lineHeight: 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        )}
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="차시별 내용 접기"
            style={{ ...CHIP_BTN, padding: min ? '6px 8px' : '6px 12px' }}
          >
            {!min && '접기'}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 5 16 12 9 19" />
            </svg>
          </button>
        )}
      </div>
      <div
        className="chip-scroll"
        style={{
          display: 'flex', gap: 12, alignItems: 'center', background: '#F4F2ED',
          border: '1px solid ' + LINE, borderRadius: '6px 6px 0 0', borderBottom: 'none',
          padding: '5px 10px', flex: 'none',
        }}
      >
        {data.subjects.map(tabBtn)}
        {adding ? (
          <input
            value={newSubj}
            onChange={e => setNewSubj(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addSubject()
              if (e.key === 'Escape') { setAdding(false); setNewSubj('') }
            }}
            placeholder="과목명"
            autoFocus
            style={{ width: 74, border: '1px solid ' + LINE, borderRadius: 5, background: '#FFFFFF', fontSize: 13, padding: '3px 6px', flex: 'none' }}
          />
        ) : (
          <button onClick={() => setAdding(true)} title="과목 추가" style={{ border: 'none', background: 'none', padding: '0 2px', cursor: 'pointer', fontSize: 16, color: FAINT, flex: 'none', lineHeight: 1 }}>+</button>
        )}
      </div>
      {editMode && colorFor && (
        <div style={{ border: '1px solid ' + LINE, borderTop: 'none', background: '#FFFFFF', padding: '10px 12px 12px', flex: 'none' }}>
          <div style={{ fontSize: 12, color: FAINT, marginBottom: 8 }}>{colorFor} 과목 색</div>
          <Palette value={data.subjectColors[colorFor] || ''} onPick={t => setSubjectColor(colorFor, t)} />
          {data.subjectColors[colorFor] && (
            <div onClick={() => clearSubjectColor(colorFor)} style={{ ...miniBtn, marginTop: 10, fontSize: 12.5, color: GREEN }}>
              색 지우기
            </div>
          )}
        </div>
      )}
      {sections.length > 1 && !calView && (
        <div style={{ border: '1px solid ' + LINE, borderTop: 'none', borderBottom: 'none', background: '#FFFFFF', padding: '7px 10px 6px', flex: 'none' }}>
          <div role="tablist" aria-label="차시 구간" className="chip-scroll" style={{ display: 'flex', gap: 5 }}>
            {sections.map(s => {
              const on = s.key === sec
              return (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSecPick(s.key)}
                  title={s.key === weekSec ? '보고 있는 주의 구간' : ''}
                  style={{
                    border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 999, padding: '3px 10px', cursor: 'pointer', flex: 'none',
                    background: on ? '#EAF1EE' : '#FFFFFF', color: on ? GREEN : SUB, fontSize: 12, fontWeight: on ? 700 : 500,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          {prevSec && !secHasContent(sec) && secHasContent(prevSec.key) && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: FAINT, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>이 구간은 새로 적습니다.</span>
              <button onClick={copyPrev} style={{ ...miniBtn, color: GREEN, fontWeight: 700, fontSize: 11.5 }}>{prevSec.label} 내용 복사해 오기</button>
            </div>
          )}
        </div>
      )}
      {calView ? (
        // 달력뷰: 날짜 밑 동그라미가 그 날의 최소 차시
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ScheduleCalendar data={data} setData={setData} setSnack={setSnack} computed={computed} subject={subj} />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="soft-scroll"
          style={{
            flex: 1, minHeight: 0, overflowY: height ? 'auto' : 'visible',
            border: '1px solid ' + LINE, borderRadius: '0 0 6px 6px', background: '#FFFFFF', padding: '2px 8px 4px',
          }}
        >
          {rows}
        </div>
      )}
    </div>
  )
}

const miniBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: FAINT }
