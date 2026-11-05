import React, { useMemo, useRef, useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, WARN, SECTION_TITLE, fromISO, toISO, DAYS } from '../logic.js'
import { DEFAULT_OT, defaultOvertime, monthOvertime, dayOvertime, parsePlanText, fileText, fmtMin, isOffDay, workDaysIn, allowance, effectiveRate, rateByStep, RATES, RATE_YEAR, VICE_RATE } from '../overtime.js'
import { DateRangeField } from './DateField.jsx'
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
  const [sel, setSel] = useState(toISO(now))
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
  const card = { background: '#FFFFFF', borderRadius: 16, padding: isMobile ? '14px 14px' : '16px 18px', boxShadow: '0 1px 3px rgba(25,31,40,0.05)', minWidth: 0 }
  const btn = primary => ({ border: primary ? 'none' : '1px solid ' + LINE, borderRadius: 8, background: primary ? GREEN : '#FFFFFF', color: primary ? '#FFFFFF' : SUB, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 'none' })
  const won = n => n.toLocaleString('ko-KR') + '원'
  const mKey = ym.y + '-' + String(ym.m + 1).padStart(2, '0')
  const autoDays = workDaysIn(data, ym.y, ym.m)
  const attend = (ot.workDays || {})[mKey] ?? autoDays
  const pay = allowance(cfg, month, attend)
  const rate = effectiveRate(cfg)
  const autoRate = rateByStep(cfg.step, cfg.role)
  const setCfg = p => setOt(o => ({ ...o, cfg: { ...cfg, ...p } }))

  // 고른 날
  const day = dayOvertime(ot, data, sel)
  const selD = fromISO(sel)
  const selLog = (ot.logs || {})[sel] || {}
  const skipped = (ot.plans || []).filter(p => (p.skip || []).includes(sel))

  // 달력 칸
  const weeks = []
  {
    const first = new Date(ym.y, ym.m, 1)
    const start = new Date(ym.y, ym.m, 1 - first.getDay())
    for (let w = 0; w < 6; w++) {
      const row = []
      for (let i = 0; i < 7; i++) row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i))
      if (w >= 4 && row[0].getMonth() !== ym.m) break
      weeks.push(row)
    }
  }
  const byIso = Object.fromEntries(month.days.map(r => [r.iso, r]))
  const short = m => (m >= 60 ? Math.floor(m / 60) + 'h ' : '') + (m % 60 || m < 60 ? (m % 60) + 'm' : '')
  const todayIso = toISO(now)

  const calendar = (
    <section style={card} aria-label="월간 기록 달력">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={SECTION_TITLE}>월간 기록 달력</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: FAINT }}>● 방과후 있는 날 (끝난 뒤부터 셈)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', textAlign: 'center', fontSize: 12, fontWeight: 700, paddingBottom: 6 }}>
        {DAYS.split('').map((w, i) => <div key={w} style={{ color: i === 0 ? RED : i === 6 ? '#185FA5' : SUB }}>{w}</div>)}
      </div>
      <div style={{ border: '1px solid ' + LINE, borderRadius: 12, overflow: 'hidden' }}>
        {weeks.map((row, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {row.map((d, i) => {
              const iso = toISO(d)
              const out = d.getMonth() !== ym.m
              const r = byIso[iso]
              const isSel = iso === sel
              const off = isOffDay(data, iso)
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setSel(iso); if (out) setYm({ y: d.getFullYear(), m: d.getMonth() }) }}
                  aria-label={(d.getMonth() + 1) + '월 ' + d.getDate() + '일' + (r && r.minutes ? ' 초과근무 ' + fmtMin(r.minutes) : '')}
                  aria-pressed={isSel}
                  style={{
                    minHeight: isMobile ? 64 : 82, padding: isMobile ? '5px 4px' : '7px 8px', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                    border: 'none', borderTop: wi ? '1px solid ' + LINE_SOFT : 'none', borderLeft: i ? '1px solid ' + LINE_SOFT : 'none',
                    background: out ? '#F9FAFB' : '#FFFFFF', boxShadow: isSel ? 'inset 0 0 0 2px ' + GREEN : 'none', opacity: out ? 0.5 : 1,
                    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: iso === todayIso ? '#FFFFFF' : off ? RED : INK,
                      background: iso === todayIso ? GREEN : 'transparent', borderRadius: 999, padding: iso === todayIso ? '1px 7px' : 0,
                    }}>{d.getDate()}</span>
                    <span style={{ flex: 1 }} />
                    {r && r.plans.length > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />}
                  </span>
                  {r && r.minutes > 0 && (
                    <span title={r.future ? '예정 (방과후 계획)' : ''} style={{ fontSize: isMobile ? 11 : 13, fontWeight: r.future ? 600 : 800, color: r.future ? '#8CC3EA' : GREEN, lineHeight: 1.15, wordBreak: 'keep-all' }}>{short(r.minutes)}</span>
                  )}
                  {r && r.source === 'log' && !isMobile && <span style={{ fontSize: 10.5, color: FAINT }}>{r.off ? '휴일 근무' : '퇴근 ' + hm(r.end)}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )

  const dayEditor = (
    <section style={card} aria-label="고른 날 기록">
      <div style={{ fontSize: 16, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>
        {selD.getMonth() + 1}월 {selD.getDate()}일 <span style={{ fontWeight: 600, color: day.off ? RED : SUB }}>{DAYS[selD.getDay()]}요일</span>
        {day.off && <span style={{ fontSize: 12, fontWeight: 600, color: FAINT, marginLeft: 6 }}>쉬는 날</span>}
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {day.plans.map(x => (
          <div key={x.plan.id} style={{ fontSize: 13, color: SUB, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, flex: 'none' }} />
            {x.plan.name} <span style={{ color: FAINT }}>{x.from}~{x.to}</span>
          </div>
        ))}
        {!day.plans.length && !day.off && <div style={{ fontSize: 13, color: FAINT }}>방과후 없는 날</div>}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: SUB, width: 62 }}>{day.off ? '근무 시간' : '퇴근 시각'}</span>
        {day.off && <input type="time" aria-label="시작 시각" value={selLog.start || ''} onChange={e => setLog(sel, { start: e.target.value })} style={field} />}
        {day.off && <span style={{ color: FAINT }}>~</span>}
        <input type="time" aria-label={day.off ? '끝 시각' : '퇴근 시각'} value={selLog.end || ''} onChange={e => setLog(sel, { end: e.target.value })} style={field} />
      </div>
      {!day.off && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: SUB, width: 62 }}>조기출근</span>
          <input type="time" aria-label="조기출근 시각" value={selLog.arrive || ''} onChange={e => setLog(sel, { arrive: e.target.value })} style={field} />
          <span style={{ fontSize: 12, color: FAINT }}>출근 기준 {cfg.onTime}보다 1시간 이상 일찍 온 날만</span>
        </div>
      )}
      {!day.off && day.plans.length > 0 && !selLog.end && <div style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>방과후({hm(day.planEnd)}) 끝난 뒤 남아 일했다면 퇴근 시각을 넣으세요</div>}
      <div style={{ marginTop: 10, padding: '10px 12px', background: '#F5F8FB', borderRadius: 10, fontSize: 13, color: SUB, lineHeight: 1.6 }}>
        {day.end == null && !day.early ? (day.planEnd != null ? '방과후 수업 시간은 초과근무에 넣지 않습니다. 방과후 끝(' + hm(day.planEnd) + ') 뒤부터 셉니다.' : '기록이 없습니다.') : day.off
          ? <>{hm(day.start || 0)}~{hm(day.end)} = {fmtMin(day.raw) || '0분'}{day.raw > 0 && day.raw < 60 ? ' (1시간 미만은 인정 안 됨)' : ''}{day.raw > day.minutes && day.raw >= 60 ? ' (10.1. 전 하루 최대 ' + fmtMin(cfg.dailyMax) + ')' : ''}</>
          : <>{day.end != null ? <>퇴근 {hm(day.end)} − {day.planEnd != null ? '방과후 끝 ' + hm(day.start) : '기준 ' + cfg.offTime} = {fmtMin(day.after) || '0분'}</> : null}{day.early ? <>{day.end != null ? ' + ' : ''}조기출근 {fmtMin(day.early)}</> : day.earlyRaw ? ' (조기출근 1시간 미만은 빼고)' : ''}{day.raw >= 60 ? (cfg.deduct ? ', 공제 ' + fmtMin(cfg.deduct) : '') : day.raw ? ' (1시간 미만은 인정 안 됨)' : ''}{day.raw >= 60 && day.raw - cfg.deduct > day.minutes ? ', 10.1. 전 하루 최대 ' + fmtMin(cfg.dailyMax) : ''}</>}
        <div style={{ fontSize: 15, fontWeight: 800, color: day.minutes ? GREEN : FAINT }}>인정 {day.minutes ? fmtMin(day.minutes) : '0분'}</div>
      </div>
      <input aria-label="메모" value={selLog.note || ''} onChange={e => setLog(sel, { note: e.target.value })} placeholder="메모 (예: 생기부 작업)" style={{ ...field, width: '100%', marginTop: 10 }} />
      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {day.plans.length > 0 && <button type="button" onClick={() => skipDay(day, true)} style={link}>이 날 방과후 빼기</button>}
        {skipped.length > 0 && <button type="button" onClick={() => skipDay({ ...day, plans: [] }, false)} style={link}>빼 둔 방과후 되살리기</button>}
        {(selLog.start || selLog.end || selLog.note || selLog.arrive) && <button type="button" onClick={() => setLog(sel, { start: '', end: '', note: '', arrive: '' })} style={{ ...link, color: WARN }}>기록 지우기</button>}
      </div>
    </section>
  )

  const plansCard = (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
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
            <div style={{ fontSize: 12.5, color: SUB }}>{p.dates && p.dates.length ? '날짜 ' + p.dates.length + '개' : '매주 ' + p.days.map(x => DAYS[x]).join('·')} · {p.from}~{p.to}</div>
            <div style={{ fontSize: 12, color: FAINT }}>{p.start.slice(5).replace('-', '.')} ~ {p.end.slice(5).replace('-', '.')}{(p.skip || []).length ? ' · 뺀 날 ' + p.skip.length + '일' : ''}</div>
          </div>
          <button type="button" onClick={() => setEdit({ ...p })} style={{ ...link, color: GREEN, fontWeight: 700 }}>고치기</button>
          <button type="button" onClick={() => removePlan(p.id)} style={link}>지우기</button>
        </div>
      ))}
    </section>
  )

  const settings = cfgOpen && (
    <section style={card} aria-label="계산 기준">
      <div style={{ ...SECTION_TITLE, marginBottom: 10 }}>계산 기준</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10, fontSize: 12.5, color: SUB }}>
        <label>출근 기준시각<input type="time" value={cfg.onTime} onChange={e => setCfg({ onTime: e.target.value })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
        <label>퇴근 기준시각<input type="time" value={cfg.offTime} onChange={e => setCfg({ offTime: e.target.value })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
        <label>호봉<input type="number" min="1" max="40" value={cfg.step || ''} placeholder="예: 8" onChange={e => setCfg({ step: Math.max(0, Math.round(+e.target.value || 0)) })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
        <label>직위<select value={cfg.role} onChange={e => setCfg({ role: e.target.value })} style={{ ...field, width: '100%', marginTop: 4 }}><option value="teacher">교사</option><option value="vice">교감</option></select></label>
        <label>시간당 단가(원)<input type="number" min="0" step="1" value={cfg.rate || ''} placeholder={autoRate ? '자동 ' + autoRate.toLocaleString('ko-KR') : '호봉을 넣으세요'} onChange={e => setCfg({ rate: Math.max(0, Math.round(+e.target.value || 0)) })} style={{ ...field, width: '100%', marginTop: 4 }} />
          <span style={{ fontSize: 11, color: FAINT }}>{cfg.rate ? '직접 넣은 값 사용 · 지우면 호봉 자동' : autoRate ? '호봉으로 자동 ' + autoRate.toLocaleString('ko-KR') + '원' : ''}</span></label>
        <label>월 인정 상한(시간)<input type="number" min="1" max="200" value={cfg.monthMax} onChange={e => setCfg({ monthMax: Math.max(1, +e.target.value || 57) })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
        <label>평일 공제(분)<input type="number" min="0" max="240" step="10" value={cfg.deduct} onChange={e => setCfg({ deduct: Math.max(0, +e.target.value || 0) })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
        <label>정액분(시간)<input type="number" min="0" max="20" value={cfg.fixedHours} onChange={e => setCfg({ fixedHours: Math.max(0, +e.target.value || 0) })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
      </div>
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10, lineHeight: 1.6 }}>
        시간당 단가({RATE_YEAR}년 교원 기준, 참고용): {RATES.map(r => r.label + ' ' + r.rate.toLocaleString('ko-KR') + '원').join(' · ')} · 교감 {VICE_RATE.toLocaleString('ko-KR')}원. 급여명세서와 다르면 단가를 직접 넣으세요. 「공무원보수 등의 업무지침」 기준: 평일은 퇴근 기준시각 뒤(방과후 있는 날은 방과후 끝 뒤)와 1시간 이상 조기출근한 시간을 더해 1시간 이상이면 1시간을 공제합니다. 토요일·공휴일은 1시간 이상 근무한 날 공제 없이 셉니다. 하루 4시간 상한은 2026. 10. 1.부터 폐지되어 그 전 날짜에만 적용하고, 월 57시간 상한은 그대로입니다. 월 합계는 분까지 더한 뒤 1시간 미만을 버립니다. 정액분은 출근 근무일수 15일 이상이면 전액, 미만이면 모자라는 하루마다 1/15씩 줄어듭니다(방학은 근무일수에서 빠짐).
      </div>
    </section>
  )

  return (
    <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 예상 수당 · 인정 시간 */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={nav}>‹</button>
          <div style={{ fontSize: 18, fontWeight: 800, minWidth: 116, textAlign: 'center', letterSpacing: '-0.02em' }}>{ym.y}년 {ym.m + 1}월</div>
          <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={nav}>›</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setCfgOpen(o => !o)} aria-expanded={cfgOpen} style={btn(false)}>계산 기준</button>
          <button type="button" onClick={exportCSV} disabled={!month.days.length} style={btn(false)}>CSV</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: isMobile ? 12 : 20, marginTop: 12, alignItems: 'stretch' }}>
          <div>
            <div style={{ fontSize: 13, color: FAINT }}>{rate ? ym.y + '-' + String(ym.m + 1).padStart(2, '0') + ' 예상 초과근무수당' : '이번 달 인정 시간'}</div>
            <div style={{ fontSize: isMobile ? 34 : 40, fontWeight: 800, color: INK, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              {rate ? won(pay.total) : month.hours + '시간'}
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 10, flexWrap: 'wrap', fontSize: 13, color: SUB }}>
              <div>인정시간<div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{month.hours}시간 / {cfg.monthMax}시간</div></div>
              <div>오늘까지 기록<div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{month.total ? fmtMin(month.total) : '0분'}</div></div>
              {month.planned > 0 && <div>남은 방과후 예정<div style={{ fontSize: 16, fontWeight: 800, color: '#5AA9DE' }}>+{fmtMin(month.planned)} <span style={{ fontSize: 12, fontWeight: 600, color: FAINT }}>→ 월말 {month.projected}시간</span></div></div>}
              {rate > 0 && <div>실적분<div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{won(pay.perf)}</div></div>}
              {rate > 0 && (
                <div>정액분 <span style={{ fontSize: 11.5, color: FAINT }}>15일 이상 출근 시 전액</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>{won(pay.fixed)}</span>
                    <input type="number" min="0" max="31" aria-label="정상출근일수" value={attend} onChange={e => setOt(o => ({ ...o, workDays: { ...(o.workDays || {}), [mKey]: e.target.value === '' ? undefined : Math.max(0, +e.target.value) } }))} style={{ ...field, width: 58, padding: '3px 6px' }} />
                    <span style={{ fontSize: 12 }}>일 출근</span>
                  </div>
                </div>
              )}
            </div>
            {!rate && <button type="button" onClick={() => setCfgOpen(true)} style={{ ...link, color: GREEN, fontWeight: 700, marginTop: 8 }}>계산 기준에서 호봉을 넣으면 예상 수당이 나옵니다</button>}
          </div>
          {/* 다음 인정 단위까지 — 눈에 잘 띄게 */}
          <div
            role="status"
            style={{
              borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              background: month.capped ? '#EBFBEE' : month.leftover ? '#FFF4E6' : '#F5F8FB',
              border: '1px solid ' + (month.capped ? '#B2F2BB' : month.leftover ? '#FFD8A8' : LINE_SOFT),
            }}
          >
            {month.capped ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2B8A3E' }}>월 인정 상한에 닿았어요</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#2B8A3E' }}>{cfg.monthMax}시간 모두 인정</div>
              </>
            ) : month.leftover ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#D9480F' }}>다음 인정 단위까지</div>
                <div style={{ fontSize: isMobile ? 34 : 40, fontWeight: 800, color: '#D9480F', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{month.toNext}분</div>
                <div style={{ fontSize: 13, color: '#862E00', marginTop: 4, lineHeight: 1.5 }}>
                  아직 반영되지 않은 기록이 {month.leftover}분 있어요.{rate ? ' ' + month.toNext + '분 더 채우면 +' + won(rate) : ''}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: SUB }}>다음 인정 단위까지</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: SUB }}>60분</div>
                <div style={{ fontSize: 12.5, color: FAINT }}>{month.total ? '기록이 1시간 단위로 딱 맞게 인정됐어요.' : '이 달 기록이 아직 없어요.'}</div>
              </>
            )}
          </div>
        </div>
      </section>

      {settings}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        {calendar}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {dayEditor}
          {plansCard}
        </div>
      </div>
    </div>
  )
}

const link = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: FAINT }
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
