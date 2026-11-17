import { useEffect, useState } from 'react'

// 창 크기 — isMobile: 휴대폰 폭, isCompact: 창을 줄여 쓸 때(폭이 좁은 PC 창), height: 한 화면 고정 여부 판단용
export default function useWindowWidth() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const on = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return { width: size.width, height: size.height, isMobile: size.width < 768, isCompact: size.width >= 768 && size.width < 1100 }
}
