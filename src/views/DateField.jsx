import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, fromISO, toISO } from '../logic.js'
import { parseDateText, formatDateText, shiftRange } from '../dateText.js'
import useWindowWidth from '../useWindowWidth.js'

// 날짜 입력 — 브라우저 기본 날짜 칸 대신 쓴다.
// · 글자로 바로 친다: 10.12 / 1012 / 2026-10-12 / 10월 12일 (연도는 기준일에 가까운 해로)
// · 달력 아이콘을 누르면 달력이 뜬다. range 모드에서는 시작일·종료일을 한 달력에서 두 번 눌러 고른다.
// · 엔터로 확정하고(onEnter가 있으면 이어서 호출), Esc로 되돌린다.

export default function DateField({ value, onChange, near, min, placeholder = '예: 10.12', label, style, onEnter, width = 148 }) {
  // 고치는 중일 때만 친 글자(draft)를 들고, 평소에는 저장된 값을 그대로 보여 준다
  const [draft, setDraft] = useState(null)
  const [bad, setBad] = useState(false)
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const skipBlur = useRef(false) // Esc로 되돌린 뒤에는 칸을 떠날 때 다시 검사하지 않는다
  const text = draft ?? formatDateText(value)

  useEffect(() => { setBad(false) }, [value])

  const commit = () => {
    if (draft == null) return value
    if (!draft.trim()) { setDraft(null); setBad(false); return value }
    const iso = parseDateText(draft, near || value)
    if (!iso || (min && iso < min)) { setBad(true); return null }
    setBad(false)
    setDraft(null)
    if (iso !== value) onChange(iso)
    return iso
  }

  return (
    <span ref={anchor} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: 'none', ...style }}>
      <input
        aria-label={label}
        aria-invalid={bad || undefined}
        title={bad ? (min && parseDateText(text, near || value) ? '시작일보다 앞설 수 없습니다' : '날짜를 알아볼 수 없습니다. 예: 10.12, 2026.10.12') : '10.12처럼 바로 입력하거나 달력에서 고르세요'}
        value={text}
        placeholder={placeholder}
        inputMode="numeric"
        onFocus={e => e.target.select()}
        onBlur={() => { if (skipBlur.current) { skipBlur.current = false; return } if (!bad) commit() }}
        onChange={e => { setDraft(e.target.value); setBad(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation() // 바깥 엔터 처리(일정 추가)가 바뀌기 전 날짜를 쓰지 않도록
            const iso = commit()
            if (iso && onEnter) setTimeout(() => onEnter(iso), 0)
          } else if (e.key === 'Escape') {
            skipBlur.current = true; setDraft(null); setBad(false); e.target.blur()
          } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && value) {
            // 위·아래 화살표로 하루씩
            e.preventDefault()
            const d = fromISO(value)
            d.setDate(d.getDate() + (e.key === 'ArrowUp' ? 1 : -1))
            const iso = toISO(d)
            if (!min || iso >= min) { onChange(iso); setDraft(null) }
          }
        }}
        style={{
          width, boxSizing: 'border-box', border: '1px solid ' + (bad ? RED : LINE), borderRadius: 8,
          background: bad ? '#FCEFEC' : '#FFFFFF', fontSize: 13, padding: '6px 30px 6px 9px', outline: 'none',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <button
        type="button"
        aria-label={(label || '날짜') + ' 달력 열기'}
        title="달력에서 고르기"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(o => !o)}
        style={{ position: 'absolute', right: 3, border: 'none', background: 'none', padding: 4, borderRadius: 4, cursor: 'pointer', color: open ? GREEN : FAINT, display: 'flex' }}
        className="hov"
      >
        <CalIcon />
      </button>
      {open && (
        <CalendarPopover
          anchor={anchor}
          start={value}
          min={min}
          onPick={iso => { onChange(iso); setDraft(null); setBad(false); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  )
}

// 시작일~종료일 한 쌍. 시작일을 옮기면 기간 길이를 지킨 채 종료일도 따라 옮길 수 있다(keepLength).
// 달력에서는 한 번 누르면 시작일, 한 번 더 누르면 종료일.
export function DateRangeField({ start, end, onChange, refDate, keepLength = false, labels = ['시작일', '종료일'], onEnter, width }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const { isMobile } = useWindowWidth()
  const setStart = iso => {
    if (keepLength) {
      onChange(shiftRange({ start, end }, iso))
    } else {
      onChange({ start: iso, end: end && end >= iso ? end : iso })
    }
  }
  return (
    <span ref={anchor} style={{ position: 'relative', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <DateField value={start} onChange={setStart} near={refDate || start} label={labels[0]} onEnter={onEnter} width={width || (isMobile ? 132 : undefined)} />
      <span style={{ fontSize: 13, color: FAINT }}>~</span>
      <DateField value={end} onChange={iso => onChange({ start, end: iso })} near={start || refDate} min={start} label={labels[1]} onEnter={onEnter} width={width || (isMobile ? 132 : undefined)} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="달력에서 시작일과 종료일을 차례로 누르세요"
        aria-label="달력에서 기간 고르기"
        className="hov"
        style={{ border: '1px solid ' + (open ? GREEN : LINE), background: open ? '#E9F6FE' : '#FFFFFF', color: open ? GREEN : SUB, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}
      >
        <CalIcon />{!isMobile && ' 기간'}
      </button>
      {open && (
        <CalendarPopover
          anchor={anchor}
          range
          start={start}
          end={end}
          onPick={(s, e) => { onChange({ start: s, end: e }); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  )
}

// 달력 팝오버. 화면 밖으로 넘치지 않게 고정 위치로 띄우고, 바깥을 누르거나 Esc면 닫는다.
function CalendarPopover({ anchor, start, end, min, range = false, onPick, onClose }) {
  const box = useRef(null)
  const base = fromISO(start || toISO(new Date()))
  const [ym, setYm] = useState({ y: base.getFullYear(), m: base.getMonth() })
  const [first, setFirst] = useState(null) // range: 첫 번째로 누른 날
  const [hover, setHover] = useState(null)
  const [pos, setPos] = useState({ top: -9999, left: 0 })
  const today = toISO(new Date())

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const b = box.current?.getBoundingClientRect()
      if (!a || !b) return
      const vw = window.innerWidth, vh = window.innerHeight
      let top = a.bottom + 6
      if (top + b.height > vh - 8 && a.top - b.height - 6 > 8) top = a.top - b.height - 6
      const left = Math.max(8, Math.min(a.left, vw - b.width - 8))
      setPos({ top: Math.max(8, top), left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor, ym])

  useEffect(() => {
    const down = e => {
      if (box.current?.contains(e.target) || anchor.current?.contains(e.target)) return
      onClose()
    }
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', down)
    document.addEventListener('touchstart', down)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('touchstart', down)
      document.removeEventListener('keydown', key, true)
    }
  }, [anchor, onClose])

  const firstDay = new Date(ym.y, ym.m, 1)
  const cells = []
  for (let i = 0; i < 42; i++) cells.push(new Date(ym.y, ym.m, 1 - firstDay.getDay() + i))
  // 마지막 줄이 통째로 다음 달이면 뺀다
  while (cells.length > 35 && cells[cells.length - 7].getMonth() !== ym.m) cells.splice(-7)

  const move = n => setYm(({ y, m }) => {
    const d = new Date(y, m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  // 범위 칠하기: 첫 클릭 뒤에는 마우스가 있는 날까지 미리 보여 준다
  let lo = start, hi = end
  if (range && first) {
    const other = hover || first
    lo = first < other ? first : other
    hi = first < other ? other : first
  }

  const pick = iso => {
    if (!range) return onPick(iso)
    if (!first) { setFirst(iso); return }
    const s = first < iso ? first : iso
    const e = first < iso ? iso : first
    onPick(s, e)
  }

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="날짜 고르기"
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, width: 264, boxSizing: 'border-box',
        background: '#FFFFFF', border: '1px solid ' + LINE, borderRadius: 10, padding: 12,
        boxShadow: '0 8px 28px rgba(26, 26, 26, 0.14)', fontSize: 13, color: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={navBtn}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>{ym.y}년 {ym.m + 1}월</div>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
        {'일월화수목금토'.split('').map((w, i) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 11, color: i === 0 ? RED : FAINT, paddingBottom: 4 }}>{w}</div>
        ))}
        {cells.map(d => {
          const iso = toISO(d)
          const out = d.getMonth() !== ym.m
          const disabled = min && iso < min
          const isEdge = iso === lo || iso === hi
          const inside = lo && hi && iso > lo && iso < hi
          const wd = d.getDay()
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => pick(iso)}
              onMouseEnter={() => range && setHover(iso)}
              aria-label={iso}
              aria-pressed={isEdge || undefined}
              style={{
                height: 32, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 13,
                borderRadius: isEdge ? 6 : inside ? 0 : 6,
                background: isEdge ? GREEN : inside ? '#D4EDFC' : 'transparent',
                color: isEdge ? '#FFFFFF' : disabled ? LINE_SOFT : out ? LINE : wd === 0 ? RED : wd === 6 ? '#185FA5' : INK,
                fontWeight: isEdge || iso === today ? 700 : 400,
                boxShadow: iso === today && !isEdge ? 'inset 0 0 0 1px ' + GREEN : 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: FAINT, display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{range ? (first ? '종료일을 누르세요' : '시작일을 누르세요') : '날짜를 누르세요'}</span>
        <button type="button" onClick={() => setYm({ y: new Date().getFullYear(), m: new Date().getMonth() })} style={{ border: 'none', background: 'none', color: GREEN, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 2 }}>오늘로</button>
      </div>
    </div>
  )
}

const navBtn = { border: 'none', background: 'none', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 18, color: SUB, lineHeight: 1 }

function CalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  )
}
