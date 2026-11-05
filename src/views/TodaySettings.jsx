import React, { useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, WARN } from '../logic.js'
import { neisSearchSchools } from '../schools.js'
import { DEFAULT_BELLS, REGION_COORD, weatherPlace, searchPlace, cityFromAddress, makeBells } from '../today.js'

// 설정 > 우리 학교 · 급식 · 날씨
export function SchoolWeatherSettings({ data, setData }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [locMsg, setLocMsg] = useState('')
  const place = weatherPlace(data)

  const search = async e => {
    e && e.preventDefault()
    if (!q.trim()) return
    setBusy(true); setErr('')
    try {
      setList(await neisSearchSchools(q))
    } catch (x) {
      setErr(x.message || '학교를 찾지 못했습니다.')
    }
    setBusy(false)
  }
  const pick = async s => {
    setData(d => ({ ...d, school: { code: s.code, region: s.region, name: s.name, addr: s.addr || '' } }))
    setList(null); setQ('')
    // 날씨 위치를 아직 안 정했으면 학교 주소의 시·군으로 맞춘다
    const city = cityFromAddress(s.addr)
    if (city && !data.weatherLoc) {
      try {
        const r = (await searchPlace(city))[0]
        if (r) { setData(d => (d.weatherLoc ? d : { ...d, weatherLoc: { name: city, lat: r.lat, lon: r.lon } })); setLocMsg('날씨 위치를 학교가 있는 ' + city + '(으)로 맞췄습니다.') }
      } catch { /* 시·도 기준으로 둔다 */ }
    }
  }
  const [pq, setPq] = useState('')
  const [places, setPlaces] = useState(null)
  const findPlace = async e => {
    e && e.preventDefault()
    setLocMsg('')
    try {
      const r = await searchPlace(pq)
      setPlaces(r)
      if (!r.length) setLocMsg('「' + pq + '」을(를) 찾지 못했습니다. 시·군 이름(예: 평택)으로 다시 찾아보세요.')
    } catch (x) { setLocMsg(x.message || '지명을 찾지 못했습니다.') }
  }
  const useHere = () => {
    setLocMsg('')
    if (!navigator.geolocation) { setLocMsg('이 브라우저는 위치를 알려 주지 않습니다.'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setData(d => ({ ...d, weatherLoc: { name: '현재 위치', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) } }))
        setLocMsg('현재 위치로 맞췄습니다.')
      },
      () => setLocMsg('위치 권한이 없어 맞추지 못했습니다. 브라우저 주소창의 위치 권한을 허용해 주세요.'),
      { timeout: 10000 },
    )
  }
  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13.5, padding: '7px 10px', boxSizing: 'border-box' }

  return (
    <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5 }}>
      <div>
        <div style={{ fontSize: 12, color: FAINT, marginBottom: 6 }}>우리 학교 (급식은 나이스에서 가져옵니다)</div>
        {data.school && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <b style={{ color: INK }}>{data.school.name}</b>
            <button type="button" onClick={() => setData(d => ({ ...d, school: null }))} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: WARN }}>지우기</button>
          </div>
        )}
        <form onSubmit={search} style={{ display: 'flex', gap: 6 }}>
          <input aria-label="학교 이름 검색" value={q} onChange={e => setQ(e.target.value)} placeholder={data.school ? '다른 학교 검색' : '학교 이름 (예: 한빛고)'} style={{ ...field, flex: 1, minWidth: 0 }} />
          <button type="submit" disabled={busy} style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>{busy ? '찾는 중' : '검색'}</button>
        </form>
        {err && <div role="alert" style={{ marginTop: 6, fontSize: 12.5, color: WARN }}>{err}</div>}
        {list && (
          <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid ' + LINE, borderRadius: 8 }}>
            {list.length === 0 && <div style={{ padding: 10, fontSize: 12.5, color: FAINT }}>찾는 학교가 없습니다.</div>}
            {list.map(s => (
              <button key={s.key} type="button" onClick={() => pick(s)} className="hov2" style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid ' + LINE, background: '#FFFFFF', padding: '8px 10px', cursor: 'pointer', fontSize: 13.5, color: INK }}>
                <b>{s.name}</b><span style={{ color: FAINT, fontSize: 12 }}>{s.regionName}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, color: FAINT, marginBottom: 6 }}>날씨 위치</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b style={{ color: INK }}>{place ? place.name : '없음'}</b>
          <select
            aria-label="날씨 지역"
            value={data.weatherLoc ? data.weatherLoc.region || 'custom' : ''}
            onChange={e => {
              const k = e.target.value
              const r = REGION_COORD[k]
              setData(d => ({ ...d, weatherLoc: r ? { region: k, name: r[0], lat: r[1], lon: r[2] } : null }))
            }}
            style={{ ...field, padding: '5px 8px' }}
          >
            <option value="">{data.school ? '학교 지역 따르기' : '지역 고르기'}</option>
            {data.weatherLoc && !data.weatherLoc.region && <option value="custom" disabled>직접 고른 지역</option>}
            {Object.entries(REGION_COORD).map(([k, r]) => <option key={k} value={k}>{r[0]}</option>)}
          </select>
          <button type="button" onClick={useHere} style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', color: SUB, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer' }}>현재 위치로</button>
        </div>
        <form onSubmit={findPlace} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input aria-label="날씨 지역 검색" value={pq} onChange={e => setPq(e.target.value)} placeholder="시·군 이름 (예: 평택)" style={{ ...field, flex: 1, minWidth: 0 }} />
          <button type="submit" style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', color: SUB, padding: '0 12px', fontSize: 12.5, cursor: 'pointer', flex: 'none' }}>지역 찾기</button>
        </form>
        {places && places.length > 0 && (
          <div style={{ marginTop: 6, border: '1px solid ' + LINE, borderRadius: 8, maxHeight: 160, overflowY: 'auto' }}>
            {places.map((p, i) => (
              <button key={i} type="button" className="hov2" onClick={() => { setData(d => ({ ...d, weatherLoc: { name: p.name, lat: p.lat, lon: p.lon } })); setPlaces(null); setPq(''); setLocMsg('날씨 위치를 ' + p.name + '(으)로 맞췄습니다.') }}
                style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid ' + LINE, background: '#FFFFFF', padding: '7px 10px', cursor: 'pointer', fontSize: 13.5, color: INK }}>
                <b>{p.name}</b><span style={{ color: FAINT, fontSize: 12 }}>{p.sub}</span>
              </button>
            ))}
          </div>
        )}
        {locMsg && <div style={{ marginTop: 6, fontSize: 12.5, color: SUB }}>{locMsg}</div>}
        <div style={{ marginTop: 6, fontSize: 11.5, color: FAINT }}>날씨·미세먼지는 Open-Meteo(무료 공개 서비스)에서 가져옵니다. 미세먼지 등급은 환경부 기준입니다.</div>
      </div>
    </div>
  )
}

// 설정 > 교시 시각 — 한 칸씩 고치거나, 1교시 시작·수업·쉬는·점심 시간으로 한꺼번에 채운다
export function BellSettings({ data, setData }) {
  const bells = data.cfg.bells && data.cfg.bells.length ? data.cfg.bells : DEFAULT_BELLS
  const setBells = next => setData(d => ({ ...d, cfg: { ...d.cfg, bells: next } }))
  const set = (i, j, v) => {
    const next = bells.map(b => b.slice())
    next[i][j] = v
    setBells(next)
  }
  const [gen, setGen] = useState({ start: bells[0][0], lesson: 50, rest: 10, lunchAfter: 4, lunch: 60, count: bells.length })
  const g = p => setGen(x => ({ ...x, ...p }))
  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '4px 6px', boxSizing: 'border-box' }
  const num = (k, label, unit, min, max) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{label}
      <input type="number" min={min} max={max} value={gen[k]} onChange={e => g({ [k]: Math.max(min, Math.min(max, Math.round(+e.target.value || min))) })} style={{ ...field, width: 54 }} />{unit}
    </label>
  )
  return (
    <div style={{ padding: '0 0 16px', fontSize: 13.5 }}>
      <div style={{ background: '#F5F8FB', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 14px', alignItems: 'center', fontSize: 12.5, color: SUB }}>
        <b style={{ color: INK, width: '100%' }}>한꺼번에 채우기</b>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>1교시 시작 <input type="time" value={gen.start} onChange={e => g({ start: e.target.value })} style={field} /></label>
        {num('lesson', '수업', '분', 30, 60)}
        {num('rest', '쉬는 시간', '분', 0, 30)}
        {num('lunchAfter', '점심은', '교시 뒤', 1, 8)}
        {num('lunch', '점심', '분', 20, 90)}
        {num('count', '교시 수', '', 4, 10)}
        <button type="button" onClick={() => setBells(makeBells(gen))} style={{ border: 'none', borderRadius: 8, background: GREEN, color: '#FFFFFF', padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>채우기</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto', gap: '6px 8px', alignItems: 'center', justifyContent: 'start' }}>
        {bells.map((b, i) => (
          <React.Fragment key={i}>
            <span style={{ color: SUB, fontWeight: 700 }}>{i + 1}교시</span>
            <input type="time" aria-label={i + 1 + '교시 시작'} value={b[0]} onChange={e => set(i, 0, e.target.value)} style={field} />
            <span style={{ color: FAINT }}>~</span>
            <input type="time" aria-label={i + 1 + '교시 끝'} value={b[1]} onChange={e => set(i, 1, e.target.value)} style={field} />
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setBells([...bells.map(b => b.slice()), (() => { const e = bells[bells.length - 1][1]; const [h, m] = e.split(':').map(Number); const s = h * 60 + m + gen.rest; const f = x => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); return [f(s), f(s + gen.lesson)] })()])} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: GREEN }}>+ 교시 더하기</button>
        {bells.length > 1 && <button type="button" onClick={() => setBells(bells.slice(0, -1).map(b => b.slice()))} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: FAINT }}>마지막 교시 빼기</button>}
        {data.cfg.bells && (
          <button type="button" onClick={() => setData(d => ({ ...d, cfg: { ...d.cfg, bells: null } }))} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: WARN }}>기본 시각으로</button>
        )}
        <span style={{ fontSize: 11.5, color: FAINT }}>대시보드 「오늘」과 위젯에 지금 교시가 표시됩니다.</span>
      </div>
    </div>
  )
}
