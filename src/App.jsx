import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadData, saveData } from './storage.js'
import { compute, toISO, fromISO, DAYS, GREEN, SUB, CHIP_BTN } from './logic.js'
import GridView from './views/GridView.jsx'
import ImportView from './views/ImportView.jsx'
import SettingsModal from './views/SettingsModal.jsx'
import HamilModal from './views/HamilModal.jsx'
import SchoolCalendarModal from './views/SchoolCalendarModal.jsx'
import ScheduleGuideModal from './views/ScheduleGuideModal.jsx'
import SetupGuideModal from './views/SetupGuideModal.jsx'
import SetupView from './views/SetupView.jsx'
import HomeroomView from './views/HomeroomView.jsx'
import MonthCalendar from './views/MonthCalendar.jsx'
import Snackbar from './views/Snackbar.jsx'
import useWindowWidth from './useWindowWidth.js'
import useCloudSync from './useCloudSync.js'
import { SyncButton, SyncModal, SyncConflictModal } from './views/SyncPanel.jsx'

export default function App() {
  const [data, setData] = useState(loadData)
  useEffect(() => saveData(data), [data])
  const sync = useCloudSync(data, setData)
  // 위젯 창 등 다른 창에서 고친 내용을 따라온다(같은 브라우저 저장소)
  useEffect(() => {
    const on = e => { if (e.key === 'jindo.data.v1' && e.newValue) setData(loadData()) }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])
  const [syncOpen, setSyncOpen] = useState(false)
  // 인쇄 배율은 CSS가 body 속성을 보고 정한다
  useEffect(() => {
    document.body.dataset.printScale = data.cfg.printScale || 'l'
  }, [data.cfg.printScale])

  const { isMobile } = useWindowWidth()
  const [view, setView] = useState(() => (loadData().setupDone ? 'grid' : 'setup'))
  const [weekOffset, setWeekOffset] = useState(0)
  const [importKind, setImportKind] = useState('timetable')
  const [stagger, setStagger] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hamilOpen, setHamilOpen] = useState(false)
  const [schoolOpen, setSchoolOpen] = useState(false)
  // 처음 시작할 때 학사일정 넣는 길을 먼저 안내한다.
  // 이미 일정이 있거나 한 번 본 뒤라면 뜨지 않는다.
  const [schedGuideOpen, setSchedGuideOpen] = useState(
    () => !data.setupDone && !data.schedIntroSeen && !data.events.length
  )
  const [setupGuideOpen, setSetupGuideOpen] = useState(false) // 학기 확인 + 시간표 데모 안내
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const on = () => setPrinting(true)
    const off = () => setPrinting(false)
    window.addEventListener('beforeprint', on)
    window.addEventListener('afterprint', off)
    return () => {
      window.removeEventListener('beforeprint', on)
      window.removeEventListener('afterprint', off)
    }
  }, [])
  const [snack, setSnackState] = useState(null)
  const snackT = useRef()

  const today = toISO(new Date())
  const todayD = fromISO(today)
  const todayLabel = todayD.getMonth() + 1 + '.' + todayD.getDate() + ' ' + DAYS[todayD.getDay()] + '요일'
  const computed = useMemo(() => compute(data), [data])

  const patch = p => setData(d => ({ ...d, ...p }))
  const setSnack = sn => {
    clearTimeout(snackT.current)
    // 달력을 연달아 칠할 때처럼 자주 뜨는 알림은 짧게 (sn.ms)
    if (sn) snackT.current = setTimeout(() => setSnackState(null), sn.ms || 9000)
    setSnackState(sn)
  }

  const go = v => setView(v)
  const goImport = kind => {
    setImportKind(kind)
    setView('import')
  }

  const openSchools = () => setSchoolOpen(true)

  // 안내는 한 번이면 된다 — 닫든 검색으로 넘어가든 다시 뜨지 않게 표시해 둔다
  const closeSchedGuide = () => {
    setSchedGuideOpen(false)
    setData(d => ({ ...d, schedIntroSeen: true }))
  }

  // 화면 전환: 진도표 · 달력 · 담임
  const NAV = [['grid', '진도표'], ['calendar', '달력'], ['homeroom', '담임']]
  const nav = view !== 'setup' && data.setupDone ? (
    <div role="tablist" aria-label="화면" style={{ display: 'flex', background: '#E8EBEF', borderRadius: 10, padding: 3, gap: 2, flex: isMobile ? 1 : 'none' }}>
      {NAV.map(([v, label]) => {
        const on = view === v || (v === 'grid' && view === 'import')
        return (
          <button
            key={v}
            role="tab"
            aria-selected={on}
            onClick={() => go(v)}
            style={{
              flex: isMobile ? 1 : 'none', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: on ? 700 : 500,
              background: on ? '#FFFFFF' : 'transparent', color: on ? GREEN : SUB, boxShadow: on ? '0 1px 2px rgba(26,26,26,0.12)' : 'none',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  ) : null

  const ctx = { data, patch, setData, computed, today, snack, setSnack, go, goImport, openSchools, weekOffset, setWeekOffset, stagger }

  const setupReady = d => !!(d.semStart && d.semEnd && d.semStart < d.semEnd && Object.keys(d.pattern).length)

  const finishSetup = () => {
    patch({ setupDone: true })
    setWeekOffset(0)
    setStagger(true)
    setView('grid')
    setTimeout(() => setStagger(false), 1600)
  }

  // 진도표와 최초 설정은 데스크톱·모바일 모두 한 화면에 담는다(모바일은 탭으로 나뉜다).
  // 나머지 화면은 자연스럽게 스크롤한다.
  const fit = view === 'grid' || view === 'setup'

  // 글씨 크기는 화면 전체 배율로 조절한다. 높이는 배율로 나눠 한 화면 기준을 유지한다.
  // 인쇄할 때는 배율을 1로 돌려 인쇄 크기 설정과 겹치지 않게 한다.
  const fs = printing ? 1 : data.cfg.fontScale || 1
  const vh = fs === 1 ? '100vh' : 'calc(100vh / ' + fs + ')'

  return (
    <div
      data-font-zoom
      style={{
        zoom: fs === 1 ? undefined : fs,
        height: fit ? vh : undefined,
        minHeight: fit ? undefined : vh,
        overflow: fit ? 'hidden' : undefined,
        display: 'flex', flexDirection: 'column',
        padding: isMobile ? '14px 14px 80px' : fit ? '16px 32px 18px' : '22px 40px 90px',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-print="hide"
        style={{
          width: '100%', maxWidth: 1320, margin: '0 auto ' + (isMobile ? 10 : fit ? 8 : 20) + 'px',
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, borderBottom: '1px solid #E1E5EA',
          paddingBottom: fit ? 8 : 12, flex: 'none', boxSizing: 'border-box', minWidth: 0,
        }}
      >
        <div
          onClick={() => data.setupDone && go('grid')}
          style={{
            display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 10, flex: 'none',
            fontSize: isMobile ? 17 : 23, fontWeight: 800, letterSpacing: '-0.035em',
            cursor: data.setupDone ? 'pointer' : 'default',
          }}
        >
          <span style={{ display: 'inline-block', width: 5, height: isMobile ? 16 : 22, borderRadius: 2, background: GREEN, flex: 'none' }} />
          진도계획표
        </div>
        {view === 'setup' ? (
          // 설정 화면: 제목 옆 학교 로고 — 누르면 이름 검색으로 시간표를 불러온다
          <button
            data-intro-hamil
            onClick={() => setHamilOpen(true)}
            title="해밀고 시간표 불러오기"
            className="hov"
            style={{ border: 'none', background: 'none', borderRadius: 8, padding: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', flex: 'none' }}
          >
            <HamilMark />
          </button>
        ) : (
          <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, color: SUB, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{todayLabel}</div>
        )}
        <div style={{ flex: 1 }} />
        {/* 미니멀 모드 스위치 — 어디서든 바로 켜고 끈다 */}
        <button
          onClick={() => setData(d => ({ ...d, cfg: { ...d.cfg, minimal: !d.cfg.minimal } }))}
          title={data.cfg.minimal ? '미니멀 모드 끄기' : '미니멀 모드 켜기'}
          style={{
            width: 34, height: 19, border: '1px solid ' + (data.cfg.minimal ? GREEN : '#C5CCD3'), borderRadius: 999,
            background: data.cfg.minimal ? GREEN : '#FFFFFF', position: 'relative', cursor: 'pointer', padding: 0, flex: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute', top: 2.5, left: data.cfg.minimal ? 17 : 2.5,
              width: 12, height: 12, borderRadius: '50%',
              background: data.cfg.minimal ? '#FFFFFF' : '#B0B8C1', transition: 'left 150ms',
            }}
          />
        </button>
        {!isMobile && nav}
        {view !== 'setup' && (
          <button
            onClick={() => go('setup')}
            title="학기·시간표·일정 수정"
            style={{ ...CHIP_BTN, padding: data.cfg.minimal ? '6px 8px' : '6px 12px' }}
          >
            <PencilIcon />
            {!data.cfg.minimal && '수정'}
          </button>
        )}
        {view === 'setup' && (
          <button onClick={() => setSetupGuideOpen(true)} title="사용 안내" className="hov" style={iconBtn}>
            <GuideIcon />
          </button>
        )}
        <SyncButton sync={sync} onClick={() => setSyncOpen(true)} compact={isMobile} />
        <button
          onClick={() => setSettingsOpen(true)}
          title="설정"
          className="hov"
          style={iconBtn}
        >
          <GearIcon />
        </button>
        {view === 'setup' && (
          <button
            data-intro-start
            onClick={() => setupReady(data) && finishSetup()}
            style={{
              border: 'none', borderRadius: 8, padding: isMobile ? '6px 12px' : '7px 18px', fontSize: 14, fontWeight: 700, flex: 'none',
              background: setupReady(data) ? GREEN : '#D1D6DB', color: '#FFFFFF',
              cursor: setupReady(data) ? 'pointer' : 'default',
            }}
          >
            {data.setupDone ? '완료' : '시작'}
          </button>
        )}
      </div>

      {isMobile && nav && <div data-print="hide" style={{ display: 'flex', marginBottom: 10, flex: 'none' }}>{nav}</div>}
      <div style={{ flex: fit ? 1 : undefined, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: fit ? 'auto' : undefined }}>
        {view === 'grid' && <GridView {...ctx} fit={fit} />}
        {view === 'import' && <ImportView {...ctx} kind={importKind} />}
        {view === 'setup' && <SetupView {...ctx} fit={fit} onStart={finishSetup} />}
        {view === 'homeroom' && <HomeroomView data={data} setData={setData} setSnack={setSnack} />}
        {view === 'calendar' && <MonthCalendar data={data} setData={setData} setSnack={setSnack} />}
      </div>

      {syncOpen && <SyncModal sync={sync} onClose={() => setSyncOpen(false)} />}
      <SyncConflictModal sync={sync} data={data} />
      {settingsOpen && (
        <SettingsModal
          data={data}
          setData={setData}
          computed={computed}
          today={today}
          setSnack={setSnack}
          onClose={() => setSettingsOpen(false)}
          onResetSetup={() => go('setup')}
          onImport={goImport}
          onSchools={() => { setSettingsOpen(false); openSchools() }}
        />
      )}
      {schedGuideOpen && (
        <ScheduleGuideModal
          onSearch={() => { closeSchedGuide(); openSchools() }}
          onClose={closeSchedGuide}
        />
      )}
      {schoolOpen && (
        <SchoolCalendarModal
          data={data}
          setData={setData}
          setSnack={setSnack}
          onClose={() => setSchoolOpen(false)}
          onApplied={() => { if (!data.setupDone) setSetupGuideOpen(true) }}
        />
      )}
      {setupGuideOpen && (
        <SetupGuideModal data={data} patch={patch} onClose={() => setSetupGuideOpen(false)} />
      )}
      {hamilOpen && (
        <HamilModal
          data={data}
          setData={setData}
          setSnack={sn => { setSnack(sn); if (view === 'setup') setView('grid') }}
          onClose={() => setHamilOpen(false)}
        />
      )}

      <Snackbar snack={snack} setSnack={setSnack} data={data} setData={setData} />
    </div>
  )
}

// 학교 로고: public/haemil.png 가 있으면 그 이미지를, 없으면 글자 배지를 쓴다.
const iconBtn = { border: 'none', background: 'none', padding: 5, borderRadius: 8, cursor: 'pointer', display: 'flex', color: SUB, flex: 'none' }

function GuideIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H12v17H4.5A2.5 2.5 0 0 0 2 21.5z" />
      <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H12v17h7.5a2.5 2.5 0 0 1 2.5 2.5z" />
    </svg>
  )
}

function HamilMark() {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span style={{ display: 'inline-block', borderRadius: 5, background: GREEN, color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '5px 9px', lineHeight: 1 }}>
        해밀
      </span>
    )
  }
  return (
    <img
      src={import.meta.env.BASE_URL + 'haemil.png'}
      alt="해밀고등학교"
      onError={() => setFailed(true)}
      style={{ height: 28, width: 'auto', display: 'block' }}
    />
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32h.09a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77v.09a1.6 1.6 0 0 0 1.47.97H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.47.97z" />
    </svg>
  )
}
