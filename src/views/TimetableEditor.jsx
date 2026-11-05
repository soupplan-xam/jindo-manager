import React, { useEffect, useRef, useState } from 'react'
import { GREEN, INK, LINE, LINE_SOFT, FAINT, RED, SUB, TINTS, colorOf, subjectOf } from '../logic.js'
import Palette from './Palette.jsx'
import useWindowWidth from '../useWindowWidth.js'

// 시간표 입력 두 가지 방식:
// 1) 블록 선택: 칸들을 눌러 고르고 [반 등록]으로 한 번에 배정 (기본, 모바일 주력)
// 2) 칠하기: 팔레트에서 반을 고른 뒤 드래그/탭으로 칠하기
export default function TimetableEditor({ data, setData, setSnack, cellHeight = 46, compact = false, fill = false, leading = null }) {
  const { isMobile } = useWindowWidth()
  const min = !!data.cfg.minimal
  const [selTool, setSelTool] = useState('select')
  const [editing, setEditing] = useState(false) // 반 칩에 삭제(×) 표시
  const [selected, setSelected] = useState({}) // {'dow-p': true}
  const [regOpen, setRegOpen] = useState(false)
  const [newClass, setNewClass] = useState('')
  const [newSubject, setNewSubject] = useState(data.subjects[0] || '수학')
  const [chipPop, setChipPop] = useState(null) // 팝오버 열린 반 이름
  const paintRef = useRef(false)

  useEffect(() => {
    const up = () => { paintRef.current = false }
    const close = () => setChipPop(null)
    document.addEventListener('mouseup', up)
    document.addEventListener('click', close)
    return () => {
      document.removeEventListener('mouseup', up)
      document.removeEventListener('click', close)
    }
  }, [])

  const selCount = Object.keys(selected).length

  const paint = k => {
    setData(d => {
      const pat = { ...d.pattern }
      if (selTool === 'erase') delete pat[k]
      else pat[k] = selTool
      return { ...d, pattern: pat }
    })
  }

  const tapCell = k => {
    if (selTool === 'select') {
      setSelected(s => {
        const n = { ...s }
        if (n[k]) delete n[k]
        else n[k] = true
        return n
      })
    } else {
      paint(k)
    }
  }

  // 선택된 칸들을 반으로 등록. 새 반이면 색·과목도 함께 부여.
  const register = () => {
    const name = newClass.trim()
    if (!name || !selCount) return
    setData(d => {
      const pat = { ...d.pattern }
      Object.keys(selected).forEach(k => { pat[k] = name })
      const isNew = d.classes.indexOf(name) < 0
      const classes = isNew ? [...d.classes, name] : d.classes
      const colors = { ...d.colors }
      if (isNew && !colors[name]) {
        const used = d.classes.map(c => colorOf(d, c))
        colors[name] = TINTS.find(t => !used.includes(t)) || TINTS[(classes.length - 1) % TINTS.length]
      }
      const subj = newSubject.trim() || d.subjects[0] || '수학'
      const subjects = d.subjects.includes(subj) ? d.subjects : [...d.subjects, subj]
      return { ...d, pattern: pat, classes, colors, subjects, clsSubject: { ...d.clsSubject, [name]: subj } }
    })
    setSelected({})
    setRegOpen(false)
    setNewClass('')
  }

  // 반 삭제 — 시간표 칸·색·과목 지정까지 함께 지운다 (되돌리기 가능)
  const removeClass = cls => {
    const prev = data
    setData(d => {
      const pat = {}
      Object.keys(d.pattern).forEach(k => { if (d.pattern[k] !== cls) pat[k] = d.pattern[k] })
      const colors = { ...d.colors }
      const clsSubject = { ...d.clsSubject }
      delete colors[cls]
      delete clsSubject[cls]
      return { ...d, pattern: pat, classes: d.classes.filter(c => c !== cls), colors, clsSubject }
    })
    if (selTool === cls) setSelTool('select')
    setChipPop(null)
    if (setSnack) setSnack({ text: cls + ' 반을 지웠습니다.', kind: 'all', prev })
  }

  const setColor = (cls, color) => setData(d => ({ ...d, colors: { ...d.colors, [cls]: color } }))
  const setSubject = (cls, subj) => setData(d => ({
    ...d,
    subjects: d.subjects.includes(subj) ? d.subjects : [...d.subjects, subj],
    clsSubject: { ...d.clsSubject, [cls]: subj },
  }))

  const eDays = ['월', '화', '수', '목', '금']
  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = []
    for (let dow = 1; dow <= 5; dow++) {
      const k = dow + '-' + p
      const name = data.pattern[k] || ''
      const isSel = !!selected[k]
      cells.push(
        <div
          key={k}
          onClick={() => tapCell(k)}
          onMouseDown={e => {
            if (selTool === 'select') return
            e.preventDefault()
            paintRef.current = true
            paint(k)
          }}
          onMouseEnter={() => { if (paintRef.current) paint(k) }}
          style={{
            minHeight: cellHeight, padding: isMobile ? '5px 4px' : compact ? '6px 9px' : '8px 12px',
            boxSizing: 'border-box', overflow: 'hidden', minWidth: 0,
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'flex-start',
            background: name ? colorOf(data, name) : isSel ? 'rgba(18, 132, 202,0.07)' : '#FFFFFF',
            boxShadow: isSel ? 'inset 0 0 0 2px ' + GREEN : 'none',
          }}
        >
          <div style={{ fontSize: isMobile ? 11 : 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        </div>
      )
    }
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div
          style={{
            borderTop: '1px solid ' + LINE_SOFT, fontSize: isMobile ? 10 : 12, color: FAINT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {p}
        </div>
        {cells}
      </div>
    )
  }

  const weekly = data.classes.map(c => c + ' ' + Object.values(data.pattern).filter(v => v === c).length).join(' · ')

  const toolChip = (active, label, onClick) => (
    <button
      onClick={onClick}
      style={{
        border: 'none', background: 'none', padding: '2px 0 4px', cursor: 'pointer', fontSize: isMobile ? 13 : 14,
        fontWeight: active ? 700 : 400,
        color: active ? INK : SUB,
        borderBottom: '2px solid ' + (active ? GREEN : 'transparent'),
        whiteSpace: 'nowrap', flex: 'none',
      }}
    >
      {label}
    </button>
  )

  const registerForm = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: isMobile ? 1 : 'none' }}>
      <input
        value={newClass}
        onChange={e => setNewClass(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') register()
          if (e.key === 'Escape') { setRegOpen(false); setNewClass('') }
        }}
        placeholder="반 예: 2-1"
        autoFocus
        style={{ ...fieldStyle, width: isMobile ? 0 : 108, flex: isMobile ? 1 : 'none', minWidth: 0 }}
      />
      <input
        value={newSubject}
        onChange={e => setNewSubject(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') register() }}
        placeholder="과목"
        list="subject-list"
        style={{ ...fieldStyle, width: isMobile ? 0 : 84, flex: isMobile ? 1 : 'none', minWidth: 0 }}
      />
      <datalist id="subject-list">
        {data.subjects.map(s => <option key={s} value={s} />)}
      </datalist>
      <button
        onClick={register}
        style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, flex: 'none' }}
      >
        등록
      </button>
    </div>
  )

  return (
    <>
      <div
        data-intro-palette
        className={isMobile ? 'chip-scroll' : ''}
        style={{ display: 'flex', gap: isMobile ? 14 : 18, alignItems: 'center', paddingBottom: 10, flexWrap: isMobile ? 'nowrap' : 'wrap', flex: 'none' }}
      >
        {leading}
        {!min && toolChip(selTool === 'select', '선택', () => setSelTool('select'))}
        {data.classes.map(c => (
          <div key={c} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
            {min ? (
              // 미니멀: 색 사각형만 — 누르면 칠하기 도구, 다시 누르면 선택 모드로 복귀, 길게 보지 않아도 title로 반 이름
              <span
                onClick={e => {
                  e.stopPropagation()
                  setSelTool(selTool === c ? 'select' : c)
                }}
                onDoubleClick={e => { e.stopPropagation(); setChipPop(chipPop === c ? null : c) }}
                title={c}
                style={{
                  display: 'inline-block', width: 15, height: 15, borderRadius: 3, background: colorOf(data, c),
                  border: selTool === c ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.18)',
                  boxSizing: 'border-box', cursor: 'pointer',
                }}
              />
            ) : (
              // 색 배경 안에 반 이름을 넣어 하나의 칩으로 (두 번 누르면 색·과목 편집)
              <button
                onClick={() => setSelTool(selTool === c ? 'select' : c)}
                onDoubleClick={e => { e.stopPropagation(); setChipPop(chipPop === c ? null : c) }}
                title="누르면 칠하기 · 두 번 누르면 색·과목"
                style={{
                  border: selTool === c ? '2px solid ' + GREEN : '1px solid rgba(26,26,26,0.18)',
                  borderRadius: 8, background: colorOf(data, c), color: INK,
                  padding: selTool === c ? '4px 9px' : '5px 10px', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, lineHeight: 1, boxSizing: 'border-box', whiteSpace: 'nowrap',
                }}
              >
                {c}
              </button>
            )}
            {/* 편집 중일 때만 뜨는 삭제 배지 */}
            {editing && (
              <button
                onClick={e => { e.stopPropagation(); removeClass(c) }}
                title={c + ' 반 삭제'}
                style={{
                  position: 'absolute', top: -7, right: -7, width: 16, height: 16, borderRadius: '50%',
                  border: '1px solid #FFFFFF', background: RED, color: '#FFFFFF', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, lineHeight: 1, padding: 0, zIndex: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            )}
            {chipPop === c && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', left: 0, top: 30, width: 196, background: '#FFFFFF',
                  border: '1px solid ' + LINE, borderRadius: 8, boxShadow: '0 8px 24px rgba(26,26,26,0.12)',
                  padding: 12, zIndex: 50, cursor: 'default',
                }}
              >
                <div style={{ fontSize: 12, color: FAINT }}>색</div>
                <div style={{ marginTop: 7 }}>
                  <Palette simple value={colorOf(data, c)} onPick={t => setColor(c, t)} size={18} />
                </div>
                <div style={{ fontSize: 12, color: FAINT, marginTop: 12 }}>과목</div>
                <select
                  value={subjectOf(data, c)}
                  onChange={e => setSubject(c, e.target.value)}
                  style={{ ...fieldStyle, width: '100%', marginTop: 4 }}
                >
                  {data.subjects.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
        <button
          onClick={() => setSelTool(selTool === 'erase' ? 'select' : 'erase')}
          title="지우개"
          style={{
            border: selTool === 'erase' ? '2px solid ' + GREEN : '1px solid ' + LINE, borderRadius: 8,
            background: '#FFFFFF', padding: min ? 3 : 5, cursor: 'pointer', display: 'flex',
            color: selTool === 'erase' ? GREEN : SUB, flex: 'none', boxSizing: 'border-box',
          }}
        >
          <EraserIcon />
        </button>
        {/* 반 편집 — 켜면 각 반 칩에 삭제 배지가 뜬다 */}
        {data.classes.length > 0 && (
          <button
            onClick={() => setEditing(v => !v)}
            title={editing ? '반 편집 끝내기' : '반 삭제하기'}
            style={{
              border: editing ? '2px solid ' + GREEN : '1px solid ' + LINE, borderRadius: 8,
              background: '#FFFFFF', padding: min ? 3 : 5, cursor: 'pointer', display: 'flex',
              color: editing ? GREEN : SUB, flex: 'none', boxSizing: 'border-box',
            }}
          >
            <PencilIcon />
          </button>
        )}
        {(!isMobile || min) && (
          <>
            <div style={{ flex: 1 }} />
            <div data-intro-register style={{ display: 'inline-flex', alignItems: 'center' }}>
              {regOpen ? registerForm : min ? (
                <button
                  onClick={() => { if (selCount) setRegOpen(true) }}
                  title={'선택한 ' + selCount + '칸을 반으로 등록'}
                  style={{
                    width: 26, height: 26, border: 'none', borderRadius: '50%',
                    background: selCount ? GREEN : '#EBEEF2', color: selCount ? '#FFFFFF' : FAINT,
                    cursor: selCount ? 'pointer' : 'default', fontSize: 16, fontWeight: 700, lineHeight: 1, flex: 'none',
                  }}
                >
                  +
                </button>
              ) : (
                <button
                  onClick={() => { if (selCount) setRegOpen(true) }}
                  style={{
                    border: '1px solid ' + (selCount ? GREEN : LINE), borderRadius: 8, padding: '6px 14px',
                    background: selCount ? GREEN : '#FFFFFF', color: selCount ? '#FFFFFF' : FAINT,
                    cursor: selCount ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                  }}
                >
                  반 등록{selCount ? ' (' + selCount + '칸)' : ''}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 모바일(일반 모드): 선택하면 바로 아래에 큰 등록 버튼이 나타난다 */}
      {isMobile && !min && (
        <div data-intro-register style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, flex: 'none' }}>
          {regOpen ? registerForm : selCount ? (
            <button
              onClick={() => setRegOpen(true)}
              style={{ flex: 1, border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '10px 0', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >
              선택한 {selCount}칸을 반으로 등록
            </button>
          ) : (
            <div style={{ fontSize: 12, color: FAINT }}>
              {selTool === 'select' ? '수업이 있는 칸을 눌러 고르세요.' : selTool === 'erase' ? '지울 칸을 누르세요.' : '칠할 칸을 누르세요.'}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: fill ? 1 : 'none', minHeight: 0 }}>
        <div
          data-intro-grid
          style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', userSelect: 'none', height: fill ? '100%' : undefined, overflow: 'hidden' }}
        >
          <div
            style={{
              display: 'grid', gridTemplateColumns: (isMobile ? '22px' : '38px') + ' repeat(5,minmax(0,1fr))',
              gridTemplateRows: fill ? 'auto repeat(7, minmax(0,1fr))' : undefined, height: fill ? '100%' : undefined,
            }}
          >
            <div style={{ background: '#F2F4F6' }} />
            {eDays.map(d => (
              <div
                key={d}
                style={{
                  padding: isMobile ? '6px 0 5px' : '9px 12px 8px', borderLeft: '1px solid ' + LINE_SOFT,
                  fontSize: isMobile ? 11 : 13, color: SUB, fontWeight: 700, background: '#F2F4F6',
                  textAlign: isMobile ? 'center' : 'left',
                }}
              >
                {d}
              </div>
            ))}
            {rows}
          </div>
        </div>
      </div>

      {!weekly && !min && (
        <div style={{ marginTop: 8, fontSize: 12, color: SUB, flex: 'none' }}>
          칸을 골라 반으로 등록하거나, 반을 고른 뒤 칠해주세요.
        </div>
      )}
    </>
  )
}

const fieldStyle = {
  border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF',
  fontSize: 14, padding: '7px 9px', boxSizing: 'border-box',
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H8.5L3.6 15.1a2 2 0 0 1 0-2.8L13.4 2.5a2 2 0 0 1 2.8 0l5.3 5.3a2 2 0 0 1 0 2.8L13 19.1" />
      <line x1="9.5" y1="8.5" x2="16" y2="15" />
    </svg>
  )
}
