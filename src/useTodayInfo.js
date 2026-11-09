import { useEffect, useState } from 'react'
import { toISO } from './logic.js'
import { fetchMeal, fetchWeather, weatherPlace, periodNow, bellsFor } from './today.js'

// 지금 시각(30초마다) · 현재 교시 · 오늘 급식 · 날씨(30분마다)
export default function useTodayInfo(data, { meal: wantMeal = true, weather: wantWx = true } = {}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const today = toISO(now)
  // 단축수업 날은 그 날 시각표로
  const bellInfo = bellsFor(data, today)
  const period = periodNow(bellInfo.bells, now)

  const [meal, setMeal] = useState({ rows: null, err: '' })
  const school = data.school
  useEffect(() => {
    if (!wantMeal || !school) { setMeal({ rows: null, err: '' }); return }
    let alive = true
    fetchMeal(school, today)
      .then(rows => alive && setMeal({ rows, err: '' }))
      .catch(e => alive && setMeal({ rows: null, err: e.message || '급식 정보를 받지 못했습니다.' }))
    return () => { alive = false }
  }, [wantMeal, school && school.code, school && school.region, today])

  const place = weatherPlace(data)
  const [wx, setWx] = useState({ w: null, err: '' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30 * 60000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!wantWx || !place) { setWx({ w: null, err: '' }); return }
    let alive = true
    fetchWeather(place)
      .then(w => alive && setWx({ w, err: '' }))
      .catch(e => alive && setWx({ w: null, err: e.message || '날씨를 받지 못했습니다.' }))
    return () => { alive = false }
  }, [wantWx, place && place.lat, place && place.lon, tick])

  return { now, today, period, bellSet: bellInfo.set, bellAuto: bellInfo.auto, meal: meal.rows, mealErr: meal.err, weather: wx.w, weatherErr: wx.err, place, school }
}
