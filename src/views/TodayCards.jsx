import React from 'react'
import { INK, SUB, FAINT, RED, WARN } from '../logic.js'
import { ALLERGY, dustGrade } from '../today.js'

const DUST_COLOR = ['#1C7ED6', '#2B8A3E', '#E8590C', '#E03131']

// 날씨 한 줄: 맑음 12° · 최고 15° 최저 4° · 강수 10% · 미세 좋음 · 초미세 보통
export function WeatherLine({ weather, weatherErr, place, size = 13 }) {
  if (!place) return <div style={{ fontSize: 12, color: FAINT }}>설정에서 학교나 위치를 고르면 날씨가 나옵니다.</div>
  if (weatherErr) return <div style={{ fontSize: 12, color: WARN }}>{weatherErr}</div>
  if (!weather) return <div style={{ fontSize: 12, color: FAINT }}>날씨를 불러오는 중…</div>
  const pm10 = dustGrade('pm10', weather.pm10)
  const pm25 = dustGrade('pm25', weather.pm25)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', fontSize: size, color: SUB }}>
      <span style={{ fontWeight: 700, color: INK }}>
        {weather.text} <span style={{ fontSize: size + 5, letterSpacing: '-0.02em' }}>{weather.temp}°</span>
      </span>
      {weather.max != null && <span>최고 {weather.max}° · 최저 {weather.min}°</span>}
      {weather.rain != null && <span>강수 {weather.rain}%</span>}
      {pm10 && <span>미세 <b style={{ color: DUST_COLOR[pm10.level] }}>{pm10.label}</b></span>}
      {pm25 && <span>초미세 <b style={{ color: DUST_COLOR[pm25.level] }}>{pm25.label}</b></span>}
      <span style={{ fontSize: 11, color: FAINT }}>{place.name}</span>
    </div>
  )
}

// 급식: 중식을 먼저, 알레르기 번호는 옅게
export function MealView({ meal, mealErr, school, size = 13, only }) {
  if (!school) return <div style={{ fontSize: 12, color: FAINT }}>설정에서 우리 학교를 고르면 급식이 나옵니다.</div>
  if (mealErr) return <div style={{ fontSize: 12, color: WARN }}>{mealErr}</div>
  if (!meal) return <div style={{ fontSize: 12, color: FAINT }}>급식을 불러오는 중…</div>
  if (!meal.length) return <div style={{ fontSize: 12, color: FAINT }}>오늘은 급식 정보가 없습니다.</div>
  const order = { 중식: 0, 석식: 1, 조식: 2 }
  const rows = meal.slice().sort((a, b) => (order[a.meal] ?? 9) - (order[b.meal] ?? 9)).filter(r => !only || r.meal === only || !meal.some(m => m.meal === only))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <div key={r.meal}>
          {meal.length > 1 && <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, marginBottom: 2 }}>{r.meal} {r.cal && <span style={{ fontWeight: 400 }}>· {r.cal}</span>}</div>}
          <div style={{ fontSize: size, color: INK, lineHeight: 1.55 }}>
            {r.dishes.map((d, i) => (
              <span key={i} title={d.allergy.length ? '알레르기: ' + d.allergy.map(n => ALLERGY[n]).join(', ') : ''}>
                {d.name}
                {d.allergy.length > 0 && <sup style={{ fontSize: 9, color: FAINT, marginLeft: 1 }}>{d.allergy.join('.')}</sup>}
                {i < r.dishes.length - 1 && <span style={{ color: FAINT }}> · </span>}
              </span>
            ))}
          </div>
          {meal.length === 1 && r.cal && <div style={{ fontSize: 11, color: FAINT, marginTop: 2 }}>{r.cal}</div>}
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
