import React, { useMemo, useRef, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, WARN, SECTION_TITLE, fromISO, toISO, DAYS } from '../logic.js'
import { DEFAULT_OT, defaultOvertime, monthOvertime, dayOvertime, parsePlanText, fileText, fmtMin, isOffDay } from '../overtime.js'
import DateField, { DateRangeField } from './DateField.jsx'
import useWindowWidth from '../useWindowWidth.js'

// 초과근무 — 방과후 계획서를 올리면 그 날들의 방과후 끝나는 시각으로 자동 계산하고,
// 야근한 날은 퇴근 시각을 직접 넣는다. 한 달 합계와 CSV 내보내기.
export default function OvertimeView({ data, setData, setSnack }) {
  const { isMobile } = useWindowWidth()
  const ot = data.overtime || defaultOvertime()
  const cfg = { ...DEFAULT_OT, ...(ot.cfg || {}) }
  const setOt = fn => setData(d => ({ ...d, overtime: fn(d.overtime || defaultOvertime()) }))
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [edit, setEdit] = useState(null) // 고치는 중인 방과후 초안
  const [busy, setBusy] = useState(false)
  const [fileErr, setFileErr] = useState('')
  const [cfgOpen, setCfgOpen] = useState(false)
  const [add, setAdd] = useState({ iso: toISO(now), start: '09:00', end: '' })
  const fileRef = useRef(null)

  const month = useMemo(() => monthOvertime(ot, data, ym.y, ym.m), [ot, data, ym])
  const move = n => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  // ---- 방과후 ----
  const blankPlan = () => ({ id: null, name: '', from: '16:50', to: '18:30', start: data.semStart || toISO(now), end: data.semEnd || toISO(now), days: [], dates: [], skip: [] })
  const upload = async f => {
    if (!f) return
    setFileErr(''); setBusy(true)
    try {
      const text = await fileText(f)
      const p = parsePlanText(text, data.semStart || toISO(now))
      const draft = { ...blankPlan(), ...Object.fromEntries(Object.entries(p).filter(([, v]) => (Array.isArray(v) ? v.length : v))), name: p.name || f.name.replace(/\.[^.]+$/, '') }
      setEdit(draft)
      const miss = [!p.from && '시간', !p.start && '기간', !p.days.length && !p.dates.length && '요일'].filter(Boolean)
      if (miss.length) setFileErr('계획서에서 ' + miss.join('·') + '을(를) 찾지 못했습니다. 아래에서 직접 넣어 주세요.')
    } catch (e) {
      setFileErr(e.message || '파일을 읽지 못했습니다.')
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }
  const savePlan = () => {
    const p = edit
    if (!p.from || !p.to || !p.start || !p.end || (!p.days.length && !(p.dates || []).length)) return
    setOt(o => {
      const plans = [...(o.plans || [])]
      if (p.id) plans[plans.findIndex(x => x.id === p.id)] = p
      else plans.push({ ...p, id: Date.now() })
      return { ...o, plans }
    })
    setEdit(null); setFileErr('')
    setSnack({ text: (p.name || '방과후') + '을(를) 저장했습니다.', kind: 'none', ms: 3000 })
  }
  const removePlan = id => {
    const prev = data
    setOt(o => ({ ...o, plans: (o.plans || []).filter(x => x.id !== id) }))
    setSnack({ text: '방과후를 지웠습니다.', kind: 'all', prev, ms: 5000 })
  }

  // ---- 날마다 기록 ----
  const setLog = (iso, patch) => setOt(o => {
    const logs = { ...(o.logs || {}) }
    const n = { ...(logs[iso] || {}), ...patch }
    Object.keys(n).forEach(k => { if (n[k] === '' || n[k] == null) delete n[k] })
    if (Object.keys(n).length) logs[iso] = n
    else delete logs[iso]
    return { ...o, logs }
  })
  const skipDay = (r, on) => setOt(o => ({
    ...o,
    plans: (o.plans || []).map(p => (r.plans.some(x => x.plan.id === p.id) || (on === false && (p.skip || []).includes(r.iso))
      ? { ...p, skip: on ? [...new Set([...(p.skip || []), r.iso])] : (p.skip || []).filter(x => x !== r.iso) } : p)),
  }))
  const addLog = () => {
    const off = isOffDay(data, add.iso)
    if (!add.end || (off && !add.start)) return
    setLog(add.iso, off ? { start: add.start, end: add.end } : { end: add.end })
    const d = fromISO(add.iso)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
    setAdd(a => ({ ...a, end: '' }))
  }

  const exportCSV = () => {
    const rows = [['날짜', '요일', '방과후', '시작', '끝·퇴근', '인정(분)', '인정', '메모']]
    month.days.forEach(r => {
      const d = fromISO(r.iso)
      rows.push([r.iso, DAYS[d.getDay()], r.plans.map(x => x.plan.name + ' ' + x.from + '~' + x.to).join(' / '),
        r.start != null ? hm(r.start) : '', r.end != null ? hm(r.end) : '', r.minutes, fmtMin(r.minutes), r.note || ''])
    })
    rows.push([], ['합계', '', '', '', '', month.total, fmtMin(month.total), '인정 ' + month.hours + '시간'])
    const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
    a.download = '초과근무-' + ym.y + '-' + String(ym.m + 1).padStart(2, '0') + '.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }

  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13.5, padding: '6px 8px', boxSizing: 'border-box' }
  const card = { background: '#FFFFFF', borderRadius: 16, padding: isMobile ? '14px 14px' : '16px 18px', boxShadow: '0 1px 3px rgba(25,31,40,0.05)' }
  const btn = primary => ({ border: primary ? 'none' : '1px solid ' + LINE, borderRadius: 8, background: primary ? GREEN : '#FFFFFF', color: primary ? '#FFFFFF' : SUB, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 'none' })
  const addOff = isOffDay(data, add.iso)

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 한 달 요약 */}
      <section style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={nav}>‹</button>
          <div style={{ fontSize: 18, fontWeight: 800, minWidth: 116, textAlign: 'center', letterSpacing: '-0.02em' }}>{ym.y}년 {ym.m + 1}월</div>
          <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={nav}>›</button>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: FAINT }}>이번 달 초과근무</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>
            {month.total ? fmtMin(month.total) : '0시간'} <span style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>→ 인정 {month.hours}시간</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setCfgOpen(o => !o)} aria-expanded={cfgOpen} style={btn(false)}>계산 기준</button>
        <button type="button" onClick={exportCSV} disabled={!month.days.length} style={btn(false)}>CSV 내보내기</button>
        {cfgOpen && (
          <div style={{ width: '100%', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: SUB, paddingTop: 10, borderTop: '1px solid ' + LINE_SOFT }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>퇴근 시각 <input type="time" value={cfg.offTime} onChange={e => setOt(o => ({ ...o, cfg: { ...cfg, offTime: e.target.value } }))} style={field} /></label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>평일 공제 <input type="number" min="0" max="240" step="10" value={cfg.deduct} onChange={e => setOt(o => ({ ...o, cfg: { ...cfg, deduct: Math.max(0, +e.target.value || 0) } }))} style={{ ...field, width: 70 }} />분</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>하루 최대 <input type="number" min="1" max="12" step="0.5" value={cfg.dailyMax / 60} onChange={e => setOt(o => ({ ...o, cfg: { ...cfg, dailyMax: Math.round((+e.target.value || 4) * 60) } }))} style={{ ...field, width: 64 }} />시간</label>
            <span style={{ fontSize: 12, color: FAINT, width: '100%' }}>평일은 퇴근 시각 뒤부터 세고 공제를 뺍니다. 주말·공휴일·휴업일은 시작~끝을 공제 없이 셉니다. 한 달 합계에서 1시간 미만은 버립니다. 학교 기준과 다르면 위 값을 고쳐 주세요.</span>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        {/* 날마다 */}
        <section style={card}>
          <div style={{ ...SECTION_TITLE, marginBottom: 8 }}>날짜별 기록</div>
          {month.days.length === 0 && <div style={{ fontSize: 13, color: FAINT, padding: '8px 0' }}>이 달에는 방과후나 기록이 없습니다. 오른쪽에서 방과후 계획서를 올리거나 아래에서 직접 넣으세요.</div>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {month.days.map(r => {
              const d = fromISO(r.iso)
              const log = (ot.logs || {})[r.iso] || {}
              return (
                <div key={r.iso} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid ' + LINE_SOFT, flexWrap: 'wrap' }}>
                  <div style={{ width: 74, flex: 'none', fontSize: 13.5, fontWeight: 700, color: r.off ? RED : INK }}>
                    {d.getMonth() + 1}.{d.getDate()} <span style={{ fontWeight: 500, color: r.off ? RED : SUB }}>{DAYS[d.getDay()]}</span>
                  </div>
                  <div style={{ flex: '1 1 110px', minWidth: 0, fontSize: 12.5, color: SUB }}>
                    {r.plans.length ? r.plans.map(x => <div key={x.plan.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.plan.name} <span style={{ color: FAINT }}>{x.from}~{x.to}</span></div>) : <span style={{ color: FAINT }}>{r.off ? '휴일 근무' : '직접 기록'}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 'none' }}>
                    {r.off && <input type="time" aria-label="시작 시각" value={log.start || ''} onChange={e => setLog(r.iso, { start: e.target.value })} style={{ ...field, padding: '4px 6px' }} />}
                    {r.off && <span style={{ color: FAINT }}>~</span>}
                    <input
                      type="time"
                      aria-label={r.off ? '끝 시각' : '퇴근 시각'}
                      title={r.off ? '' : '실제 퇴근 시각 — 비워 두면 방과후 끝나는 시각으로 셉니다'}
                      value={log.end || ''}
                      placeholder={r.plans.length ? r.plans[0].to : ''}
                      onChange={e => setLog(r.iso, { end: e.target.value })}
                      style={{ ...field, padding: '4px 6px', color: log.end ? INK : FAINT }}
                    />
                  </div>
                  <div style={{ width: 70, flex: 'none', textAlign: 'right', fontSize: 14, fontWeight: 800, color: r.minutes ? GREEN : FAINT, whiteSpace: 'nowrap' }}>{r.minutes ? fmtMin(r.minutes) : '0'}</div>
                  <input aria-label="메모" value={log.note || ''} onChange={e => setLog(r.iso, { note: e.target.value })} placeholder="메모" style={{ ...field, flex: '1 1 70px', minWidth: 60, padding: '4px 8px', fontSize: 12.5 }} />
                  {r.plans.length > 0 ? (
                    <button type="button" onClick={() => skipDay(r, true)} title="이 날은 방과후를 하지 않았음" style={{ border: 'none', background: 'none', color: FAINT, fontSize: 12, cursor: 'pointer', padding: 2, whiteSpace: 'nowrap', flex: 'none' }}>빼기</button>
                  ) : (
                    <button type="button" onClick={() => setLog(r.iso, { start: '', end: '', note: '' })} title="기록 지우기" style={{ border: 'none', background: 'none', color: FAINT, fontSize: 15, cursor: 'pointer', padding: 2 }}>×</button>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: SUB }}>직접 기록</span>
            <DateField value={add.iso} onChange={v => setAdd(a => ({ ...a, iso: v }))} label="기록할 날짜" width={140} />
            {addOff && <input type="time" aria-label="시작 시각" value={add.start} onChange={e => setAdd(a => ({ ...a, start: e.target.value }))} style={field} />}
            {addOff && <span style={{ color: FAINT }}>~</span>}
            <input type="time" aria-label={addOff ? '끝 시각' : '퇴근 시각'} value={add.end} onChange={e => setAdd(a => ({ ...a, end: e.target.value }))} style={field} />
            <button type="button" onClick={addLog} disabled={!add.end} style={{ ...btn(true), opacity: add.end ? 1 : 0.5 }}>추가</button>
            <span style={{ fontSize: 11.5, color: FAINT, width: '100%' }}>{addOff ? '쉬는 날 근무는 시작~끝 시각을 넣습니다.' : '평일은 퇴근 시각만 넣으면 됩니다.'}</span>
          </div>
        </section>

        {/* 방과후 */}
        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={SECTION_TITLE}>방과후</div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} style={btn(true)}>{busy ? '읽는 중…' : '계획서 올리기'}</button>
            <button type="button" onClick={() => { setEdit(blankPlan()); setFileErr('') }} style={btn(false)}>직접 추가</button>
            <input ref={fileRef} type="file" accept=".hwpx,.hwp,.pdf,.txt" style={{ display: 'none' }} onChange={e => upload(e.target.files[0])} />
          </div>
          <div style={{ fontSize: 11.5, color: FAINT, marginBottom: 8 }}>한글 HWPX·PDF를 올리면 강좌명·기간·요일·시간을 찾아 채웁니다. 예전 HWP는 한글에서 HWPX나 PDF로 저장해 올려 주세요.</div>
          {fileErr && <div role="alert" style={{ fontSize: 12.5, color: WARN, marginBottom: 8 }}>{fileErr}</div>}

          {edit && <PlanEditor plan={edit} setPlan={setEdit} onSave={savePlan} onCancel={() => { setEdit(null); setFileErr('') }} field={field} btn={btn} />}

          {(ot.plans || []).length === 0 && !edit && <div style={{ fontSize: 13, color: FAINT }}>아직 없습니다.</div>}
          {(ot.plans || []).map(p => (
            <div key={p.id} style={{ padding: '10px 0', borderTop: '1px solid ' + LINE_SOFT, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{p.name || '방과후'}</div>
                <div style={{ fontSize: 12.5, color: SUB }}>
                  {p.dates && p.dates.length ? '날짜 ' + p.dates.length + '개' : '매주 ' + p.days.map(x => DAYS[x]).join('·')} · {p.from}~{p.to}
                </div>
                <div style={{ fontSize: 12, color: FAINT }}>{p.start.slice(5).replace('-', '.')} ~ {p.end.slice(5).replace('-', '.')}{(p.skip || []).length ? ' · 뺀 날 ' + p.skip.length + '일' : ''}</div>
              </div>
              <button type="button" onClick={() => setEdit({ ...p })} style={{ border: 'none', background: 'none', color: GREEN, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>고치기</button>
              <button type="button" onClick={() => removePlan(p.id)} style={{ border: 'none', background: 'none', color: FAINT, fontSize: 12.5, cursor: 'pointer' }}>지우기</button>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
const nav = { border: 'none', background: 'none', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 22, color: SUB, lineHeight: 1 }

function PlanEditor({ plan, setPlan, onSave, onCancel, field, btn }) {
  const set = p => setPlan(x => ({ ...x, ...p }))
  const useDates = plan.dates && plan.dates.length > 0
  const ok = plan.from && plan.to && plan.start && plan.end && (plan.days.length || useDates)
  return (
    <div style={{ background: '#F5F8FB', borderRadius: 12, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
      <input aria-label="강좌 이름" value={plan.name} onChange={e => set({ name: e.target.value })} placeholder="강좌 이름" style={field} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: SUB, width: 34 }}>시간</span>
        <input type="time" aria-label="방과후 시작" value={plan.from} onChange={e => set({ from: e.target.value })} style={field} />
        <span style={{ color: FAINT }}>~</span>
        <input type="time" aria-label="방과후 끝" value={plan.to} onChange={e => set({ to: e.target.value })} style={field} />
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: SUB, width: 34 }}>기간</span>
        <DateRangeField start={plan.start} end={plan.end} onChange={r => set(r)} labels={['방과후 시작일', '방과후 종료일']} width={132} />
      </div>
      {useDates ? (
        <div style={{ color: SUB }}>
          계획서의 날짜 {plan.dates.length}개로 셉니다 <span style={{ color: FAINT }}>({plan.dates.slice(0, 4).map(d => d.slice(5).replace('-', '.')).join(', ')}{plan.dates.length > 4 ? ' …' : ''})</span>
          <button type="button" onClick={() => set({ dates: [] })} style={{ border: 'none', background: 'none', color: GREEN, cursor: 'pointer', fontSize: 12.5, marginLeft: 6 }}>요일로 바꾸기</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ color: SUB, width: 34 }}>요일</span>
          {[1, 2, 3, 4, 5].map(dw => {
            const on = plan.days.includes(dw)
            return (
              <button key={dw} type="button" aria-pressed={on} onClick={() => set({ days: on ? plan.days.filter(x => x !== dw) : [...plan.days, dw].sort() })}
                style={{ width: 32, height: 30, borderRadius: 8, border: '1px solid ' + (on ? GREEN : LINE), background: on ? '#E9F6FE' : '#FFFFFF', color: on ? GREEN : SUB, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                {DAYS[dw]}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btn(false)}>취소</button>
        <button type="button" onClick={onSave} disabled={!ok} style={{ ...btn(true), opacity: ok ? 1 : 0.5 }}>저장</button>
      </div>
    </div>
  )
}
