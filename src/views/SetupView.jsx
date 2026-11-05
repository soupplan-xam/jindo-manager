import React, { useState } from 'react'
import { GREEN, INK, FAINT, LINE, SUB, SECTION_TITLE, CHIP_BTN, CHIP_BTN_OFF } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'
import ScheduleEditor from './ScheduleEditor.jsx'
import ScheduleCalendar, { CalendarIcon, ListIcon } from './ScheduleCalendar.jsx'
import useWindowWidth from '../useWindowWidth.js'
import useSplit from '../useSplit.js'
import { DateRangeField } from './DateField.jsx'

// 최초 설정 = 진도표 화면과 같은 골격(윗줄 + 시간표 + 오른쪽 패널).
// 윗줄만 대시보드 대신 학기 기간이고, 오른쪽 패널은 차시별 내용 대신 일정이다.
export default function SetupView({ data, patch, setData, computed, setSnack, goImport, openSchools, onStart, fit }) {
  const { isMobile } = useWindowWidth()
  const { wrapRef, splitPct, dragging, startDrag } = useSplit(data, setData)
  const [mtab, setMtab] = useState('grid') // 모바일 탭: grid | sched

  const ok = data.semStart && data.semEnd && data.semStart < data.semEnd && Object.keys(data.pattern).length > 0
  const min = !!data.cfg.minimal

  const semFields = (
    <div data-intro-sem style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <DateRangeField
        start={data.semStart}
        end={data.semEnd}
        onChange={r => patch({ semStart: r.start, semEnd: r.end })}
        labels={['학기 시작일', '학기 종료일']}
      />
    </div>
  )

  // 미니멀 데스크톱: 학기 날짜를 팔레트 줄 앞에 붙여 한 줄로 합친다
  const mergeSem = min && !isMobile
  const timetable = (
    <TimetableEditor
      data={data}
      setData={setData}
      setSnack={setSnack}
      cellHeight={fit ? 0 : 42}
      compact
      fill={fit}
      leading={mergeSem ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>{semFields}</div> : null}
    />
  )

  // 두 칼럼의 첫 줄(학기 / 일정)을 같은 높이로 맞춘다
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flex: 'none', minHeight: 32, boxSizing: 'border-box' }

  const semRow = (
    <div style={rowStyle}>
      {!data.cfg.minimal && <div style={{ ...SECTION_TITLE, flex: 'none' }}>학기</div>}
      {semFields}
    </div>
  )

  // 일정은 목록(일정뷰)이 기본. 달력뷰로 바꾸면 그 선택이 저장된다.
  const schedView = data.cfg.schedView // null(=일정뷰) | 'cal' | 'list'
  const calView = schedView === 'cal'
  const setView = v => setData(d => ({ ...d, cfg: { ...d.cfg, schedView: v } }))

  // 달력뷰/일정뷰를 오가고, 학교검색으로 학사일정을 통째로 가져온다
  const regButtons = (
    <div style={{ display: 'flex', gap: 6, flex: 'none', alignItems: 'center' }}>
      <button onClick={() => setView('cal')} title="달력에 칠해서 간편 등록" style={{ ...(calView ? CHIP_BTN : CHIP_BTN_OFF), padding: '7px 12px' }}>
        <CalendarIcon />
        달력뷰
      </button>
      <button onClick={() => setView('list')} title="이름·기간·유형을 직접 입력" style={{ ...(calView ? CHIP_BTN_OFF : CHIP_BTN), padding: '7px 12px' }}>
        <ListIcon />
        일정뷰
      </button>
      {/* 학교 이름으로 나이스 학사일정을 그대로 가져온다 — 하나씩 넣는 수고를 덜어준다 */}
      <button onClick={openSchools} title="학교 이름으로 학사일정 검색" style={{ ...CHIP_BTN_OFF, padding: '7px 12px' }}>
        <SearchIcon />
        학교검색
      </button>
    </div>
  )

  const schedule = (
    <div data-intro-sched style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {calView ? (
        <ScheduleCalendar data={data} setData={setData} setSnack={setSnack} actions={regButtons} paintable />
      ) : (
        <div style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', padding: '0 12px 10px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ScheduleEditor data={data} setData={setData} computed={computed} setSnack={setSnack} onImport={() => goImport('schedule')} onSchools={openSchools} actions={regButtons} fill />
        </div>
      )}
    </div>
  )

  // 모바일: 진도표 화면과 같은 탭 구조
  if (isMobile) {
    const tab = (id, text) => (
      <button
        key={id}
        onClick={() => setMtab(id)}
        style={{
          flex: 1, border: 'none', background: mtab === id ? '#FFFFFF' : 'transparent',
          borderRadius: 8, padding: '7px 0', cursor: 'pointer',
          fontSize: 13, fontWeight: mtab === id ? 700 : 500, color: mtab === id ? INK : SUB,
          boxShadow: mtab === id ? '0 1px 3px rgba(26,26,26,0.10)' : 'none',
        }}
      >
        {text}
      </button>
    )
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {semRow}
        <div style={{ display: 'flex', gap: 3, background: '#E8EBEF', borderRadius: 12, padding: 3, marginBottom: 10, flex: 'none' }}>
          {tab('grid', '시간표')}
          {tab('sched', '일정')}
        </div>
        {mtab === 'grid' ? timetable : <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{schedule}</div>}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto', height: fit ? '100%' : undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div ref={wrapRef} style={{ display: 'flex', alignItems: 'stretch', flex: fit ? 1 : undefined, minHeight: fit ? 300 : 0 }}>
        <div style={{ width: splitPct + '%', minWidth: 0, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!mergeSem && semRow}
          {timetable}
        </div>
        <div
          onMouseDown={startDrag}
          title="드래그해서 너비 조절"
          style={{ width: 18, alignSelf: 'stretch', cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
        >
          <div style={{ width: 3, borderRadius: 2, background: dragging ? GREEN : '#DDE2E7' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {schedule}
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

