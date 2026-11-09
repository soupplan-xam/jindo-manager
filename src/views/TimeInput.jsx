import React, { useEffect, useRef } from 'react'

// 시각 입력칸 — 브라우저 시각 칸은 키보드로 치는 도중 값이 잠깐 빈칸('')이 되는데,
// 그때마다 화면 값을 다시 넣으면 치던 칸이 초기화되어 시각을 칠 수 없다.
// 그래서 칸은 브라우저가 스스로 들고 있게 두고, 「09:30」처럼 다 친 값만 위로 올린다.
// 칸을 비우고 나가면(allowEmpty) 빈칸을 올린다. 다른 곳에서 값이 바뀌면(채우기 등) 칸을 고르고 있지 않을 때 맞춘다.
export default function TimeInput({ value, onChange, allowEmpty = false, ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.value !== (value || '')) el.value = value || ''
  }, [value])
  return (
    <input
      ref={ref}
      type="time"
      defaultValue={value || ''}
      onChange={e => { const v = e.target.value; if (/^\d{2}:\d{2}$/.test(v) && v !== value) onChange(v) }}
      onBlur={e => {
        const v = e.target.value
        if (!v && allowEmpty && value) onChange('')
        else if (!v && value) e.target.value = value // 다 지우고 나가면 원래 값으로
      }}
      {...rest}
    />
  )
}
