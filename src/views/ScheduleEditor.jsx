import React, { useRef, useState } from 'react'
import { DAYS, GREEN, FAINT, INK, LINE, LINE_SOFT, RED, SUB, fromISO, toISO } from '../logic.js'
import { CalendarIcon, XMark, TYPE_COLOR } from './ScheduleCalendar.jsx'
import { DateRangeField } from './DateField.jsx'

const TYPES = ['휴업일', '행사', '고사', '개인']

// 일정 등록 폼 + 목록. 최초 설정 화면과 일정 화면이 함께 쓴다.
// 기간은 시작일~종료일 두 칸(같으면 하루), "+ 기간"으로 띄엄띄엄 여러 구간을 한 번에 넣는다.
export default function ScheduleEditor({ data, setData, computed, setSnack, maxHeight, onImport, onSchools, onToggleView, actions, fill = false }) {
  const min = !!data.cfg.minimal
  const todayISO = toISO(new Date())
  const initDate = data.semStart && todayISO < data.semStart ? data.semStart : todayISO
  const [ranges, setRanges] = useState([{ start: initDate, end: initDate }])
  const [sched, setSched] = useState({ name: '', type: '행사' })
  const patchSched = p => setSched(s => ({ ...s, ...p }))

  const setRange = (i, patch) => setRanges(rs => rs.map((r, j) => {
    if (j !== i) return r
    const n = { ...r, ...patch }
    if (n.end < n.start) n.end = n.start
    return n
  }))
  const addRange = () => setRanges(rs => [...rs, { start: rs[rs.length - 1].end, end: rs[rs.length - 1].end }])
  const removeRange = i => setRanges(rs => rs.filter((_, j) => j !== i))

  const addRef = useRef(null)
  const add = () => {
    if (!sched.name.trim() || !ranges.length || ranges.some(r => !r.start)) {
      setSnack({ text: '날짜와 이름을 확인해주세요.', kind: 'none' })
      return
    }
    const base = Date.now()
    const evs = ranges.map((r, i) => ({
      id: base + i,
      start: r.start,
      end: r.end && r.end >= r.start ? r.end : r.start,
      name: sched.name.trim(),
      type: sched.type,
    }))

    // 어느 반이 몇 시수 빠지는지 미리 계산해 알려준다 (개인 일정도 동일하게 결손 처리)
    const lost = {}
    for (const ev of evs) {
      let d = fromISO(ev.start)
      const last = fromISO(ev.end)
      while (d <= last) {
        const dow = d.getDay()
        const iso = toISO(d)
        if (dow >= 1 && dow <= 5) {
          for (let p = 1; p <= 7; p++) {
            const cls = data.pattern[dow + '-' + p]
            if (!cls) continue
            const ex = computed.sessions[iso + '|' + p]
            if (ex && ex.canceled) continue
            lost[cls] = (lost[cls] || 0) + 1
          }
        }
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      }
    }
    const parts = Object.keys(lost).map(c => c + '반 ' + lost[c] + '시수')
    const text = parts.length ? parts.join(' · ') + ' 결손' : '일정을 추가했습니다.'

    setData(dd => ({ ...dd, events: [...dd.events, ...evs] }))
    setSched(s => ({ ...s, name: '' }))
    setRanges(rs => [rs[0]].map(r => ({ ...r })))
    setSnack({ text, kind: 'events', prev: data.events })
  }

  const remove = id => setData(d => ({ ...d, events: d.events.filter(e => e.id !== id) }))

  const sorted = data.events.slice().sort((a, b) => (a.start < b.start ? -1 : 1))
  const groups = []
  sorted.forEach(ev => {
    const d1 = fromISO(ev.start)
    const label = d1.getMonth() + 1 + '월'
    let g = groups.find(x => x.label === label)
    if (!g) {
      g = { label, rows: [] }
      groups.push(g)
    }
    let date
    if (ev.start === ev.end) date = d1.getDate() + '일 ' + DAYS[d1.getDay()]
    else {
      const d2 = fromISO(ev.end)
      date = d1.getDate() + '–' + (d2.getMonth() + 1) + '.' + d2.getDate()
    }
    g.rows.push({ id: ev.id, date, name: ev.name, type: ev.type })
  })

  const linkBtn = c => ({ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: c })

  addRef.current = add

  return (
    <>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', height: 32, marginTop: 4, flex: 'none' }}>
          <div style={{ flex: 1 }} />
          {actions}
        </div>
      )}
      <div
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        style={{ borderTop: '1px solid ' + LINE, borderBottom: '1px solid ' + LINE, padding: '12px 0 14px', flex: 'none' }}
      >
        <div style={{ display: 'flex', gap: min ? 8 : 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {TYPES.map(tp => (min ? (
            // 미니멀: 글자 없이 유형 색 X 만
            <button
              key={tp}
              onClick={() => patchSched({ type: tp })}
              title={tp}
              style={{
                width: 24, height: 24, borderRadius: 5, cursor: 'pointer', boxSizing: 'border-box',
                border: sched.type === tp ? '2px solid ' + INK : '1px solid rgba(26,26,26,0.15)',
                background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <XMark color={TYPE_COLOR[tp]} />
            </button>
          ) : (
            <button
              key={tp}
              onClick={() => patchSched({ type: tp })}
              style={{
                border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: 13,
                fontWeight: sched.type === tp ? 700 : 400,
                color: sched.type === tp ? INK : FAINT,
                borderBottom: '2px solid ' + (sched.type === tp ? GREEN : 'transparent'),
              }}
            >
              {tp}
            </button>
          )))}
          {/* 아이콘은 유형 줄 오른쪽 끝에 — 기간 줄이 넘치지 않게 */}
          <div style={{ flex: 1 }} />
          {onToggleView && (
            <button onClick={onToggleView} title="달력으로 보기" className="hov" style={iconBtnS}>
              <CalendarIcon />
            </button>
          )}
          {onSchools && (
            <button onClick={onSchools} title="학교 이름으로 학사일정 검색" className="hov" style={iconBtnS}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
            </button>
          )}
          {onImport && (
            <button onClick={onImport} title="학사일정 파일에서 가져오기" className="hov" style={iconBtnS}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 8 12 3 17 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          )}
        </div>

        {/* 기간 여러 줄 — 6.10~6.12, 7.1~7.3 처럼 띄엄띄엄 골라 한 번에 넣는다 */}
        {ranges.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: i === 0 ? 12 : 8, flexWrap: 'wrap' }}>
            <DateRangeField
              start={r.start}
              end={r.end}
              onChange={p => setRange(i, p)}
              refDate={data.semStart}
              keepLength
              labels={['일정 시작일', '일정 종료일']}
              onEnter={() => addRef.current()}
              width={140}
            />
            {ranges.length > 1 && (
              <button onClick={() => removeRange(i)} title="이 기간 빼기" style={{ ...linkBtn(FAINT), fontSize: 15, lineHeight: 1 }}>×</button>
            )}
            {i === ranges.length - 1 && (
              <button onClick={addRange} title="기간 추가" style={{ ...linkBtn(GREEN), fontSize: min ? 16 : 12, fontWeight: 700, lineHeight: 1 }}>
                {min ? '+' : '+ 기간'}
              </button>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 12 }}>
          <input
            value={sched.name}
            onChange={e => patchSched({ name: e.target.value })}
            placeholder="일정 이름"
            style={{ ...uInput, flex: 1, minWidth: 0 }}
          />
          {min ? (
            <button
              onClick={add}
              title="추가"
              style={{
                width: 26, height: 26, border: 'none', borderRadius: '50%', flex: 'none',
                background: sched.name.trim() ? GREEN : '#EBEEF2', color: '#FFFFFF',
                cursor: sched.name.trim() ? 'pointer' : 'default', fontSize: 16, fontWeight: 700, lineHeight: 1,
              }}
            >
              +
            </button>
          ) : (
            <button onClick={add} style={{ ...linkBtn(GREEN), fontSize: 14, fontWeight: 700 }}>추가</button>
          )}
        </div>
      </div>

      <div
        className="soft-scroll"
        style={{
          maxHeight, flex: fill ? 1 : undefined, minHeight: 0,
          overflowY: maxHeight || fill ? 'auto' : 'visible', paddingRight: maxHeight || fill ? 6 : 0,
        }}
      >
        {groups.length === 0 && <div style={{ paddingTop: 18, fontSize: 13, color: FAINT }}>등록된 일정이 없습니다.</div>}
        {groups.map(g => (
          <div key={g.label} style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 13, borderRadius: 2, background: GREEN, flex: 'none' }} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>{g.label}</span>
            </div>
            {g.rows.map(r => {
              const tp = r.type === '휴업일' ? '휴업' : r.type
              const badge = TYPE_BADGE[tp] || TYPE_BADGE.기본
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto', gap: 10, padding: min ? '8px 0' : '11px 0', borderBottom: '1px solid ' + LINE_SOFT, fontSize: 14, alignItems: 'center' }}>
                  <div style={{ color: SUB, fontSize: 13 }}>{r.date}</div>
                  <div style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  {min ? (
                    <span title={tp} style={{ display: 'flex', flex: 'none' }}><XMark color={TYPE_COLOR[r.type] || SUB} /></span>
                  ) : (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 7px', borderRadius: 4, lineHeight: 1, background: badge.bg, color: badge.fg, flex: 'none' }}>{tp}</span>
                  )}
                  <button onClick={() => remove(r.id)} title="삭제" style={{ ...linkBtn(FAINT), fontSize: min ? 15 : 12, lineHeight: 1 }}>{min ? '×' : '삭제'}</button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

const uInput = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '6px 8px', boxSizing: 'border-box' }
const iconBtnS = { border: 'none', background: 'none', padding: 4, borderRadius: 8, cursor: 'pointer', color: SUB, display: 'flex', flex: 'none' }

// 유형 배지 — 한눈에 성격이 구분되도록 유형별 색을 준다
const TYPE_BADGE = {
  고사: { bg: '#F6E0DC', fg: '#A32D2D' },
  행사: { bg: '#F4E8CE', fg: '#854F0B' },
  휴업: { bg: '#E2E8E2', fg: '#3F5C4C' },
  개인: { bg: '#DFE6F2', fg: '#185FA5' },
  기본: { bg: '#EBEEF2', fg: '#4E5968' },
}
