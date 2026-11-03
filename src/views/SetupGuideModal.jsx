import React, { useEffect, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, toISO } from '../logic.js'
import { guessSemester } from '../schools.js'
import { DateRangeField } from './DateField.jsx'
import Modal from './Modal.jsx'

// 학사일정을 넣은 직후 이어지는 두 단계 안내.
// 1) 학사일정으로 잡아 둔 학기 시작·종료일을 확인·수정
// 2) 시간표 등록 과정을 실제 화면 그대로 움직이는 데모로 보여준다
export default function SetupGuideModal({ data, patch, onClose }) {
  const [step, setStep] = useState(1)

  // 학기 이름은 시작일의 달로 — 3~7월이면 1학기, 아니면 2학기.
  // 학기를 바꾸면 시작일이 그 학기로 옮겨가므로 이름도 따라온다.
  const m = Number((data.semStart || '').slice(5, 7)) || new Date().getMonth() + 1
  const semNum = m >= 3 && m <= 7 ? 1 : 2
  const semLabel = semNum + '학기'
  const ok = data.semStart && data.semEnd && data.semStart < data.semEnd

  // 방학 중에 다음 학기를 준비하는 경우 — 넣어 둔 학사일정에서 그 학기 날짜를 다시 잡는다
  const pickSem = n => {
    if (n === semNum) return
    const evs = (data.events || []).map(e => ({ date: e.start, name: e.name }))
    const g = guessSemester(evs, toISO(new Date()), n)
    patch({ semStart: g.start, semEnd: g.end })
  }

  return (
    <Modal title={step === 1 ? semLabel + ' 기간을 확인해주세요' : '시간표를 등록해주세요'} onClose={onClose} width={470}>
      {/* 단계 표시 */}
      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
        {[1, 2].map(n => (
          <span key={n} style={{ width: 22, height: 4, borderRadius: 2, background: n <= step ? GREEN : '#E4E1DA' }} />
        ))}
      </div>

      {step === 1 ? (
        <>
          <div style={{ marginTop: 14, fontSize: 13.5, color: SUB, lineHeight: 1.65 }}>
            학사일정을 기준으로 {semLabel} 시작일과 종료일을 잡아 두었습니다.
            우리 학교와 다르면 고쳐주세요. 이 기간의 평일에 차시가 계산됩니다.
          </div>

          <div style={{ marginTop: 16, border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', padding: '16px 18px' }}>
            {/* 방학 중에 다음 학기를 준비할 수도 있다 — 학기를 누르면 그 학기 날짜로 다시 잡는다 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[1, 2].map(n => (
                <button key={n} onClick={() => pickSem(n)} style={semChip(semNum === n)}>{n}학기</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <DateRangeField
                start={data.semStart}
                end={data.semEnd}
                onChange={r => patch({ semStart: r.start, semEnd: r.end })}
                labels={['학기 시작일', '학기 종료일']}
              />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: FAINT }}>10.12처럼 숫자로 바로 치거나 [기간]을 눌러 달력에서 시작일·종료일을 차례로 고르세요.</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 20 }}>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => ok && setStep(2)}
              style={{
                border: 'none', borderRadius: 6, padding: '9px 22px', fontSize: 14, fontWeight: 700,
                background: ok ? GREEN : '#D9D5CE', color: '#FFFFFF', cursor: ok ? 'pointer' : 'default', flex: 'none',
              }}
            >
              다음
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 14, fontSize: 13.5, color: SUB, lineHeight: 1.65 }}>
            수업이 있는 칸들을 눌러 고르고, [반 등록]에 반 이름과 과목을 넣으면 끝입니다.
          </div>

          <TimetableDemo />

          <div style={{ marginTop: 12, fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
            등록하면 반마다 색이 붙고, 학기 전체의 차시 번호가 자동으로 계산됩니다.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: SUB, flex: 'none' }}>
              ← 이전
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              style={{ border: 'none', borderRadius: 6, padding: '9px 22px', fontSize: 14, fontWeight: 700, background: GREEN, color: '#FFFFFF', cursor: 'pointer', flex: 'none' }}
            >
              시간표 만들러 가기
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}


// 학기 전환 칩 — 학사일정 검색의 학년 칩과 같은 모양
const semChip = on => ({
  border: '1px solid ' + (on ? '#CBDED7' : LINE), borderRadius: 999, padding: '5px 13px',
  background: on ? '#EAF1EE' : '#FFFFFF', color: on ? GREEN : SUB,
  fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: on ? 'default' : 'pointer', flex: 'none',
})

// ── 시간표 등록 데모 ──────────────────────────────────────────────────────────
// 실제 설정 화면(TimetableEditor)의 모양 그대로, 커서가 칸 셋을 고르고
// [반 등록] → 반·과목 입력 → 등록까지를 반복해서 보여준다.
const DEMO_CELLS = ['1-2', '3-2', '5-3'] // 월2 · 수2 · 금3
const DEMO_COLOR = '#D5E7DC'
const PAL_H = 44 // 팔레트 줄 높이
const HEAD_H = 32 // 요일 머리줄
const ROW_H = 40 // 교시 줄
const PERIODS = 4

// 단계별 시간(ms). 각 단계가 끝나는 순간 다음 단계의 상태가 된다.
const DUR = [700, 650, 700, 700, 800, 1000, 650, 2000]

export function TimetableDemo() {
  const [step, setStep] = useState(0)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setStep(s => (s + 1) % DUR.length), DUR[step])
    return () => clearTimeout(t)
  }, [step])

  // 5단계: 반 이름이 한 글자씩 입력된다
  useEffect(() => {
    if (step !== 5) {
      setTyped('')
      return
    }
    const name = '2-1'
    let i = 0
    const t = setInterval(() => {
      i++
      setTyped(name.slice(0, i))
      if (i >= name.length) clearInterval(t)
    }, 180)
    return () => clearInterval(t)
  }, [step])

  const selCount = step >= 4 ? 3 : step >= 3 ? 2 : step >= 2 ? 1 : 0
  const selected = new Set(DEMO_CELLS.slice(0, selCount))
  const formOpen = step >= 5 && step < 7
  const registered = step >= 7

  // 커서가 향하는 곳 — 각 단계의 목적지
  const cellPos = key => {
    const [d, p] = key.split('-').map(Number)
    return { x: 'calc(38px + (100% - 38px) * ' + ((d - 0.5) / 5).toFixed(3) + ')', y: PAL_H + HEAD_H + (p - 0.5) * ROW_H }
  }
  const CURSOR = [
    { x: '30%', y: PAL_H + HEAD_H + 3.6 * ROW_H }, // 시작: 아래쪽에서 대기
    cellPos(DEMO_CELLS[0]),
    cellPos(DEMO_CELLS[1]),
    cellPos(DEMO_CELLS[2]),
    { x: 'calc(100% - 52px)', y: PAL_H / 2 }, // [반 등록]
    { x: 'calc(100% - 148px)', y: PAL_H / 2 + 16 }, // 입력하는 동안 반 입력칸 아래에서 대기
    { x: 'calc(100% - 26px)', y: PAL_H / 2 }, // [등록]
    { x: 'calc(100% - 26px)', y: PAL_H / 2 },
  ]
  const cur = CURSOR[step]
  const clicking = step >= 2 && step !== 5 // 이동이 끝나고 눌리는 단계들

  const cell = key => {
    const on = selected.has(key)
    const done = registered && DEMO_CELLS.includes(key)
    return {
      borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
      background: done ? DEMO_COLOR : on ? 'rgba(15,92,77,0.07)' : '#FFFFFF',
      boxShadow: on ? 'inset 0 0 0 2px ' + GREEN : 'none',
      display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box',
      fontSize: 13, fontWeight: 600, color: INK, transition: 'background 250ms',
    }
  }

  return (
    <div style={{ marginTop: 14, position: 'relative', border: '1px solid ' + LINE, borderRadius: 8, background: '#FCFCFA', padding: '10px 12px 12px', overflow: 'hidden', userSelect: 'none', pointerEvents: 'none' }}>
      {/* 팔레트 줄 — 선택 도구 · 반 칩 · [반 등록] */}
      <div style={{ height: PAL_H, display: 'flex', alignItems: 'center', gap: 14, boxSizing: 'border-box', paddingBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: INK, borderBottom: '2px solid ' + GREEN, padding: '2px 0 3px' }}>선택</span>
        {registered && (
          <span style={{ border: '1px solid rgba(26,26,26,0.18)', borderRadius: 6, background: DEMO_COLOR, color: INK, padding: '5px 10px', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>
            2-1
          </span>
        )}
        <span style={{ flex: 1 }} />
        {formOpen ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={demoField(54)}>{typed}<Caret on={typed.length < 3} /></span>
            <span style={{ ...demoField(44), color: typed.length >= 3 ? INK : '#B0ACA5' }}>{typed.length >= 3 ? '수학' : '과목'}</span>
            <span style={{ border: 'none', borderRadius: 6, background: GREEN, color: '#FFFFFF', padding: '6px 11px', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>등록</span>
          </span>
        ) : (
          <span
            style={{
              border: '1px solid ' + (selCount ? GREEN : LINE), borderRadius: 6, padding: '6px 12px',
              background: selCount ? GREEN : '#FFFFFF', color: selCount ? '#FFFFFF' : FAINT,
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1, transition: 'background 200ms',
            }}
          >
            반 등록{selCount ? ' (' + selCount + '칸)' : ''}
          </span>
        )}
      </div>

      {/* 시간표 격자 */}
      <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(5,minmax(0,1fr))' }}>
          <div style={{ background: '#F4F2ED', height: HEAD_H }} />
          {['월', '화', '수', '목', '금'].map(d => (
            <div key={d} style={{ height: HEAD_H, boxSizing: 'border-box', padding: '8px 10px 0', borderLeft: '1px solid ' + LINE_SOFT, fontSize: 12, color: SUB, fontWeight: 700, background: '#F4F2ED' }}>
              {d}
            </div>
          ))}
          {Array.from({ length: PERIODS }, (_, r) => {
            const p = r + 1
            return (
              <React.Fragment key={p}>
                <div style={{ height: ROW_H, borderTop: '1px solid ' + LINE_SOFT, fontSize: 11, color: FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</div>
                {[1, 2, 3, 4, 5].map(d => {
                  const key = d + '-' + p
                  return (
                    <div key={key} style={{ height: ROW_H, ...cell(key) }}>
                      {registered && DEMO_CELLS.includes(key) ? '2-1' : ''}
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* 커서 */}
      <div
        style={{
          position: 'absolute', left: cur.x, top: cur.y, zIndex: 5,
          transition: 'left 520ms cubic-bezier(0.3,0.7,0.4,1), top 520ms cubic-bezier(0.3,0.7,0.4,1)',
          marginLeft: -3, marginTop: -3,
        }}
      >
        {clicking && (
          <span key={step} style={{ position: 'absolute', left: -9, top: -9, width: 24, height: 24, borderRadius: '50%', background: 'rgba(15,92,77,0.28)', animation: 'demoPulse 450ms ease-out both' }} />
        )}
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(26,26,26,0.35))', position: 'relative' }}>
          <path d="M5 3l14 8-6.5 1.5L9 19z" fill="#1A1A1A" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

const demoField = w => ({
  display: 'inline-flex', alignItems: 'center', width: w, height: 26, boxSizing: 'border-box',
  border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', fontSize: 12, padding: '0 7px',
  color: INK, overflow: 'hidden', whiteSpace: 'nowrap',
})

function Caret({ on }) {
  if (!on) return null
  return <span style={{ display: 'inline-block', width: 1.5, height: 13, background: GREEN, marginLeft: 1, animation: 'demoBlink 900ms step-end infinite' }} />
}
