import React, { useState } from 'react'
import { GREEN, INK, SUB, FAINT, LINE, WARN } from '../logic.js'
import { neisSearchSchools } from '../schools.js'
import { DEFAULT_BELLS, REGION_COORD, weatherPlace } from '../today.js'

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
  const pick = s => {
    setData(d => ({ ...d, school: { code: s.code, region: s.region, name: s.name } }))
    setList(null); setQ('')
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
            value={data.weatherLoc && data.weatherLoc.region ? data.weatherLoc.region : ''}
            onChange={e => {
              const k = e.target.value
              const r = REGION_COORD[k]
              setData(d => ({ ...d, weatherLoc: r ? { region: k, name: r[0], lat: r[1], lon: r[2] } : null }))
            }}
            style={{ ...field, padding: '5px 8px' }}
          >
            <option value="">{data.school ? '학교 지역 따르기' : '지역 고르기'}</option>
            {Object.entries(REGION_COORD).map(([k, r]) => <option key={k} value={k}>{r[0]}</option>)}
          </select>
          <button type="button" onClick={useHere} style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', color: SUB, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer' }}>현재 위치로</button>
        </div>
        {locMsg && <div style={{ marginTop: 6, fontSize: 12.5, color: SUB }}>{locMsg}</div>}
        <div style={{ marginTop: 6, fontSize: 11.5, color: FAINT }}>날씨·미세먼지는 Open-Meteo(무료 공개 서비스)에서 가져옵니다. 미세먼지 등급은 환경부 기준입니다.</div>
      </div>
    </div>
  )
}

// 설정 > 교시 시각
export function BellSettings({ data, setData }) {
  const bells = data.cfg.bells && data.cfg.bells.length ? data.cfg.bells : DEFAULT_BELLS
  const set = (i, j, v) => {
    const next = bells.map(b => b.slice())
    next[i][j] = v
    setData(d => ({ ...d, cfg: { ...d.cfg, bells: next } }))
  }
  const field = { border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', fontSize: 13, padding: '4px 6px', boxSizing: 'border-box' }
  return (
    <div style={{ padding: '0 0 16px', fontSize: 13.5 }}>
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
      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: FAINT }}>대시보드 「오늘」과 위젯에 지금 교시가 표시됩니다.</span>
        {data.cfg.bells && (
          <button type="button" onClick={() => setData(d => ({ ...d, cfg: { ...d.cfg, bells: null } }))} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: WARN }}>기본 시각으로</button>
        )}
      </div>
    </div>
  )
}
