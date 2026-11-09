import React, { useMemo, useState } from 'react'
import TimeInput from './TimeInput.jsx'
import { GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, RED, WARN, SECTION_TITLE, fromISO, toISO, DAYS } from '../logic.js'
import { DEFAULT_TRAVEL, REGION_LABEL, tripCost, tripDays, monthTrips } from '../travel.js'
import DateField from './DateField.jsx'
import useWindowWidth from '../useWindowWidth.js'

// 출장 여비 — 출장을 적으면 「공무원 여비 규정」 기준 예상 여비를 계산한다(참고용).
export default function TravelView({ data, setData, setSnack }) {
  const { isMobile } = useWindowWidth()
  const now = new Date()
  const trips = data.trips || []
  const cfg = { ...DEFAULT_TRAVEL, ...(data.travelCfg || {}), lodging: { ...DEFAULT_TRAVEL.lodging, ...((data.travelCfg || {}).lodging || {}) } }
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const blank = () => ({ id: null, date: toISO(now), endDate: '', kind: 'in', start: '13:00', end: '17:00', place: '', purpose: '', car: false, unpaid: false, fare: '', region: 'etc', lodgingCost: '', note: '' })
  const [form, setForm] = useState(blank)
  const [cfgOpen, setCfgOpen] = useState(false)
  const set = p => setForm(f => ({ ...f, ...p }))

  const list = useMemo(() => monthTrips(trips, ym.y, ym.m), [trips, ym])
  const costs = list.map(t => tripCost(t, cfg))
  const total = costs.reduce((a, c) => a + c.amount, 0)
  const move = n => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const won = n => n.toLocaleString('ko-KR') + '원'
  const preview = tripCost(form, cfg)

  const save = () => {
    if (!form.date) return
    const t = { ...form }
    if (t.kind === 'in') { delete t.endDate; delete t.fare; delete t.lodgingCost; delete t.region }
    setData(d => {
      const list0 = [...(d.trips || [])]
      if (t.id) list0[list0.findIndex(x => x.id === t.id)] = t
      else list0.push({ ...t, id: Date.now() })
      return { ...d, trips: list0 }
    })
    const dd = fromISO(t.date)
    setYm({ y: dd.getFullYear(), m: dd.getMonth() })
    setSnack({ text: '출장을 ' + (t.id ? '고쳤습니다.' : '넣었습니다.'), kind: 'none', ms: 3000 })
    setForm(f => ({ ...blank(), date: f.date, kind: f.kind }))
  }
  const remove = id => {
    const prev = data
    setData(d => ({ ...d, trips: (d.trips || []).filter(x => x.id !== id) }))
    setSnack({ text: '출장을 지웠습니다.', kind: 'all', prev, ms: 5000 })
  }
  const setCfg = p => setData(d => ({ ...d, travelCfg: { ...(d.travelCfg || {}), ...p } }))

  const exportCSV = () => {
    const rows = [['날짜', '구분', '시간', '장소', '목적', '공용차량', '부지급', '여비(원)', '내역']]
    list.forEach((t, i) => rows.push([t.date + (t.endDate && t.kind === 'out' ? '~' + t.endDate : ''), t.kind === 'out' ? '근무지 외' : '근무지 내', (t.start || '') + '~' + (t.end || ''), t.place, t.purpose, t.car ? 'O' : '', t.unpaid ? 'O' : '', costs[i].amount, costs[i].lines.map(l => l[0] + ' ' + l[1]).join(' / ')]))
    rows.push([], ['합계', '', '', '', '', '', '', total])
    const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
    a.download = '출장여비-' + ym.y + '-' + String(ym.m + 1).padStart(2, '0') + '.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }

  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13.5, padding: '6px 8px', boxSizing: 'border-box' }
  const card = { background: '#FFFFFF', borderRadius: 16, padding: isMobile ? '14px 14px' : '16px 18px', boxShadow: '0 1px 3px rgba(25,31,40,0.05)', minWidth: 0 }
  const btn = primary => ({ border: primary ? 'none' : '1px solid ' + LINE, borderRadius: 8, background: primary ? GREEN : '#FFFFFF', color: primary ? '#FFFFFF' : SUB, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 'none' })
  const lab = { fontSize: 12.5, fontWeight: 700, color: SUB, width: 64, flex: 'none' }
  const row = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
  const seg = (on, label, onClick) => (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 999, padding: '5px 12px', background: on ? '#E9F6FE' : '#FFFFFF', color: on ? GREEN : SUB, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="hov" style={nav}>‹</button>
          <div style={{ fontSize: 18, fontWeight: 800, minWidth: 116, textAlign: 'center', letterSpacing: '-0.02em' }}>{ym.y}년 {ym.m + 1}월</div>
          <button type="button" onClick={() => move(1)} aria-label="다음 달" className="hov" style={nav}>›</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setCfgOpen(o => !o)} aria-expanded={cfgOpen} style={btn(false)}>기준 금액</button>
          <button type="button" onClick={exportCSV} disabled={!list.length} style={btn(false)}>CSV</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: FAINT }}>{ym.y}-{String(ym.m + 1).padStart(2, '0')} 예상 출장 여비</div>
          <div style={{ fontSize: isMobile ? 34 : 40, fontWeight: 800, color: INK, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{won(total)}</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 8, flexWrap: 'wrap', fontSize: 13, color: SUB }}>
            <div>근무지 내<div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{list.filter(t => t.kind !== 'out').length}건</div></div>
            <div>근무지 외<div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{list.filter(t => t.kind === 'out').length}건</div></div>
            <div>여비 부지급<div style={{ fontSize: 16, fontWeight: 800, color: INK }}>{list.filter(t => t.unpaid).length}건</div></div>
          </div>
        </div>
      </section>

      {cfgOpen && (
        <section style={card} aria-label="기준 금액">
          <div style={{ ...SECTION_TITLE, marginBottom: 10 }}>기준 금액</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10, fontSize: 12.5, color: SUB }}>
            {[['inLong', '근무지 내 4시간 이상'], ['inShort', '근무지 내 4시간 미만'], ['carCut', '공용차량 감액(근무지 내)'], ['daily', '일비(1일)'], ['meal', '식비(1일)']].map(([k, l]) => (
              <label key={k}>{l}<input type="number" min="0" step="1000" value={cfg[k]} onChange={e => setCfg({ [k]: Math.max(0, Math.round(+e.target.value || 0)) })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
            ))}
            {Object.entries(REGION_LABEL).map(([k, l]) => (
              <label key={k}>숙박 상한 · {l}<input type="number" min="0" step="1000" value={cfg.lodging[k]} onChange={e => setCfg({ lodging: { ...cfg.lodging, [k]: Math.max(0, Math.round(+e.target.value || 0)) } })} style={{ ...field, width: '100%', marginTop: 4 }} /></label>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10, lineHeight: 1.6 }}>
            근무지 내 출장은 「공무원 여비 규정」 제18조(4시간 이상 2만원·미만 1만원)입니다. 근무지 외 출장의 일비·식비·숙박비 상한은 공개 자료 기준이라 개정되면 고쳐 주세요. 출장명령이 있어도 기관장은 예산 등의 사유로 여비를 줄이거나 지급하지 않을 수 있습니다.
            {JSON.stringify(data.travelCfg || {}) !== '{}' && <button type="button" onClick={() => setData(d => ({ ...d, travelCfg: {} }))} style={{ ...link, color: WARN, marginLeft: 8 }}>기본값으로</button>}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 14, alignItems: 'start' }}>
        {/* 출장 넣기 */}
        <section style={card} aria-label="출장 넣기">
          <div style={{ ...SECTION_TITLE, marginBottom: 10 }}>{form.id ? '출장 고치기' : '출장 넣기'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={row}>
              <span style={lab}>구분</span>
              {seg(form.kind === 'in', '근무지 내 (관내)', () => set({ kind: 'in' }))}
              {seg(form.kind === 'out', '근무지 외 (관외)', () => set({ kind: 'out' }))}
            </div>
            <div style={row}>
              <span style={lab}>날짜</span>
              <DateField value={form.date} onChange={v => set({ date: v })} label="출장 날짜" width={140} />
              {form.kind === 'out' && <><span style={{ color: FAINT }}>~</span><DateField value={form.endDate || form.date} onChange={v => set({ endDate: v })} near={form.date} min={form.date} label="출장 마치는 날" width={140} /></>}
            </div>
            <div style={row}>
              <span style={lab}>시간</span>
              <TimeInput aria-label="출장 시작" value={form.start} onChange={v => set({ start: v })} style={field} />
              <span style={{ color: FAINT }}>~</span>
              <TimeInput aria-label="출장 끝" value={form.end} onChange={v => set({ end: v })} style={field} />
            </div>
            <div style={row}>
              <span style={lab}>장소</span>
              <input aria-label="출장 장소" value={form.place} onChange={e => set({ place: e.target.value })} placeholder="예: ○○교육지원청" style={{ ...field, flex: 1, minWidth: 140 }} />
            </div>
            <div style={row}>
              <span style={lab}>목적</span>
              <input aria-label="출장 목적" value={form.purpose} onChange={e => set({ purpose: e.target.value })} placeholder="예: 직무연수, 학생 인솔" style={{ ...field, flex: 1, minWidth: 140 }} />
            </div>
            {form.kind === 'out' && (
              <>
                <div style={row}>
                  <span style={lab}>운임</span>
                  <input type="number" min="0" step="100" aria-label="운임(실비)" value={form.fare} onChange={e => set({ fare: e.target.value })} placeholder="왕복 교통비" style={{ ...field, width: 130 }} />
                  <span style={{ fontSize: 12, color: FAINT }}>원 (철도·버스 등 실비)</span>
                </div>
                {tripDays(form) > 1 && (
                  <div style={row}>
                    <span style={lab}>숙박</span>
                    <select aria-label="숙박 지역" value={form.region} onChange={e => set({ region: e.target.value })} style={field}>
                      {Object.entries(REGION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <input type="number" min="0" step="1000" aria-label="숙박 실비" value={form.lodgingCost} onChange={e => set({ lodgingCost: e.target.value })} placeholder="실제 숙박비" style={{ ...field, width: 130 }} />
                    <span style={{ fontSize: 12, color: FAINT }}>원</span>
                  </div>
                )}
              </>
            )}
            <div style={{ ...row, gap: 16 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13.5, color: INK, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.car} onChange={() => set({ car: !form.car })} style={{ accentColor: GREEN, margin: 0 }} /> 공용차량 이용
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13.5, color: INK, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.unpaid} onChange={() => set({ unpaid: !form.unpaid })} style={{ accentColor: GREEN, margin: 0 }} /> 여비 부지급
              </label>
            </div>
            <div style={{ padding: '10px 12px', background: '#F5F8FB', borderRadius: 10, fontSize: 13, color: SUB, lineHeight: 1.6 }}>
              {preview.lines.map(([l, v], i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><span>{v < 0 ? '−' + won(-v) : won(v)}</span></div>)}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: GREEN, marginTop: 2 }}><span>예상 여비</span><span>{won(preview.amount)}</span></div>
              {form.kind === 'in' && <div style={{ fontSize: 11.5, color: FAINT }}>출장 시간 {Math.floor(preview.minutes / 60)}시간 {preview.minutes % 60}분</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {form.id && <button type="button" onClick={() => setForm(blank())} style={btn(false)}>취소</button>}
              <button type="button" onClick={save} style={btn(true)}>{form.id ? '고치기' : '넣기'}</button>
            </div>
            <div style={{ fontSize: 11.5, color: FAINT, lineHeight: 1.6 }}>
              출장 중에는 초과근무가 원칙적으로 인정되지 않습니다. 직무연수는 출장(연수)으로 처리하고, 자율연수 등 개인 연수는 근무일수로 인정되지 않습니다.
            </div>
          </div>
        </section>

        {/* 이번 달 출장 */}
        <section style={card} aria-label="이번 달 출장">
          <div style={{ ...SECTION_TITLE, marginBottom: 8 }}>이번 달 출장</div>
          {list.length === 0 && <div style={{ fontSize: 13, color: FAINT }}>아직 없습니다.</div>}
          {list.map((t, i) => {
            const d = fromISO(t.date)
            const c = costs[i]
            return (
              <div key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid ' + LINE_SOFT : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: 62, flex: 'none', fontSize: 13.5, fontWeight: 700, color: d.getDay() === 0 || d.getDay() === 6 ? RED : INK }}>
                  {d.getMonth() + 1}.{d.getDate()} <span style={{ fontWeight: 500, color: SUB }}>{DAYS[d.getDay()]}</span>
                  {t.kind === 'out' && tripDays(t) > 1 && <div style={{ fontSize: 11, color: FAINT, fontWeight: 500 }}>{tripDays(t) - 1}박 {tripDays(t)}일</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: t.kind === 'out' ? '#FFF4E6' : '#E9F6FE', color: t.kind === 'out' ? '#D9480F' : GREEN }}>{t.kind === 'out' ? '근무지 외' : '근무지 내'}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{t.place || '장소 없음'}</span>
                    {t.unpaid && <span style={{ fontSize: 11, color: FAINT }}>부지급</span>}
                    {t.car && <span style={{ fontSize: 11, color: FAINT }}>공용차량</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: SUB }}>{t.purpose}{t.purpose && t.start ? ' · ' : ''}{t.start}~{t.end}</div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.amount ? INK : FAINT }}>{won(c.amount)}</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setForm({ ...blank(), ...t })} style={{ ...link, color: GREEN, fontWeight: 700 }}>고치기</button>
                    <button type="button" onClick={() => remove(t.id)} style={link}>지우기</button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}

const nav = { border: 'none', background: 'none', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 22, color: SUB, lineHeight: 1 }
const link = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: FAINT }
