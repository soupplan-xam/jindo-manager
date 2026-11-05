import React from 'react'
import { INK, SUB, FAINT, RED, WARN } from '../logic.js'
import { ALLERGY, dustGrade } from '../today.js'

const DUST_COLOR = ['#1C7ED6', '#2B8A3E', '#E8590C', '#E03131']

// 날씨: 첫 줄 하늘·기온, 둘째 줄 최고·최저·강수, 셋째 줄 미세먼지 — 좁은 카드에서도 줄이 섞이지 않게
export function WeatherLine({ weather, weatherErr, place, size = 13 }) {
  if (!place) return <div style={{ fontSize: 12, color: FAINT }}>설정에서 학교나 위치를 고르면 날씨가 나옵니다.</div>
  if (weatherErr) return <div style={{ fontSize: 12, color: WARN }}>{weatherErr}</div>
  if (!weather) return <div style={{ fontSize: 12, color: FAINT }}>날씨를 불러오는 중…</div>
  const pm10 = dustGrade('pm10', weather.pm10)
  const pm25 = dustGrade('pm25', weather.pm25)
  const line = { display: 'flex', flexWrap: 'wrap', gap: '0 10px', fontSize: size, color: SUB, lineHeight: 1.5 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: size + 9, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{weather.temp}°</span>
        <span style={{ fontSize: size + 1, fontWeight: 700, color: INK }}>{weather.text}</span>
        <span style={{ fontSize: 11, color: FAINT }}>{place.name}</span>
      </div>
      <div style={line}>
        {weather.max != null && <span>최고 {weather.max}° · 최저 {weather.min}°</span>}
        {weather.rain != null && <span>강수 {weather.rain}%</span>}
      </div>
      {(pm10 || pm25) && (
        <div style={line}>
          {pm10 && <span>미세 <b style={{ color: DUST_COLOR[pm10.level] }}>{pm10.label}</b></span>}
          {pm25 && <span>초미세 <b style={{ color: DUST_COLOR[pm25.level] }}>{pm25.label}</b></span>}
        </div>
      )}
    </div>
  )
}

// 급식: 중식을 먼저, 메뉴는 한 줄에 하나. 알레르기 번호는 숨기고 마우스를 올리면 이름을 보여 준다(showAllergy 면 옅게 표시)
export function MealView({ meal, mealErr, school, size = 13, only, showAllergy = false }) {
  if (!school) return <div style={{ fontSize: 12, color: FAINT }}>설정에서 우리 학교를 고르면 급식이 나옵니다.</div>
  if (mealErr) return <div style={{ fontSize: 12, color: WARN }}>{mealErr}</div>
  if (!meal) return <div style={{ fontSize: 12, color: FAINT }}>급식을 불러오는 중…</div>
  if (!meal.length) return <div style={{ fontSize: 12, color: FAINT }}>오늘은 급식 정보가 없습니다.</div>
  const order = { 중식: 0, 석식: 1, 조식: 2 }
  const rows = meal.slice().sort((a, b) => (order[a.meal] ?? 9) - (order[b.meal] ?? 9)).filter(r => !only || r.meal === only || !meal.some(m => m.meal === only))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.meal}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>{r.meal}</span>
            {r.cal && <span style={{ fontSize: 11, color: FAINT }}>{r.cal.replace(/\s*Kcal/i, ' kcal')}</span>}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '1px 12px' }}>
            {r.dishes.map((d, i) => (
              <li
                key={i}
                title={d.allergy.length ? '알레르기: ' + d.allergy.map(n => ALLERGY[n]).join(', ') : ''}
                style={{ fontSize: size, color: INK, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {d.name}
                {showAllergy && d.allergy.length > 0 && <span style={{ fontSize: 10, color: FAINT, marginLeft: 3 }}>{d.allergy.join('.')}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// 지금 교시 문구
export function periodLabel(period) {
  if (!period) return ''
  if (period.kind === 'class') return '지금 ' + period.period + '교시 · ' + period.left + '분 남음'
  if (period.kind === 'break') return '쉬는 시간 · ' + period.next + '교시까지 ' + period.left + '분'
  if (period.kind === 'before') return '1교시 전'
  return '수업 끝'
}
export const NOW_BG = '#E9F6FE'
export { RED }
